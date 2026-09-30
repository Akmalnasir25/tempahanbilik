<?php
declare(strict_types=1);

$user = current_user();
$pdo = db();
$today = date('Y-m-d');
$now = date('H:i');
$monthStart = date('Y-m-01');
$monthEnd = date('Y-m-t');

$one = function (string $sql, array $params = []) use ($pdo) {
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return (int) $st->fetchColumn();
};

// Rooms free right now
$st = $pdo->prepare("SELECT r.*, (SELECT MIN(b.start_time) FROM bookings b WHERE b.room_id = r.id AND b.date = ? AND b.status IN ('pending','approved') AND b.start_time > ?) AS next_start
    FROM rooms r WHERE r.status = 'active'
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.date = ? AND b.status IN ('pending','approved') AND b.start_time <= ? AND b.end_time > ?)
      AND NOT EXISTS (SELECT 1 FROM closures c WHERE (c.room_id IS NULL OR c.room_id = r.id) AND ? BETWEEN c.start_date AND c.end_date)
    ORDER BY r.name");
$st->execute([$today, $now, $today, $now, $now, $today]);
$freeNow = $st->fetchAll();
$activeRooms = $one("SELECT COUNT(*) FROM rooms WHERE status = 'active'");

// My upcoming bookings
$st = $pdo->prepare("SELECT b.*, r.name AS room_name, r.color AS room_color, r.location AS room_location FROM bookings b JOIN rooms r ON r.id = b.room_id
    WHERE b.user_id = ? AND b.status IN ('pending','approved') AND (b.date > ? OR (b.date = ? AND b.end_time > ?))
    ORDER BY b.date, b.start_time LIMIT 6");
$st->execute([$user['id'], $today, $today, $now]);
$upcoming = $st->fetchAll();

$todayBookings = bookings_between($today, $today);

if (is_admin()) {
    $stats = [
        ['Tempahan Hari Ini', count($todayBookings), 'calendar-check', 'primary', url('admin/bookings', ['from' => $today, 'to' => $today])],
        ['Menunggu Kelulusan', $one("SELECT COUNT(*) FROM bookings WHERE status = 'pending'"), 'hourglass-split', 'warning', url('admin/bookings', ['status' => 'pending'])],
        ['Tempahan Bulan Ini', $one("SELECT COUNT(*) FROM bookings WHERE status IN ('pending','approved') AND date BETWEEN ? AND ?", [$monthStart, $monthEnd]), 'graph-up-arrow', 'success', url('admin/reports')],
        ['Pengguna Aktif', $one("SELECT COUNT(*) FROM users WHERE status = 'active'"), 'people', 'info', url('admin/users')],
    ];
    $pending = $pdo->query("SELECT b.*, r.name AS room_name, r.color AS room_color, u.name AS user_name FROM bookings b
        JOIN rooms r ON r.id = b.room_id JOIN users u ON u.id = b.user_id WHERE b.status = 'pending' ORDER BY b.date, b.start_time LIMIT 6")->fetchAll();

    // Chart data: last 6 months trend
    $trendLabels = $trendData = [];
    for ($i = 5; $i >= 0; $i--) {
        $m = strtotime(date('Y-m-01') . " -{$i} month");
        $trendLabels[] = MALAY_MONTHS_SHORT[(int) date('n', $m)] . ' ' . date('y', $m);
        $trendData[] = $one("SELECT COUNT(*) FROM bookings WHERE status IN ('approved','pending') AND strftime('%Y-%m', date) = ?", [date('Y-m', $m)]);
    }
    $st = $pdo->prepare("SELECT r.code, r.name, r.color, COUNT(b.id) AS n FROM rooms r
        LEFT JOIN bookings b ON b.room_id = r.id AND b.status IN ('approved','pending') AND b.date BETWEEN ? AND ?
        WHERE r.status != 'inactive' GROUP BY r.id ORDER BY n DESC, r.name");
    $st->execute([$monthStart, $monthEnd]);
    $perRoom = $st->fetchAll();
} else {
    $stats = [
        ['Tempahan Akan Datang', $one("SELECT COUNT(*) FROM bookings WHERE user_id = ? AND status IN ('pending','approved') AND date >= ?", [$user['id'], $today]), 'calendar-event', 'primary', url('my-bookings')],
        ['Menunggu Kelulusan', $one("SELECT COUNT(*) FROM bookings WHERE user_id = ? AND status = 'pending' AND date >= ?", [$user['id'], $today]), 'hourglass-split', 'warning', url('my-bookings')],
        ['Tempahan Bulan Ini', $one("SELECT COUNT(*) FROM bookings WHERE user_id = ? AND status IN ('pending','approved') AND date BETWEEN ? AND ?", [$user['id'], $monthStart, $monthEnd]), 'graph-up-arrow', 'success', url('my-bookings', ['tab' => 'all'])],
        ['Bilik Kosong Sekarang', count($freeNow) . '<small class="fs-6 text-body-secondary fw-medium"> / ' . $activeRooms . '</small>', 'door-open', 'info', url('availability')],
    ];
}

render_header('Papan Pemuka', 'dashboard');
?>
<div class="hero-card mb-4">
    <div class="row align-items-center g-3">
        <div class="col-lg-7">
            <div class="text-white-50 small fw-semibold text-uppercase ls-1 mb-1"><?= e(setting('school_name')) ?></div>
            <h1 class="h3 fw-bold text-white mb-2"><?= greeting() ?>, <?= e($user['name']) ?></h1>
            <p class="text-white-50 mb-0">
                <?php if (count($todayBookings)): ?>
                    Terdapat <strong class="text-white"><?= count($todayBookings) ?> tempahan</strong> bilik khas hari ini. <?= count($freeNow) ?> bilik kosong pada masa ini.
                <?php else: ?>
                    Tiada tempahan bilik khas hari ini. Semua bilik sedia untuk ditempah.
                <?php endif; ?>
            </p>
        </div>
        <div class="col-lg-5">
            <div class="d-flex flex-wrap gap-2 justify-content-lg-end">
                <a href="<?= url('book') ?>" class="btn btn-white fw-semibold"><i class="bi bi-plus-lg me-1"></i>Tempah Bilik</a>
                <a href="<?= url('availability') ?>" class="btn btn-outline-light"><i class="bi bi-search me-1"></i>Semak Kekosongan</a>
                <a href="<?= url('calendar') ?>" class="btn btn-outline-light"><i class="bi bi-calendar3 me-1"></i>Jadual</a>
            </div>
        </div>
    </div>
</div>

<div class="row g-3 mb-4">
    <?php foreach ($stats as [$label, $value, $icon, $color, $link]): ?>
        <div class="col-6 col-xl-3">
            <a href="<?= $link ?>" class="stat-card">
                <div class="stat-icon bg-<?= $color ?>-subtle text-<?= $color ?>-emphasis"><i class="bi bi-<?= $icon ?>"></i></div>
                <div>
                    <div class="stat-value"><?= $value ?></div>
                    <div class="stat-label"><?= e($label) ?></div>
                </div>
            </a>
        </div>
    <?php endforeach; ?>
</div>

<div class="row g-4">
    <div class="col-xl-8">
        <?php if (is_admin()): ?>
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h2 class="card-title"><i class="bi bi-hourglass-split text-warning me-2"></i>Menunggu Kelulusan</h2>
                    <a href="<?= url('admin/bookings', ['status' => 'pending']) ?>" class="btn btn-sm btn-light">Lihat semua</a>
                </div>
                <?php if (!$pending): ?>
                    <div class="empty-state py-4"><i class="bi bi-check2-all"></i><p>Tiada tempahan menunggu kelulusan.</p></div>
                <?php else: ?>
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <tbody>
                            <?php foreach ($pending as $b): ?>
                                <tr>
                                    <td><span class="room-dot" style="--c: <?= e($b['room_color']) ?>"></span><strong><?= e($b['room_name']) ?></strong><div class="small text-body-secondary"><?= e($b['purpose']) ?></div></td>
                                    <td class="small"><?= fmt_date($b['date'], true, true) ?><div class="text-body-secondary"><?= e($b['start_time']) ?> – <?= e($b['end_time']) ?></div></td>
                                    <td class="small"><?= e($b['user_name']) ?></td>
                                    <td class="text-end text-nowrap">
                                        <form method="post" action="<?= url('booking', ['id' => $b['id']]) ?>" class="d-inline"><?= csrf_field() ?>
                                            <input type="hidden" name="action" value="approved"><input type="hidden" name="return" value="dashboard">
                                            <button class="btn btn-sm btn-success" title="Luluskan"><i class="bi bi-check-lg"></i></button>
                                        </form>
                                        <a href="<?= url('booking', ['id' => $b['id']]) ?>" class="btn btn-sm btn-light" title="Butiran"><i class="bi bi-eye"></i></a>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                            </tbody>
                        </table>
                    </div>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="card-title"><i class="bi bi-clock-history text-primary me-2"></i>Jadual Hari Ini</h2>
                <a href="<?= url('calendar', ['view' => 'day']) ?>" class="btn btn-sm btn-light">Paparan kalendar</a>
            </div>
            <div class="card-body">
                <?php if (!$todayBookings): ?>
                    <div class="empty-state py-3"><i class="bi bi-calendar2-check"></i><p>Tiada tempahan untuk hari ini.</p></div>
                <?php else: ?>
                    <ul class="timeline">
                        <?php foreach ($todayBookings as $b):
                            $state = $b['end_time'] <= $now ? 'past' : ($b['start_time'] <= $now ? 'live' : 'next'); ?>
                            <li class="timeline-item <?= $state ?>">
                                <div class="timeline-time"><?= e($b['start_time']) ?><small><?= e($b['end_time']) ?></small></div>
                                <div class="timeline-body" style="--c: <?= e($b['room_color']) ?>">
                                    <div class="d-flex justify-content-between gap-2 flex-wrap">
                                        <strong><?= e($b['room_name']) ?></strong>
                                        <span>
                                            <?php if ($state === 'live'): ?><span class="badge text-bg-danger live-badge">Sedang berlangsung</span><?php endif; ?>
                                            <?php if ($b['status'] === 'pending'): ?><?= status_badge('pending') ?><?php endif; ?>
                                        </span>
                                    </div>
                                    <div class="small"><?= e($b['purpose']) ?><?= $b['class_name'] ? ' · ' . e($b['class_name']) : '' ?></div>
                                    <div class="small text-body-secondary"><i class="bi bi-person me-1"></i><?= e($b['user_name']) ?></div>
                                </div>
                            </li>
                        <?php endforeach; ?>
                    </ul>
                <?php endif; ?>
            </div>
        </div>

        <?php if (is_admin()): ?>
            <div class="row g-4">
                <div class="col-md-7">
                    <div class="card h-100">
                        <div class="card-header"><h2 class="card-title">Trend Tempahan (6 bulan)</h2></div>
                        <div class="card-body"><canvas id="trendChart" height="220"></canvas></div>
                    </div>
                </div>
                <div class="col-md-5">
                    <div class="card h-100">
                        <div class="card-header"><h2 class="card-title">Penggunaan Bilik Bulan Ini</h2></div>
                        <div class="card-body"><canvas id="roomChart" height="220"></canvas></div>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <div class="col-xl-4">
        <div class="card mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="card-title"><i class="bi bi-journal-bookmark text-primary me-2"></i>Tempahan Saya</h2>
                <a href="<?= url('my-bookings') ?>" class="small">Semua</a>
            </div>
            <div class="list-group list-group-flush">
                <?php if (!$upcoming): ?>
                    <div class="empty-state py-4"><i class="bi bi-calendar-plus"></i><p>Anda tiada tempahan akan datang.</p>
                        <a href="<?= url('book') ?>" class="btn btn-sm btn-primary">Buat tempahan</a></div>
                <?php endif; ?>
                <?php foreach ($upcoming as $b): ?>
                    <a href="<?= url('booking', ['id' => $b['id']]) ?>" class="list-group-item list-group-item-action d-flex gap-3 align-items-center py-3">
                        <div class="date-tile" style="--c: <?= e($b['room_color']) ?>">
                            <span><?= MALAY_MONTHS_SHORT[(int) date('n', strtotime($b['date']))] ?></span>
                            <strong><?= date('j', strtotime($b['date'])) ?></strong>
                        </div>
                        <div class="flex-grow-1 min-w-0">
                            <div class="fw-semibold text-truncate"><?= e($b['room_name']) ?></div>
                            <div class="small text-body-secondary"><?= e(day_name($b['date'])) ?> · <?= e($b['start_time']) ?> – <?= e($b['end_time']) ?></div>
                        </div>
                        <?= $b['status'] === 'pending' ? status_badge('pending') : '' ?>
                    </a>
                <?php endforeach; ?>
            </div>
        </div>

        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h2 class="card-title"><i class="bi bi-door-open text-success me-2"></i>Kosong Sekarang</h2>
                <span class="badge badge-soft-success"><?= count($freeNow) ?> / <?= $activeRooms ?></span>
            </div>
            <div class="list-group list-group-flush free-list">
                <?php if (!$freeNow): ?>
                    <div class="empty-state py-4"><i class="bi bi-x-octagon"></i><p>Semua bilik sedang digunakan.</p></div>
                <?php endif; ?>
                <?php foreach ($freeNow as $r): ?>
                    <div class="list-group-item d-flex align-items-center gap-2 py-2">
                        <span class="room-dot" style="--c: <?= e($r['color']) ?>"></span>
                        <div class="flex-grow-1 min-w-0">
                            <div class="small fw-semibold text-truncate"><?= e($r['name']) ?></div>
                            <div class="xsmall text-body-secondary"><?= $r['next_start'] ? 'Kosong hingga ' . e($r['next_start']) : 'Kosong sepanjang hari' ?></div>
                        </div>
                        <a href="<?= url('book', ['room_id' => $r['id'], 'date' => $today]) ?>" class="btn btn-sm btn-outline-primary">Tempah</a>
                    </div>
                <?php endforeach; ?>
            </div>
        </div>
    </div>
</div>
<?php
$scripts = '';
if (is_admin()) {
    $scripts = '<script src="assets/vendor/chartjs/chart.umd.min.js"></script><script>
    TB.charts.line("trendChart", ' . js($trendLabels) . ', ' . js($trendData) . ', "Tempahan");
    TB.charts.bar("roomChart", ' . js(array_column($perRoom, 'code')) . ', ' . js(array_map('intval', array_column($perRoom, 'n'))) . ', ' . js(array_column($perRoom, 'color')) . ', ' . js(array_column($perRoom, 'name')) . ');
    </script>';
}
render_footer($scripts);
