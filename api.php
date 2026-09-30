<?php
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

$school = current_school();
if (!$school || $school['status'] !== 'active') {
    json_response(['error' => 'Sekolah tidak dijumpai atau tidak aktif.'], 404);
}
$user = current_user();
if (!$user) {
    json_response(['error' => 'Sesi tamat. Sila log masuk semula.'], 401);
}

$action = query('action');

switch ($action) {
    // FullCalendar event feed
    case 'events':
        $from = substr(query('start'), 0, 10);
        $to = substr(query('end'), 0, 10);
        if (!valid_date($from) || !valid_date($to)) {
            json_response(['error' => 'Julat tarikh tidak sah.'], 422);
        }
        $roomId = (int) query('room_id') ?: null;
        $mine = query('mine') === '1';
        $events = [];
        foreach (bookings_between($from, $to, $roomId) as $b) {
            if ($mine && (int) $b['user_id'] !== (int) $user['id']) {
                continue;
            }
            $events[] = [
                'id'              => $b['id'],
                'title'           => ($roomId ? '' : $b['room_code'] . ' · ') . $b['purpose'],
                'start'           => $b['date'] . 'T' . $b['start_time'],
                'end'             => $b['date'] . 'T' . $b['end_time'],
                'backgroundColor' => $b['room_color'],
                'borderColor'     => $b['room_color'],
                'classNames'      => $b['status'] === 'pending' ? ['ev-pending'] : [],
                'extendedProps'   => [
                    'ref'     => $b['ref_no'],
                    'room'    => $b['room_name'],
                    'user'    => $b['user_name'],
                    'purpose' => $b['purpose'],
                    'class'   => $b['class_name'],
                    'subject' => $b['subject'],
                    'status'  => $b['status'],
                    'statusLabel' => STATUS_LABELS[$b['status']][0],
                    'time'    => $b['start_time'] . ' – ' . $b['end_time'],
                    'mine'    => (int) $b['user_id'] === (int) $user['id'],
                    'url'     => url('booking', ['id' => $b['id']]),
                ],
            ];
        }
        foreach (closures_between($from, $to, $roomId) as $c) {
            $events[] = [
                'title'   => 'DITUTUP: ' . ($c['room_name'] ?? 'Semua bilik') . ' – ' . $c['reason'],
                'start'   => $c['start_date'],
                'end'     => date('Y-m-d', strtotime($c['end_date'] . ' +1 day')),
                'allDay'  => true,
                'display' => 'block',
                'backgroundColor' => '#64748b',
                'borderColor' => '#64748b',
                'classNames' => ['ev-closure'],
                'extendedProps' => ['closure' => true],
            ];
        }
        json_response($events);

    // Availability of one room on one date (booking form) or all rooms (grid)
    case 'availability':
        $date = query('date');
        if (!valid_date($date)) {
            json_response(['error' => 'Tarikh tidak sah.'], 422);
        }
        $roomId = (int) query('room_id') ?: null;
        $exclude = (int) query('exclude');
        $bookings = array_values(array_filter(bookings_between($date, $date, $roomId), fn($b) => (int) $b['id'] !== $exclude));
        $closures = [];
        foreach ($roomId ? [find_room($roomId)] : all_rooms(true) as $room) {
            if ($room && ($c = find_closure((int) $room['id'], $date))) {
                $closures[$room['id']] = $c['reason'];
            }
        }
        json_response([
            'date'     => $date,
            'dateLabel'=> fmt_date($date, true),
            'bookings' => array_map(fn($b) => [
                'id' => $b['id'], 'room_id' => $b['room_id'], 'start' => $b['start_time'], 'end' => $b['end_time'],
                'purpose' => $b['purpose'], 'user' => $b['user_name'], 'status' => $b['status'], 'ref' => $b['ref_no'],
            ], $bookings),
            'closures' => (object) $closures,
            'open'     => setting('open_time'),
            'close'    => setting('close_time'),
        ]);

    // Real-time clash check for the booking form
    case 'check':
        $room = find_room((int) query('room_id'));
        if (!$room) {
            json_response(['ok' => false, 'errors' => ['Sila pilih bilik.']]);
        }
        $date = query('date');
        $weeks = max(1, min((int) setting('max_recurring_weeks', '16'), (int) query('repeat_weeks', '1')));
        $errors = [];
        if (!valid_date($date)) {
            json_response(['ok' => false, 'errors' => ['Tarikh tidak sah.']]);
        }
        for ($i = 0; $i < $weeks; $i++) {
            $d = date('Y-m-d', strtotime("$date +{$i} week"));
            foreach (validate_slot($room, $d, query('start'), query('end'), $user, (int) query('exclude') ?: null) as $err) {
                $errors[] = ($weeks > 1 ? fmt_date($d, false, true) . ': ' : '') . $err;
            }
        }
        json_response([
            'ok'       => !$errors,
            'errors'   => array_values(array_unique($errors)),
            'approval' => room_needs_approval($room) && $user['role'] !== 'admin',
        ]);

    // Rooms that are free right now / at a given time
    case 'free-now':
        $date = date('Y-m-d');
        $t = date('H:i');
        $st = db()->prepare("SELECT r.* FROM rooms r WHERE r.status = 'active' AND NOT EXISTS (
            SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.date = ? AND b.status IN ('pending','approved') AND b.start_time <= ? AND b.end_time > ?)
            ORDER BY r.name");
        $st->execute([$date, $t, $t]);
        json_response($st->fetchAll());

    case 'notifications-read':
        if (!is_post()) {
            json_response(['error' => 'Kaedah tidak dibenarkan.'], 405);
        }
        verify_csrf();
        db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$user['id']]);
        json_response(['ok' => true]);

    default:
        json_response(['error' => 'Tindakan tidak dikenali.'], 404);
}
