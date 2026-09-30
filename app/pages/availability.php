<?php
declare(strict_types=1);

$date = query('date');
if (!valid_date($date)) {
    $date = date('Y-m-d');
}
$start = query('start');
$end = query('end');
$minCap = (int) query('capacity');
$category = query('category');

$rooms = all_rooms(true);
$categories = array_values(array_unique(array_filter(array_column($rooms, 'category'))));
if ($category !== '') {
    $rooms = array_values(array_filter($rooms, fn($r) => $r['category'] === $category));
}
$periods = all_periods();
$bookings = bookings_between($date, $date);
$byRoom = [];
foreach ($bookings as $b) {
    $byRoom[$b['room_id']][] = $b;
}
$closed = [];
foreach ($rooms as $r) {
    if ($c = find_closure((int) $r['id'], $date)) {
        $closed[$r['id']] = $c['reason'];
    }
}

// Free-room finder
$finder = null;
if (valid_time($start) && valid_time($end) && $end > $start) {
    $finder = [];
    foreach ($rooms as $r) {
        if (isset($closed[$r['id']]) || ($minCap && $r['capacity'] < $minCap)) {
            continue;
        }
        $clash = array_filter($byRoom[$r['id']] ?? [], fn($b) => $b['start_time'] < $end && $b['end_time'] > $start);
        if (!$clash) {
            $finder[] = $r;
        }
    }
}

$now = date('H:i');
$isToday = $date === date('Y-m-d');
$isPastDay = $date < date('Y-m-d');
$prev = date('Y-m-d', strtotime("$date -1 day"));
$next = date('Y-m-d', strtotime("$date +1 day"));

render_header('Semak Kekosongan', 'availability');
page_title('Semak Kekosongan Bilik', 'Lihat status semua bilik khas mengikut waktu, atau cari bilik yang kosong pada masa tertentu.');
?>
<div class="card mb-4">
    <div class="card-body">
        <form class="row g-3 align-items-end" method="get">
            <input type="hidden" name="p" value="availability">
            <div class="col-sm-6 col-lg-3">
                <label class="form-label fw-semibold small">Tarikh</label>
                <input type="date" name="date" class="form-control" value="<?= e($date) ?>">
            </div>
            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold small">Dari</label>
                <input type="time" name="start" class="form-control" value="<?= e($start) ?>" step="300">
            </div>
            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold small">Hingga</label>
                <input type="time" name="end" class="form-control" value="<?= e($end) ?>" step="300">
            </div>
            <div class="col-6 col-lg-2">
                <label class="form-label fw-semibold small">Kategori</label>
                <select name="category" class="form-select">
                    <option value="">Semua</option>
                    <?php foreach ($categories as $c): ?><option <?= $c === $category ? 'selected' : '' ?>><?= e($c) ?></option><?php endforeach; ?>
                </select>
            </div>
            <div class="col-6 col-lg-1">
                <label class="form-label fw-semibold small">Min. kapasiti</label>
                <input type="number" name="capacity" class="form-control" value="<?= $minCap ?: '' ?>" min="1">
            </div>
            <div class="col-lg-2 d-grid">
                <button class="btn btn-primary"><i class="bi bi-search me-1"></i>Cari</button>
            </div>
        </form>
    </div>
</div>

<?php if ($finder !== null): ?>
    <div class="card mb-4 border-primary-subtle">
        <div class="card-header bg-primary-subtle">
            <h2 class="card-title text-primary-emphasis"><i class="bi bi-stars me-2"></i><?= count($finder) ?> bilik kosong pada <?= fmt_date($date, true) ?>, <?= e($start) ?> – <?= e($end) ?></h2>
        </div>
        <div class="card-body">
            <?php if (!$finder): ?>
                <div class="empty-state py-3"><i class="bi bi-emoji-frown"></i><p>Tiada bilik yang kosong untuk masa tersebut. Cuba masa atau tarikh lain.</p></div>
            <?php else: ?>
                <div class="row g-3">
                    <?php foreach ($finder as $r): ?>
                        <div class="col-md-6 col-xl-4">
                            <div class="free-room" style="--c: <?= e($r['color']) ?>">
                                <div class="flex-grow-1 min-w-0">
                                    <div class="fw-semibold text-truncate"><?= e($r['name']) ?></div>
                                    <div class="small text-body-secondary"><i class="bi bi-geo-alt me-1"></i><?= e($r['location']) ?> · <i class="bi bi-people mx-1"></i><?= (int) $r['capacity'] ?></div>
                                </div>
                                <?php if (!$isPastDay): ?>
                                    <a class="btn btn-sm btn-primary" href="<?= url('book', ['room_id' => $r['id'], 'date' => $date, 'start' => $start, 'end' => $end]) ?>">Tempah</a>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </div>
    </div>
<?php endif; ?>

<div class="card">
    <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
            <a class="btn btn-sm btn-light" href="<?= url('availability', array_filter(['date' => $prev, 'category' => $category])) ?>"><i class="bi bi-chevron-left"></i></a>
            <a class="btn btn-sm btn-light" href="<?= url('availability', array_filter(['category' => $category])) ?>">Hari ini</a>
            <a class="btn btn-sm btn-light" href="<?= url('availability', array_filter(['date' => $next, 'category' => $category])) ?>"><i class="bi bi-chevron-right"></i></a>
            <h2 class="card-title ms-2"><?= fmt_date($date, true) ?></h2>
        </div>
        <div class="d-flex gap-3 xsmall text-body-secondary">
            <span><span class="legend-box bg-free"></span>Kosong (klik untuk tempah)</span>
            <span><span class="legend-box bg-busy"></span>Ditempah</span>
            <span><span class="legend-box bg-pending"></span>Menunggu kelulusan</span>
            <span><span class="legend-box bg-closed"></span>Ditutup</span>
        </div>
    </div>
    <div class="table-responsive avail-wrap">
        <table class="avail-grid">
            <thead>
            <tr>
                <th class="sticky-col">Bilik</th>
                <?php foreach ($periods as $p): ?>
                    <th class="<?= $p['is_break'] ? 'is-break' : '' ?><?= $isToday && $p['start_time'] <= $now && $p['end_time'] > $now ? ' is-now' : '' ?>">
                        <div><?= e($p['label']) ?></div><small><?= e($p['start_time']) ?></small>
                    </th>
                <?php endforeach; ?>
            </tr>
            </thead>
            <tbody>
            <?php if (!$rooms): ?>
                <tr><td colspan="<?= count($periods) + 1 ?>" class="text-center py-4 text-body-secondary">Tiada bilik aktif.</td></tr>
            <?php endif; ?>
            <?php foreach ($rooms as $r): ?>
                <tr>
                    <th class="sticky-col">
                        <span class="room-dot" style="--c: <?= e($r['color']) ?>"></span><?= e($r['name']) ?>
                        <div class="xsmall text-body-secondary fw-normal"><?= e($r['code']) ?> · <?= (int) $r['capacity'] ?> orang</div>
                    </th>
                    <?php if (isset($closed[$r['id']])): ?>
                        <td colspan="<?= count($periods) ?>" class="cell-closed"><i class="bi bi-lock me-1"></i>Ditutup: <?= e($closed[$r['id']]) ?></td>
                    <?php else: foreach ($periods as $p):
                        $hit = null;
                        foreach ($byRoom[$r['id']] ?? [] as $b) {
                            if ($b['start_time'] < $p['end_time'] && $b['end_time'] > $p['start_time']) { $hit = $b; break; }
                        }
                        $past = $isPastDay || ($isToday && $p['end_time'] <= $now);
                        if ($hit): ?>
                            <td class="cell-busy<?= $hit['status'] === 'pending' ? ' pending' : '' ?>" style="--c: <?= e($r['color']) ?>"
                                data-bs-toggle="tooltip" data-bs-html="true"
                                data-bs-title="<?= e('<strong>' . e($hit['purpose']) . '</strong><br>' . e($hit['user_name']) . '<br>' . $hit['start_time'] . ' – ' . $hit['end_time'] . ($hit['status'] === 'pending' ? '<br><em>Menunggu kelulusan</em>' : '')) ?>">
                                <a href="<?= url('booking', ['id' => $hit['id']]) ?>"><?= e(initials($hit['user_name'])) ?></a>
                            </td>
                        <?php elseif ($p['is_break']): ?>
                            <td class="cell-break"></td>
                        <?php elseif ($past): ?>
                            <td class="cell-past"></td>
                        <?php else: ?>
                            <td class="cell-free"><a href="<?= url('book', ['room_id' => $r['id'], 'date' => $date, 'start' => $p['start_time'], 'end' => $p['end_time']]) ?>" title="Tempah <?= e($r['name']) ?> <?= e($p['start_time']) ?>–<?= e($p['end_time']) ?>"><i class="bi bi-plus"></i></a></td>
                        <?php endif; ?>
                    <?php endforeach; endif; ?>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php render_footer();
