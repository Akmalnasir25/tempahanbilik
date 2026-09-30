<?php
declare(strict_types=1);

$user = current_user();
$tab = query('tab', 'upcoming');
$q = query('q');
$today = date('Y-m-d');
$now = date('H:i');

$where = 'b.user_id = ?';
$params = [$user['id']];
switch ($tab) {
    case 'past':
        $where .= " AND b.status = 'approved' AND (b.date < ? OR (b.date = ? AND b.end_time <= ?))";
        array_push($params, $today, $today, $now);
        $order = 'b.date DESC, b.start_time DESC';
        break;
    case 'closed':
        $where .= " AND b.status IN ('cancelled','rejected')";
        $order = 'b.date DESC, b.start_time DESC';
        break;
    case 'all':
        $order = 'b.date DESC, b.start_time DESC';
        break;
    default:
        $tab = 'upcoming';
        $where .= " AND b.status IN ('pending','approved') AND (b.date > ? OR (b.date = ? AND b.end_time > ?))";
        array_push($params, $today, $today, $now);
        $order = 'b.date, b.start_time';
}
if ($q !== '') {
    $where .= ' AND (b.purpose LIKE ? OR b.ref_no LIKE ? OR r.name LIKE ? OR b.class_name LIKE ?)';
    array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
}

$st = db()->prepare("SELECT COUNT(*) FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE $where");
$st->execute($params);
$pg = paginate((int) $st->fetchColumn(), 15);

$st = db()->prepare("SELECT b.*, r.name AS room_name, r.color AS room_color, r.location AS room_location
    FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE $where ORDER BY $order LIMIT {$pg['limit']} OFFSET {$pg['offset']}");
$st->execute($params);
$rows = $st->fetchAll();

$counts = db()->prepare("SELECT
    SUM(CASE WHEN status IN ('pending','approved') AND (date > :d OR (date = :d AND end_time > :t)) THEN 1 ELSE 0 END) AS upcoming,
    SUM(CASE WHEN status = 'approved' AND (date < :d OR (date = :d AND end_time <= :t)) THEN 1 ELSE 0 END) AS past,
    SUM(CASE WHEN status IN ('cancelled','rejected') THEN 1 ELSE 0 END) AS closed,
    COUNT(*) AS total FROM bookings WHERE user_id = :u");
$counts->execute([':d' => $today, ':t' => $now, ':u' => $user['id']]);
$counts = array_map('intval', $counts->fetch());

$tabs = ['upcoming' => ['Akan Datang', $counts['upcoming']], 'past' => ['Selesai', $counts['past']], 'closed' => ['Dibatal / Ditolak', $counts['closed']], 'all' => ['Semua', $counts['total']]];

render_header('Tempahan Saya', 'my-bookings');
page_title('Tempahan Saya', 'Urus semua tempahan bilik khas anda.', '<a href="' . url('book') . '" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tempahan Baharu</a>');
?>
<div class="card">
    <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <ul class="nav nav-pills nav-pills-soft">
            <?php foreach ($tabs as $k => [$label, $n]): ?>
                <li class="nav-item"><a class="nav-link<?= $tab === $k ? ' active' : '' ?>" href="<?= url('my-bookings', ['tab' => $k]) ?>"><?= e($label) ?> <span class="badge rounded-pill"><?= $n ?></span></a></li>
            <?php endforeach; ?>
        </ul>
        <form class="d-flex" method="get">
            <input type="hidden" name="p" value="my-bookings"><input type="hidden" name="tab" value="<?= e($tab) ?>">
            <div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="<?= e($q) ?>" placeholder="Cari tempahan…"></div>
        </form>
    </div>
    <?php if (!$rows): ?>
        <div class="empty-state py-5"><i class="bi bi-inbox"></i><p>Tiada tempahan dalam senarai ini.</p>
            <a href="<?= url('book') ?>" class="btn btn-primary btn-sm">Buat tempahan</a></div>
    <?php else: ?>
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead><tr><th>Tarikh &amp; Masa</th><th>Bilik</th><th>Tujuan</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead>
                <tbody>
                <?php foreach ($rows as $b): $canModify = can_modify_booking($b, $user); ?>
                    <tr>
                        <td class="text-nowrap">
                            <div class="fw-semibold"><?= fmt_date($b['date'], true, true) ?></div>
                            <div class="small text-body-secondary"><?= e($b['start_time']) ?> – <?= e($b['end_time']) ?></div>
                        </td>
                        <td><span class="room-dot" style="--c: <?= e($b['room_color']) ?>"></span><?= e($b['room_name']) ?><div class="xsmall text-body-secondary"><?= e($b['room_location']) ?></div></td>
                        <td>
                            <div><?= e($b['purpose']) ?></div>
                            <div class="xsmall text-body-secondary"><?= e($b['ref_no']) ?><?= $b['class_name'] ? ' · ' . e($b['class_name']) : '' ?><?= $b['series_id'] ? ' · <i class="bi bi-arrow-repeat"></i> berulang' : '' ?></div>
                        </td>
                        <td><?= status_badge($b['status']) ?></td>
                        <td class="text-end text-nowrap">
                            <a href="<?= url('booking', ['id' => $b['id']]) ?>" class="btn btn-sm btn-light" title="Butiran"><i class="bi bi-eye"></i></a>
                            <?php if ($canModify): ?>
                                <a href="<?= url('book', ['id' => $b['id']]) ?>" class="btn btn-sm btn-light" title="Pinda"><i class="bi bi-pencil"></i></a>
                                <form method="post" action="<?= url('booking', ['id' => $b['id']]) ?>" class="d-inline" data-confirm="Batalkan tempahan <?= e($b['room_name']) ?> pada <?= fmt_date($b['date'], false, true) ?>?">
                                    <?= csrf_field() ?><input type="hidden" name="action" value="cancelled"><input type="hidden" name="return" value="my-bookings">
                                    <button class="btn btn-sm btn-light text-danger" title="Batal"><i class="bi bi-x-lg"></i></button>
                                </form>
                            <?php endif; ?>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <div class="card-footer d-flex justify-content-between align-items-center">
            <span class="small text-body-secondary"><?= $pg['total'] ?> rekod</span>
            <?= pagination_links($pg) ?>
        </div>
    <?php endif; ?>
</div>
<?php render_footer();
