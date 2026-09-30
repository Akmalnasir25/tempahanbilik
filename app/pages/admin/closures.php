<?php
declare(strict_types=1);

$admin = current_user();

if (is_post()) {
    if (input('action') === 'delete') {
        db()->prepare('DELETE FROM closures WHERE id = ?')->execute([(int) input('id')]);
        audit('closure.delete', '#' . input('id'));
        flash('success', 'Penutupan dipadam.');
        redirect('admin/closures');
    }

    $roomId = (int) input('room_id') ?: null;
    $start = input('start_date');
    $end = input('end_date') ?: $start;
    $reason = input('reason');
    if (!valid_date($start) || !valid_date($end) || $end < $start) {
        flash('danger', 'Julat tarikh tidak sah.');
    } elseif ($reason === '') {
        flash('danger', 'Sila nyatakan sebab penutupan.');
    } else {
        db()->prepare('INSERT INTO closures(room_id, start_date, end_date, reason, created_by) VALUES (?,?,?,?,?)')
            ->execute([$roomId, $start, $end, $reason, $admin['id']]);
        $room = $roomId ? find_room($roomId) : null;
        audit('closure.create', ($room['name'] ?? 'Semua bilik') . " {$start} – {$end}: {$reason}");

        $cancelled = 0;
        if (!empty($_POST['cancel_existing'])) {
            $sql = "SELECT id FROM bookings WHERE status IN ('pending','approved') AND date BETWEEN ? AND ?" . ($roomId ? ' AND room_id = ?' : '');
            $st = db()->prepare($sql);
            $st->execute($roomId ? [$start, $end, $roomId] : [$start, $end]);
            foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $bid) {
                if (($b = find_booking((int) $bid)) && change_booking_status($b, 'cancelled', $admin, 'Bilik ditutup: ' . $reason)['ok']) {
                    $cancelled++;
                }
            }
        }
        flash('success', 'Penutupan berjaya ditambah.' . ($cancelled ? " {$cancelled} tempahan terlibat telah dibatalkan dan guru dimaklumkan." : ''));
    }
    redirect('admin/closures');
}

$rooms = all_rooms();
$showPast = query('past') === '1';
$closures = db()->query('SELECT c.*, r.name AS room_name, r.color AS room_color, u.name AS creator,
        (SELECT COUNT(*) FROM bookings b WHERE b.status IN (\'pending\',\'approved\') AND b.date BETWEEN c.start_date AND c.end_date AND (c.room_id IS NULL OR b.room_id = c.room_id)) AS affected
    FROM closures c LEFT JOIN rooms r ON r.id = c.room_id LEFT JOIN users u ON u.id = c.created_by
    WHERE ' . ($showPast ? 'c.end_date < date(\'now\',\'localtime\')' : 'c.end_date >= date(\'now\',\'localtime\')') . '
    ORDER BY c.start_date' . ($showPast ? ' DESC' : ''))->fetchAll();

render_header('Penutupan & Cuti', 'admin/closures');
page_title('Penutupan & Cuti', 'Tutup bilik untuk cuti umum, cuti sekolah, peperiksaan atau penyelenggaraan. Tempahan tidak dibenarkan pada tarikh ditutup.');
?>
<div class="row g-4">
    <div class="col-lg-4">
        <div class="card">
            <div class="card-header"><h2 class="card-title"><i class="bi bi-calendar-x me-2"></i>Tambah Penutupan</h2></div>
            <div class="card-body">
                <form method="post">
                    <?= csrf_field() ?>
                    <div class="mb-3"><label class="form-label fw-semibold">Bilik</label>
                        <select name="room_id" class="form-select"><option value="">Semua bilik (cuti / sekolah ditutup)</option>
                            <?php foreach ($rooms as $r): ?><option value="<?= $r['id'] ?>"><?= e($r['name']) ?></option><?php endforeach; ?></select></div>
                    <div class="row g-2 mb-3">
                        <div class="col"><label class="form-label fw-semibold">Dari</label><input type="date" name="start_date" class="form-control" required></div>
                        <div class="col"><label class="form-label fw-semibold">Hingga</label><input type="date" name="end_date" class="form-control"></div>
                    </div>
                    <div class="mb-3"><label class="form-label fw-semibold">Sebab</label>
                        <input name="reason" class="form-control" required list="reasonList" placeholder="cth. Cuti Hari Malaysia">
                        <datalist id="reasonList"><option value="Cuti Umum"><option value="Cuti Sekolah"><option value="Penyelenggaraan"><option value="Peperiksaan SPM"><option value="Program Sekolah"></datalist></div>
                    <div class="form-check mb-3">
                        <input class="form-check-input" type="checkbox" name="cancel_existing" value="1" id="ce">
                        <label class="form-check-label small" for="ce">Batalkan tempahan sedia ada dalam tempoh ini &amp; maklumkan guru</label>
                    </div>
                    <button class="btn btn-primary w-100">Tambah</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-8">
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="card-title"><?= $showPast ? 'Penutupan Lepas' : 'Penutupan Semasa & Akan Datang' ?></h2>
                <a href="<?= url('admin/closures', $showPast ? [] : ['past' => 1]) ?>" class="btn btn-sm btn-light"><?= $showPast ? 'Lihat akan datang' : 'Lihat lepas' ?></a>
            </div>
            <?php if (!$closures): ?>
                <div class="empty-state py-5"><i class="bi bi-calendar-check"></i><p>Tiada penutupan direkodkan.</p></div>
            <?php else: ?>
                <div class="table-responsive">
                    <table class="table align-middle mb-0">
                        <thead><tr><th>Tarikh</th><th>Bilik</th><th>Sebab</th><th class="text-center">Tempahan terjejas</th><th></th></tr></thead>
                        <tbody>
                        <?php foreach ($closures as $c): ?>
                            <tr>
                                <td class="small text-nowrap"><strong><?= fmt_date($c['start_date'], false, true) ?></strong><?= $c['end_date'] !== $c['start_date'] ? '<br>hingga ' . fmt_date($c['end_date'], false, true) : '' ?></td>
                                <td class="small"><?= $c['room_name'] ? '<span class="room-dot" style="--c:' . e($c['room_color']) . '"></span>' . e($c['room_name']) : '<span class="badge badge-soft-danger">Semua bilik</span>' ?></td>
                                <td class="small"><?= e($c['reason']) ?><div class="xsmall text-body-secondary">oleh <?= e($c['creator'] ?? '-') ?></div></td>
                                <td class="text-center"><?= $c['affected'] ? '<span class="badge badge-soft-warning">' . (int) $c['affected'] . '</span>' : '<span class="text-body-tertiary">0</span>' ?></td>
                                <td class="text-end">
                                    <form method="post" data-confirm="Padam penutupan ini? Bilik akan dibuka semula untuk tempahan."><?= csrf_field() ?>
                                        <input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $c['id'] ?>">
                                        <button class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button></form>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
    </div>
</div>
<?php render_footer();
