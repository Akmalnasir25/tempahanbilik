<?php
declare(strict_types=1);

$today = date('Y-m-d');
$now = date('H:i');
$rooms = db()->query("SELECT * FROM rooms WHERE status != 'inactive' ORDER BY category, name")->fetchAll();
$categories = array_values(array_unique(array_filter(array_column($rooms, 'category'))));

$st = db()->prepare("SELECT room_id, COUNT(*) AS n,
        MAX(CASE WHEN start_time <= :t AND end_time > :t THEN 1 ELSE 0 END) AS busy_now
    FROM bookings WHERE date = :d AND status IN ('pending','approved') GROUP BY room_id");
$st->execute([':t' => $now, ':d' => $today]);
$todayStats = [];
foreach ($st->fetchAll() as $r) {
    $todayStats[$r['room_id']] = $r;
}

render_header('Senarai Bilik Khas', 'rooms');
page_title('Senarai Bilik Khas', count($rooms) . ' bilik khas tersedia di ' . e(setting('school_name')) . '.');
?>
<div class="d-flex flex-wrap gap-2 mb-4 filter-chips" id="roomFilter">
    <button class="btn btn-sm btn-primary" data-filter="">Semua</button>
    <?php foreach ($categories as $c): ?>
        <button class="btn btn-sm btn-light" data-filter="<?= e($c) ?>"><?= e($c) ?></button>
    <?php endforeach; ?>
    <div class="ms-auto input-icon" style="min-width: 220px"><i class="bi bi-search"></i><input class="form-control form-control-sm" id="roomSearch" placeholder="Cari bilik…"></div>
</div>

<div class="row g-4" id="roomGrid">
    <?php foreach ($rooms as $r):
        $stat = $todayStats[$r['id']] ?? null;
        $closure = find_closure((int) $r['id'], $today);
        $available = $r['status'] === 'active' && !$closure;
        ?>
        <div class="col-md-6 col-xl-4" data-category="<?= e($r['category']) ?>" data-search="<?= e(mb_strtolower($r['name'] . ' ' . $r['code'] . ' ' . $r['location'] . ' ' . $r['facilities'])) ?>">
            <div class="room-card h-100">
                <div class="room-card-banner" style="--c: <?= e($r['color']) ?>">
                    <span class="room-code"><?= e($r['code']) ?></span>
                    <i class="bi bi-door-open"></i>
                    <span class="room-live">
                        <?php if (!$available): ?>
                            <span class="badge text-bg-dark"><i class="bi bi-lock me-1"></i><?= $closure ? 'Ditutup hari ini' : 'Penyelenggaraan' ?></span>
                        <?php elseif ($stat && $stat['busy_now']): ?>
                            <span class="badge text-bg-danger">Sedang digunakan</span>
                        <?php else: ?>
                            <span class="badge text-bg-success">Kosong sekarang</span>
                        <?php endif; ?>
                    </span>
                </div>
                <div class="p-4 d-flex flex-column h-100">
                    <div class="d-flex justify-content-between align-items-start gap-2 mb-1">
                        <h3 class="h5 fw-bold mb-0"><?= e($r['name']) ?></h3>
                        <?php if (room_needs_approval($r)): ?><span class="badge badge-soft-warning" title="Perlu kelulusan pentadbir"><i class="bi bi-shield-lock"></i></span><?php endif; ?>
                    </div>
                    <div class="small text-body-secondary mb-3"><?= e($r['category']) ?> · <i class="bi bi-geo-alt"></i> <?= e($r['location']) ?></div>
                    <div class="d-flex gap-3 small mb-3">
                        <span><i class="bi bi-people me-1 text-primary"></i><?= (int) $r['capacity'] ?> orang</span>
                        <span><i class="bi bi-calendar-check me-1 text-primary"></i><?= (int) ($stat['n'] ?? 0) ?> tempahan hari ini</span>
                    </div>
                    <?php if ($r['facilities']): ?>
                        <div class="d-flex flex-wrap gap-1 mb-3">
                            <?php foreach (array_filter(array_map('trim', explode(',', $r['facilities']))) as $f): ?>
                                <span class="facility-tag"><?= e($f) ?></span>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                    <?php if ($r['description']): ?><p class="small text-body-secondary"><?= e($r['description']) ?></p><?php endif; ?>
                    <?php if ($r['pic_name']): ?><div class="xsmall text-body-secondary mb-3"><i class="bi bi-person-badge me-1"></i>Penyelaras: <?= e($r['pic_name']) ?></div><?php endif; ?>
                    <div class="mt-auto d-flex gap-2">
                        <?php if ($r['status'] === 'active'): ?>
                            <a href="<?= url('book', ['room_id' => $r['id']]) ?>" class="btn btn-primary flex-grow-1"><i class="bi bi-plus-lg me-1"></i>Tempah</a>
                        <?php endif; ?>
                        <a href="<?= url('calendar', ['room_id' => $r['id']]) ?>" class="btn btn-light flex-grow-1"><i class="bi bi-calendar3 me-1"></i>Jadual</a>
                    </div>
                </div>
            </div>
        </div>
    <?php endforeach; ?>
</div>
<div class="empty-state py-5" id="roomEmpty" hidden><i class="bi bi-search"></i><p>Tiada bilik sepadan dengan carian.</p></div>
<?php render_footer('<script>TB.roomFilter();</script>');
