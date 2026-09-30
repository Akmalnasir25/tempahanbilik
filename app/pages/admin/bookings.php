<?php
declare(strict_types=1);

$admin = current_user();

// Bulk actions
if (is_post()) {
    $action = input('bulk_action');
    $ids = array_map('intval', (array) ($_POST['ids'] ?? []));
    $remark = mb_substr(input('remark'), 0, 300);
    $done = 0;
    $errors = [];
    if (in_array($action, ['approved', 'rejected', 'cancelled'], true)) {
        foreach ($ids as $id) {
            if ($b = find_booking($id)) {
                $res = change_booking_status($b, $action, $admin, $remark);
                if ($res['ok']) {
                    $done++;
                } else {
                    $errors[] = $b['ref_no'] . ': ' . $res['error'];
                }
            }
        }
    }
    if ($done) flash('success', "{$done} tempahan dikemas kini.");
    if ($errors) flash('warning', implode(' ', array_slice($errors, 0, 5)));
    if (!$done && !$errors) flash('warning', 'Tiada tempahan dipilih.');
    redirect_back('admin/bookings');
}

$f = [
    'from'    => query('from'),
    'to'      => query('to'),
    'room_id' => (int) query('room_id'),
    'status'  => query('status'),
    'user_id' => (int) query('user_id'),
    'q'       => query('q'),
];
$where = ['1=1'];
$params = [];
if (valid_date($f['from'])) { $where[] = 'b.date >= ?'; $params[] = $f['from']; }
if (valid_date($f['to'])) { $where[] = 'b.date <= ?'; $params[] = $f['to']; }
if ($f['room_id']) { $where[] = 'b.room_id = ?'; $params[] = $f['room_id']; }
if (isset(STATUS_LABELS[$f['status']])) { $where[] = 'b.status = ?'; $params[] = $f['status']; }
if ($f['user_id']) { $where[] = 'b.user_id = ?'; $params[] = $f['user_id']; }
if ($f['q'] !== '') {
    $where[] = '(b.ref_no LIKE ? OR b.purpose LIKE ? OR u.name LIKE ? OR b.class_name LIKE ? OR b.subject LIKE ?)';
    array_push($params, ...array_fill(0, 5, '%' . $f['q'] . '%'));
}
$whereSql = implode(' AND ', $where);
$base = "FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN users u ON u.id = b.user_id WHERE $whereSql";
$order = $f['status'] === 'pending' ? 'b.date ASC, b.start_time ASC' : 'b.date DESC, b.start_time DESC';

if (query('export') === 'csv') {
    $st = db()->prepare("SELECT b.*, r.name AS room_name, u.name AS user_name, u.department $base ORDER BY $order");
    $st->execute($params);
    audit('export.bookings', 'CSV');
    csv_download('rekod-tempahan-' . date('Ymd-His') . '.csv',
        ['No. Rujukan', 'Tarikh', 'Hari', 'Mula', 'Tamat', 'Bilik', 'Guru', 'Panitia/Unit', 'Tujuan', 'Kelas', 'Subjek', 'Peserta', 'Status', 'Catatan', 'Catatan Pentadbir', 'Dibuat'],
        (function () use ($st) {
            while ($b = $st->fetch()) {
                yield [$b['ref_no'], $b['date'], day_name($b['date']), $b['start_time'], $b['end_time'], $b['room_name'], $b['user_name'], $b['department'],
                    $b['purpose'], $b['class_name'], $b['subject'], $b['attendees'], STATUS_LABELS[$b['status']][0], $b['notes'], $b['admin_remark'], $b['created_at']];
            }
        })());
}

$st = db()->prepare("SELECT COUNT(*) $base");
$st->execute($params);
$pg = paginate((int) $st->fetchColumn(), 25);
$st = db()->prepare("SELECT b.*, r.name AS room_name, r.color AS room_color, u.name AS user_name $base ORDER BY $order LIMIT {$pg['limit']} OFFSET {$pg['offset']}");
$st->execute($params);
$rows = $st->fetchAll();

$statusCounts = db()->query('SELECT status, COUNT(*) FROM bookings GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);
$rooms = all_rooms();
$users = db()->query('SELECT id, name FROM users ORDER BY name')->fetchAll();
$exportParams = array_filter($f) + ['export' => 'csv'];

render_header('Rekod Tempahan', 'admin/bookings');
page_title('Rekod Tempahan', 'Semak, luluskan dan urus semua tempahan bilik khas.',
    '<a href="' . url('admin/bookings', $exportParams) . '" class="btn btn-light"><i class="bi bi-filetype-csv me-1"></i>Eksport CSV</a>
     <button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button>');
?>
<div class="d-flex flex-wrap gap-2 mb-3 no-print">
    <a href="<?= url('admin/bookings') ?>" class="btn btn-sm <?= $f['status'] === '' ? 'btn-primary' : 'btn-light' ?>">Semua <span class="opacity-75">(<?= array_sum($statusCounts) ?>)</span></a>
    <?php foreach (STATUS_LABELS as $k => [$label, $color]): ?>
        <a href="<?= url('admin/bookings', ['status' => $k]) ?>" class="btn btn-sm <?= $f['status'] === $k ? 'btn-' . $color : 'btn-light' ?>"><?= e($label) ?> <span class="opacity-75">(<?= (int) ($statusCounts[$k] ?? 0) ?>)</span></a>
    <?php endforeach; ?>
</div>

<div class="card mb-3 no-print">
    <div class="card-body">
        <form class="row g-2 align-items-end" method="get">
            <input type="hidden" name="p" value="admin/bookings">
            <?php if ($f['status']): ?><input type="hidden" name="status" value="<?= e($f['status']) ?>"><?php endif; ?>
            <div class="col-6 col-md-2"><label class="form-label small fw-semibold">Dari</label><input type="date" name="from" class="form-control form-control-sm" value="<?= e($f['from']) ?>"></div>
            <div class="col-6 col-md-2"><label class="form-label small fw-semibold">Hingga</label><input type="date" name="to" class="form-control form-control-sm" value="<?= e($f['to']) ?>"></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Bilik</label>
                <select name="room_id" class="form-select form-select-sm"><option value="">Semua</option>
                    <?php foreach ($rooms as $r): ?><option value="<?= $r['id'] ?>" <?= $f['room_id'] === (int) $r['id'] ? 'selected' : '' ?>><?= e($r['name']) ?></option><?php endforeach; ?>
                </select></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Guru</label>
                <select name="user_id" class="form-select form-select-sm"><option value="">Semua</option>
                    <?php foreach ($users as $u): ?><option value="<?= $u['id'] ?>" <?= $f['user_id'] === (int) $u['id'] ? 'selected' : '' ?>><?= e($u['name']) ?></option><?php endforeach; ?>
                </select></div>
            <div class="col-md-2"><label class="form-label small fw-semibold">Carian</label><input name="q" class="form-control form-control-sm" value="<?= e($f['q']) ?>" placeholder="No. rujukan, tujuan…"></div>
            <div class="col-md-2 d-flex gap-1">
                <button class="btn btn-sm btn-primary flex-grow-1"><i class="bi bi-funnel me-1"></i>Tapis</button>
                <a href="<?= url('admin/bookings') ?>" class="btn btn-sm btn-light" title="Set semula"><i class="bi bi-arrow-counterclockwise"></i></a>
            </div>
        </form>
    </div>
</div>

<form method="post" id="bulkForm">
    <?= csrf_field() ?>
    <div class="card">
        <div class="card-header d-flex flex-wrap gap-2 align-items-center no-print bulk-bar">
            <span class="small text-body-secondary"><span id="selCount">0</span> dipilih</span>
            <input name="remark" class="form-control form-control-sm" style="max-width: 260px" placeholder="Catatan (pilihan)">
            <button name="bulk_action" value="approved" class="btn btn-sm btn-success" data-bulk><i class="bi bi-check-lg me-1"></i>Luluskan</button>
            <button name="bulk_action" value="rejected" class="btn btn-sm btn-outline-danger" data-bulk><i class="bi bi-x-lg me-1"></i>Tolak</button>
            <button name="bulk_action" value="cancelled" class="btn btn-sm btn-outline-secondary" data-bulk><i class="bi bi-slash-circle me-1"></i>Batalkan</button>
            <span class="ms-auto small text-body-secondary"><?= $pg['total'] ?> rekod</span>
        </div>
        <div class="print-only p-3">
            <h2 class="h5 mb-0">Rekod Tempahan Bilik Khas – <?= e(setting('school_name')) ?></h2>
            <div class="small">Dicetak pada <?= fmt_datetime(date('Y-m-d H:i:s')) ?></div>
        </div>
        <?php if (!$rows): ?>
            <div class="empty-state py-5"><i class="bi bi-inbox"></i><p>Tiada rekod tempahan ditemui.</p></div>
        <?php else: ?>
            <div class="table-responsive">
                <table class="table table-hover align-middle mb-0">
                    <thead>
                    <tr>
                        <th class="no-print" style="width: 36px"><input type="checkbox" class="form-check-input" id="checkAll"></th>
                        <th>Rujukan</th><th>Tarikh &amp; Masa</th><th>Bilik</th><th>Guru</th><th>Tujuan</th><th>Status</th><th class="no-print"></th>
                    </tr>
                    </thead>
                    <tbody>
                    <?php foreach ($rows as $b): ?>
                        <tr>
                            <td class="no-print"><input type="checkbox" class="form-check-input row-check" name="ids[]" value="<?= $b['id'] ?>"></td>
                            <td class="font-monospace small"><?= e($b['ref_no']) ?></td>
                            <td class="text-nowrap"><div class="fw-semibold small"><?= fmt_date($b['date'], true, true) ?></div><div class="xsmall text-body-secondary"><?= e($b['start_time']) ?> – <?= e($b['end_time']) ?></div></td>
                            <td class="small"><span class="room-dot" style="--c: <?= e($b['room_color']) ?>"></span><?= e($b['room_name']) ?></td>
                            <td class="small"><?= e($b['user_name']) ?></td>
                            <td class="small"><?= e($b['purpose']) ?><?php if ($b['class_name']): ?><div class="xsmall text-body-secondary"><?= e($b['class_name']) ?><?= $b['subject'] ? ' · ' . e($b['subject']) : '' ?></div><?php endif; ?></td>
                            <td><?= status_badge($b['status']) ?></td>
                            <td class="text-end no-print"><a href="<?= url('booking', ['id' => $b['id']]) ?>" class="btn btn-sm btn-light"><i class="bi bi-chevron-right"></i></a></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="card-footer no-print"><?= pagination_links($pg) ?></div>
        <?php endif; ?>
    </div>
</form>
<?php render_footer('<script>TB.bulkSelect();</script>');
