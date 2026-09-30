<?php
declare(strict_types=1);

// Full-screen "today" board for a lobby TV / staff room screen. Auto-refreshes.
if (setting('public_display') !== '1' && !current_user()) {
    redirect('login');
}

$today = date('Y-m-d');
$now = date('H:i');
$rooms = all_rooms(true);
$bookings = bookings_between($today, $today);
$byRoom = [];
foreach ($bookings as $b) {
    $byRoom[$b['room_id']][] = $b;
}
?>
<!doctype html>
<html lang="ms" data-bs-theme="dark">
<head>
    <?php head_tags('Paparan Hari Ini'); ?>
    <meta http-equiv="refresh" content="120">
</head>
<body class="display-board">
<header class="db-head">
    <div class="d-flex align-items-center gap-3">
        <?= brand_logo('lg') ?>
        <div>
            <div class="fs-4 fw-bold">Jadual Bilik Khas Hari Ini</div>
            <div class="opacity-75"><?= e(setting('school_name')) ?></div>
        </div>
    </div>
    <div class="text-end">
        <div class="db-clock" id="clock"><?= date('H:i') ?></div>
        <div class="opacity-75"><?= fmt_date($today, true) ?></div>
    </div>
</header>
<main class="db-grid">
    <?php foreach ($rooms as $r):
        $list = $byRoom[$r['id']] ?? [];
        $current = null;
        $nextB = null;
        foreach ($list as $b) {
            if ($b['start_time'] <= $now && $b['end_time'] > $now) $current = $b;
            elseif ($b['start_time'] > $now && !$nextB) $nextB = $b;
        }
        $closure = find_closure((int) $r['id'], $today);
        ?>
        <section class="db-room <?= $closure ? 'closed' : ($current ? 'busy' : 'free') ?>" style="--c: <?= e($r['color']) ?>">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <div class="fw-bold fs-5"><?= e($r['name']) ?></div>
                    <div class="small opacity-75"><?= e($r['location']) ?></div>
                </div>
                <span class="db-state"><?= $closure ? 'DITUTUP' : ($current ? 'DIGUNAKAN' : 'KOSONG') ?></span>
            </div>
            <?php if ($closure): ?>
                <div class="opacity-75"><?= e($closure['reason']) ?></div>
            <?php elseif ($current): ?>
                <div class="db-now"><strong><?= e($current['purpose']) ?></strong><div><?= e($current['user_name']) ?><?= $current['class_name'] ? ' · ' . e($current['class_name']) : '' ?></div><div class="small opacity-75">hingga <?= e($current['end_time']) ?></div></div>
            <?php endif; ?>
            <ul class="db-list">
                <?php foreach ($list as $b): if ($b === $current) continue; ?>
                    <li class="<?= $b['end_time'] <= $now ? 'done' : '' ?>"><span><?= e($b['start_time']) ?>–<?= e($b['end_time']) ?></span><?= e($b['purpose']) ?> <em><?= e($b['user_name']) ?></em></li>
                <?php endforeach; ?>
                <?php if (!$list && !$closure): ?><li class="opacity-50">Tiada tempahan hari ini</li><?php endif; ?>
            </ul>
        </section>
    <?php endforeach; ?>
</main>
<script>
    setInterval(function () {
        var d = new Date();
        document.getElementById('clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    }, 10000);
</script>
</body>
</html>
