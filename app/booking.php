<?php
declare(strict_types=1);

/**
 * Booking domain logic: validation, clash detection, creation and status changes.
 * A booking blocks a slot while it is 'pending' or 'approved'.
 */

const BLOCKING_STATUSES = "('pending','approved')";

const APPROVAL_MODES = [
    'auto'   => ['Lulus automatik', 'Tempahan terus diluluskan jika tiada pertindihan.'],
    'manual' => ['Semua perlu kelulusan', 'Setiap tempahan guru menunggu kelulusan pentadbir.'],
    'room'   => ['Ikut tetapan bilik', 'Hanya bilik yang ditanda "Perlu kelulusan" memerlukan kelulusan pentadbir.'],
];

/** Whether a teacher's booking for this room must wait for admin approval. */
function room_needs_approval(array $room): bool
{
    return match (setting('approval_mode', 'auto')) {
        'manual' => true,
        'room'   => (bool) $room['requires_approval'],
        default  => false,
    };
}

function find_conflicts(int $roomId, string $date, string $start, string $end, ?int $excludeId = null): array
{
    $sql = 'SELECT b.*, u.name AS user_name FROM bookings b JOIN users u ON u.id = b.user_id
            WHERE b.room_id = ? AND b.date = ? AND b.status IN ' . BLOCKING_STATUSES . '
              AND b.start_time < ? AND b.end_time > ?';
    $params = [$roomId, $date, $end, $start];
    if ($excludeId) {
        $sql .= ' AND b.id <> ?';
        $params[] = $excludeId;
    }
    $st = db()->prepare($sql . ' ORDER BY b.start_time');
    $st->execute($params);
    return $st->fetchAll();
}

function find_closure(int $roomId, string $date): ?array
{
    $st = db()->prepare('SELECT * FROM closures WHERE (room_id IS NULL OR room_id = ?) AND ? BETWEEN start_date AND end_date ORDER BY room_id IS NULL LIMIT 1');
    $st->execute([$roomId, $date]);
    return $st->fetch() ?: null;
}

function find_booking(int $id): ?array
{
    $st = db()->prepare('SELECT b.*, r.name AS room_name, r.code AS room_code, r.color AS room_color, r.location AS room_location,
                                u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.department AS user_department,
                                a.name AS reviewer_name
                         FROM bookings b
                         JOIN rooms r ON r.id = b.room_id
                         JOIN users u ON u.id = b.user_id
                         LEFT JOIN users a ON a.id = b.reviewed_by
                         WHERE b.id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/**
 * Validate one occurrence. Returns a list of human-readable errors (empty = OK).
 */
function validate_slot(array $room, string $date, string $start, string $end, array $user, ?int $excludeId = null, bool $checkClash = true): array
{
    $errors = [];
    $admin = $user['role'] === 'admin';

    if ($room['status'] !== 'active') {
        $errors[] = 'Bilik ' . $room['name'] . ' tidak dibuka untuk tempahan (' . (ROOM_STATUS_LABELS[$room['status']][0] ?? $room['status']) . ').';
    }
    if (!valid_date($date)) {
        return ['Tarikh tidak sah.'];
    }
    if (!valid_time($start) || !valid_time($end)) {
        return ['Masa tidak sah.'];
    }
    if ($end <= $start) {
        $errors[] = 'Masa tamat mesti selepas masa mula.';
    }

    $now = date('Y-m-d H:i');
    if ($date . ' ' . $start < $now) {
        $errors[] = 'Tidak boleh menempah untuk masa yang telah berlalu.';
    }

    if (!$admin) {
        $maxDays = (int) setting('max_advance_days', '60');
        if ($maxDays > 0 && $date > date('Y-m-d', strtotime("+{$maxDays} days"))) {
            $errors[] = "Tempahan hanya dibenarkan sehingga {$maxDays} hari lebih awal.";
        }
        $dow = (int) date('w', strtotime($date));
        if (setting('allow_weekend') !== '1' && ($dow === 0 || $dow === 6)) {
            $errors[] = 'Tempahan pada hujung minggu tidak dibenarkan.';
        }
        $open = setting('open_time', '07:00');
        $close = setting('close_time', '18:00');
        if ($start < $open || $end > $close) {
            $errors[] = "Masa tempahan mestilah dalam waktu operasi ({$open} – {$close}).";
        }
        $maxHours = (float) setting('max_duration_hours', '6');
        if ($maxHours > 0 && $end > $start && (time_to_min($end) - time_to_min($start)) > $maxHours * 60) {
            $errors[] = "Tempoh tempahan tidak boleh melebihi {$maxHours} jam.";
        }
    }

    if ($closure = find_closure((int) $room['id'], $date)) {
        $errors[] = 'Bilik ditutup pada ' . fmt_date($date) . ': ' . $closure['reason'] . '.';
    }

    if ($checkClash && $end > $start) {
        foreach (find_conflicts((int) $room['id'], $date, $start, $end, $excludeId) as $c) {
            $errors[] = sprintf('Bertembung dengan tempahan %s oleh %s (%s – %s) pada %s.',
                $c['ref_no'], $c['user_name'], $c['start_time'], $c['end_time'], fmt_date($date, false, true));
        }
    }
    return $errors;
}

function generate_ref(): string
{
    $st = db()->prepare('SELECT 1 FROM bookings WHERE ref_no = ?');
    do {
        $ref = 'TB' . date('ym') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 5));
        $st->execute([$ref]);
    } while ($st->fetchColumn());
    return $ref;
}

/**
 * Create a booking (optionally repeating weekly). All occurrences are validated
 * inside an IMMEDIATE transaction so two teachers can never grab the same slot.
 *
 * @return array{ok: bool, errors: string[], ids: int[], status: string}
 */
function create_booking(array $data, array $user): array
{
    $pdo = db();
    $room = find_room((int) ($data['room_id'] ?? 0));
    if (!$room) {
        return ['ok' => false, 'errors' => ['Sila pilih bilik.'], 'ids' => [], 'status' => ''];
    }
    $purpose = trim((string) ($data['purpose'] ?? ''));
    if ($purpose === '') {
        return ['ok' => false, 'errors' => ['Sila nyatakan tujuan tempahan.'], 'ids' => [], 'status' => ''];
    }
    $attendees = ($data['attendees'] ?? '') === '' ? null : max(0, (int) $data['attendees']);
    if ($attendees && $room['capacity'] > 0 && $attendees > $room['capacity']) {
        return ['ok' => false, 'errors' => ["Bilangan peserta ({$attendees}) melebihi kapasiti bilik ({$room['capacity']})."], 'ids' => [], 'status' => ''];
    }

    if (!valid_date((string) ($data['date'] ?? ''))) {
        return ['ok' => false, 'errors' => ['Tarikh tidak sah.'], 'ids' => [], 'status' => ''];
    }
    $weeks = max(1, min((int) setting('max_recurring_weeks', '16'), (int) ($data['repeat_weeks'] ?? 1)));
    $dates = [];
    for ($i = 0; $i < $weeks; $i++) {
        $dates[] = date('Y-m-d', strtotime($data['date'] . " +{$i} week"));
    }

    $needsApproval = room_needs_approval($room);
    $status = ($needsApproval && $user['role'] !== 'admin') ? 'pending' : 'approved';
    $seriesId = $weeks > 1 ? bin2hex(random_bytes(6)) : null;

    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $errors = [];
        foreach ($dates as $d) {
            foreach (validate_slot($room, $d, (string) ($data['start_time'] ?? ''), (string) ($data['end_time'] ?? ''), $user) as $err) {
                $errors[] = ($weeks > 1 ? fmt_date($d, false, true) . ': ' : '') . $err;
            }
        }
        if ($errors) {
            $pdo->exec('ROLLBACK');
            return ['ok' => false, 'errors' => array_values(array_unique($errors)), 'ids' => [], 'status' => ''];
        }

        $st = $pdo->prepare('INSERT INTO bookings(ref_no, user_id, room_id, date, start_time, end_time, purpose, class_name, subject, attendees, notes, status, series_id, reviewed_by, reviewed_at)
                             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $ids = [];
        foreach ($dates as $d) {
            $st->execute([
                generate_ref(), $user['id'], $room['id'], $d, $data['start_time'], $data['end_time'], $purpose,
                trim((string) ($data['class_name'] ?? '')) ?: null,
                trim((string) ($data['subject'] ?? '')) ?: null,
                $attendees,
                trim((string) ($data['notes'] ?? '')) ?: null,
                $status, $seriesId,
                $status === 'approved' && $needsApproval ? $user['id'] : null,
                $status === 'approved' && $needsApproval ? date('Y-m-d H:i:s') : null,
            ]);
            $ids[] = (int) $pdo->lastInsertId();
        }
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }

    $first = find_booking($ids[0]);
    audit('booking.create', sprintf('%s – %s, %s %s-%s%s', $first['ref_no'], $room['name'], $data['date'], $data['start_time'], $data['end_time'], $weeks > 1 ? " (x{$weeks} minggu)" : ''));
    if ($status === 'pending') {
        notify_admins('Tempahan baharu menunggu kelulusan',
            sprintf('%s menempah %s pada %s (%s – %s)%s.', $user['name'], $room['name'], fmt_date($data['date'], false, true), $data['start_time'], $data['end_time'], $weeks > 1 ? " untuk {$weeks} minggu" : ''),
            url('booking', ['id' => $ids[0]]), (int) $user['id']);
    }
    return ['ok' => true, 'errors' => [], 'ids' => $ids, 'status' => $status];
}

function update_booking(array $booking, array $data, array $user): array
{
    $pdo = db();
    $room = find_room((int) ($data['room_id'] ?? 0));
    if (!$room) {
        return ['ok' => false, 'errors' => ['Sila pilih bilik.']];
    }
    $purpose = trim((string) ($data['purpose'] ?? ''));
    if ($purpose === '') {
        return ['ok' => false, 'errors' => ['Sila nyatakan tujuan tempahan.']];
    }
    $attendees = ($data['attendees'] ?? '') === '' ? null : max(0, (int) $data['attendees']);
    if ($attendees && $room['capacity'] > 0 && $attendees > $room['capacity']) {
        return ['ok' => false, 'errors' => ["Bilangan peserta ({$attendees}) melebihi kapasiti bilik ({$room['capacity']})."]];
    }
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $errors = validate_slot($room, (string) $data['date'], (string) $data['start_time'], (string) $data['end_time'], $user, (int) $booking['id']);
        if ($errors) {
            $pdo->exec('ROLLBACK');
            return ['ok' => false, 'errors' => $errors];
        }
        $slotChanged = $room['id'] != $booking['room_id'] || $data['date'] !== $booking['date']
            || $data['start_time'] !== $booking['start_time'] || $data['end_time'] !== $booking['end_time'];
        $status = $booking['status'];
        if ($user['role'] !== 'admin' && room_needs_approval($room) && $slotChanged) {
            $status = 'pending';
        } elseif (!room_needs_approval($room)) {
            $status = 'approved';
        }
        $pdo->prepare("UPDATE bookings SET room_id=?, date=?, start_time=?, end_time=?, purpose=?, class_name=?, subject=?, attendees=?, notes=?, status=?, updated_at=datetime('now','localtime') WHERE id=?")
            ->execute([$room['id'], $data['date'], $data['start_time'], $data['end_time'], $purpose,
                trim((string) ($data['class_name'] ?? '')) ?: null, trim((string) ($data['subject'] ?? '')) ?: null,
                $attendees, trim((string) ($data['notes'] ?? '')) ?: null, $status, $booking['id']]);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
    audit('booking.update', $booking['ref_no'] . ' dikemas kini');
    if ($status === 'pending' && $booking['status'] !== 'pending') {
        notify_admins('Tempahan dipinda – perlu semakan', $user['name'] . ' meminda tempahan ' . $booking['ref_no'] . '.', url('booking', ['id' => $booking['id']]));
    }
    if ((int) $booking['user_id'] !== (int) $user['id']) {
        notify((int) $booking['user_id'], 'Tempahan anda dipinda oleh pentadbir', 'Tempahan ' . $booking['ref_no'] . ' telah dikemas kini.', url('booking', ['id' => $booking['id']]));
    }
    return ['ok' => true, 'errors' => []];
}

function can_modify_booking(array $booking, array $user): bool
{
    if (!in_array($booking['status'], ['pending', 'approved'], true)) {
        return false;
    }
    if ($user['role'] === 'admin') {
        return true;
    }
    if ((int) $booking['user_id'] !== (int) $user['id']) {
        return false;
    }
    $cutoff = (int) setting('cancel_cutoff_hours', '0');
    return strtotime($booking['date'] . ' ' . $booking['start_time']) - $cutoff * 3600 > time();
}

/**
 * Admin / owner status transitions.
 */
function change_booking_status(array $booking, string $status, array $actor, string $remark = ''): array
{
    $allowed = [
        'pending'  => ['approved', 'rejected', 'cancelled'],
        'approved' => ['cancelled', 'rejected'],
        'rejected' => ['approved'],
    ];
    if (!in_array($status, $allowed[$booking['status']] ?? [], true)) {
        return ['ok' => false, 'error' => 'Perubahan status tidak dibenarkan.'];
    }
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        if ($status === 'approved' && $booking['status'] === 'rejected') {
            $clash = find_conflicts((int) $booking['room_id'], $booking['date'], $booking['start_time'], $booking['end_time'], (int) $booking['id']);
            if ($clash) {
                $pdo->exec('ROLLBACK');
                return ['ok' => false, 'error' => 'Slot ini kini telah ditempah oleh ' . $clash[0]['user_name'] . ' (' . $clash[0]['ref_no'] . ').'];
            }
        }
        $isReview = $actor['role'] === 'admin';
        $pdo->prepare("UPDATE bookings SET status = ?, admin_remark = COALESCE(NULLIF(?, ''), admin_remark),
                         reviewed_by = CASE WHEN ? THEN ? ELSE reviewed_by END,
                         reviewed_at = CASE WHEN ? THEN datetime('now','localtime') ELSE reviewed_at END,
                         updated_at = datetime('now','localtime') WHERE id = ?")
            ->execute([$status, $remark, (int) $isReview, $actor['id'], (int) $isReview, $booking['id']]);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }

    $label = STATUS_LABELS[$status][0];
    audit('booking.' . $status, $booking['ref_no'] . ($remark ? " – {$remark}" : ''));
    if ((int) $booking['user_id'] !== (int) $actor['id']) {
        notify((int) $booking['user_id'], "Tempahan {$booking['ref_no']} {$label}",
            sprintf('%s, %s (%s – %s)%s', $booking['room_name'], fmt_date($booking['date'], false, true), $booking['start_time'], $booking['end_time'], $remark ? ". Catatan: {$remark}" : ''),
            url('booking', ['id' => $booking['id']]));
    } elseif ($status === 'cancelled' && $booking['status'] === 'pending') {
        // Teacher withdrew a request that admins were waiting on.
        notify_admins("Tempahan {$booking['ref_no']} ditarik balik", $actor['name'] . ' membatalkan permohonan.', url('booking', ['id' => $booking['id']]));
    }
    return ['ok' => true, 'error' => ''];
}

/**
 * Bookings for a date range, used by the calendar and availability views.
 */
function bookings_between(string $from, string $to, ?int $roomId = null, bool $includeInactive = false): array
{
    $sql = 'SELECT b.id, b.ref_no, b.date, b.start_time, b.end_time, b.purpose, b.class_name, b.subject, b.status, b.user_id, b.room_id,
                   r.name AS room_name, r.code AS room_code, r.color AS room_color, u.name AS user_name
            FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN users u ON u.id = b.user_id
            WHERE b.date BETWEEN ? AND ?' . ($includeInactive ? '' : ' AND b.status IN ' . BLOCKING_STATUSES);
    $params = [$from, $to];
    if ($roomId) {
        $sql .= ' AND b.room_id = ?';
        $params[] = $roomId;
    }
    $st = db()->prepare($sql . ' ORDER BY b.date, b.start_time');
    $st->execute($params);
    return $st->fetchAll();
}

function closures_between(string $from, string $to, ?int $roomId = null): array
{
    $sql = 'SELECT c.*, r.name AS room_name FROM closures c LEFT JOIN rooms r ON r.id = c.room_id WHERE c.start_date <= ? AND c.end_date >= ?';
    $params = [$to, $from];
    if ($roomId) {
        $sql .= ' AND (c.room_id IS NULL OR c.room_id = ?)';
        $params[] = $roomId;
    }
    $st = db()->prepare($sql . ' ORDER BY c.start_date');
    $st->execute($params);
    return $st->fetchAll();
}
