<?php
declare(strict_types=1);

$from = valid_date(query('from')) ? query('from') : date('Y-m-01');
$to = valid_date(query('to')) ? query('to') : date('Y-m-t');
if ($to < $from) {
    [$from, $to] = [$to, $from];
}
$pdo = db();
$run = function (string $sql, array $params = []) use ($pdo): array {
    $st = $pdo->prepare($sql);
    $st->execute($params);
    return $st->fetchAll();
};

// School days in range (for utilisation %)
$allowWeekend = setting('allow_weekend') === '1';
$schoolDays = 0;
for ($d = strtotime($from); $d <= strtotime($to); $d += 86400) {
    $dow = (int) date('w', $d);
    if ($allowWeekend || ($dow !== 0 && $dow !== 6)) {
        $schoolDays++;
    }
}
$closedAll = $run('SELECT start_date, end_date FROM closures WHERE room_id IS NULL AND start_date <= ? AND end_date >= ?', [$to, $from]);
$closedDays = [];
foreach ($closedAll as $c) {
    for ($d = strtotime(max($c['start_date'], $from)); $d <= strtotime(min($c['end_date'], $to)); $d += 86400) {
        $closedDays[date('Y-m-d', $d)] = true;
    }
}
$schoolDays = max(0, $schoolDays - count($closedDays));
$openMinutes = time_to_min(setting('close_time', '18:00')) - time_to_min(setting('open_time', '07:00'));

$minutesExpr = "((CAST(substr(end_time,1,2) AS INTEGER)*60 + CAST(substr(end_time,4,2) AS INTEGER)) - (CAST(substr(start_time,1,2) AS INTEGER)*60 + CAST(substr(start_time,4,2) AS INTEGER)))";

$summary = $run("SELECT COUNT(*) AS total,
        SUM(status = 'approved') AS approved, SUM(status = 'pending') AS pending,
        SUM(status = 'rejected') AS rejected, SUM(status = 'cancelled') AS cancelled,
        SUM(CASE WHEN status = 'approved' THEN $minutesExpr ELSE 0 END) AS minutes,
        COUNT(DISTINCT CASE WHEN status = 'approved' THEN user_id END) AS teachers
    FROM bookings WHERE date BETWEEN ? AND ?", [$from, $to])[0];
$summary = array_map('intval', $summary);

$perRoom = $run("SELECT r.id, r.code, r.name, r.color, r.capacity,
        COUNT(b.id) AS n, COALESCE(SUM(CASE WHEN b.id IS NOT NULL THEN " . str_replace(['end_time', 'start_time'], ['b.end_time', 'b.start_time'], $minutesExpr) . " END), 0) AS minutes
    FROM rooms r LEFT JOIN bookings b ON b.room_id = r.id AND b.status = 'approved' AND b.date BETWEEN ? AND ?
    WHERE r.status != 'inactive' GROUP BY r.id ORDER BY minutes DESC, r.name", [$from, $to]);

$topUsers = $run("SELECT u.name, u.department, COUNT(*) AS n, SUM(" . str_replace(['end_time', 'start_time'], ['b.end_time', 'b.start_time'], $minutesExpr) . ") AS minutes
    FROM bookings b JOIN users u ON u.id = b.user_id WHERE b.status = 'approved' AND b.date BETWEEN ? AND ?
    GROUP BY u.id ORDER BY n DESC LIMIT 10", [$from, $to]);

$byDow = array_fill(0, 7, 0);
foreach ($run("SELECT CAST(strftime('%w', date) AS INTEGER) AS dow, COUNT(*) AS n FROM bookings WHERE status = 'approved' AND date BETWEEN ? AND ? GROUP BY dow", [$from, $to]) as $r) {
    $byDow[(int) $r['dow']] = (int) $r['n'];
}
$byHour = [];
foreach ($run("SELECT CAST(substr(start_time,1,2) AS INTEGER) AS h, COUNT(*) AS n FROM bookings WHERE status = 'approved' AND date BETWEEN ? AND ? GROUP BY h ORDER BY h", [$from, $to]) as $r) {
    $byHour[sprintf('%02d:00', $r['h'])] = (int) $r['n'];
}
$byPurpose = $run("SELECT COALESCE(NULLIF(subject,''), 'Tidak dinyatakan') AS label, COUNT(*) AS n FROM bookings WHERE status = 'approved' AND date BETWEEN ? AND ? GROUP BY label ORDER BY n DESC LIMIT 8", [$from, $to]);

$util = fn(int $minutes) => $schoolDays && $openMinutes > 0 ? round($minutes / ($schoolDays * $openMinutes) * 100, 1) : 0;

if (query('export') === 'csv') {
    audit('export.report', "$from – $to");
    csv_download("laporan-penggunaan-{$from}-{$to}.csv", ['Kod', 'Bilik', 'Bil. Tempahan', 'Jumlah Jam', 'Kadar Penggunaan (%)'],
        array_map(fn($r) => [$r['code'], $r['name'], $r['n'], round($r['minutes'] / 60, 1), $util((int) $r['minutes'])], $perRoom));
}

$presets = [
    'Bulan ini' => [date('Y-m-01'), date('Y-m-t')],
    'Bulan lepas' => [date('Y-m-01', strtotime('first day of last month')), date('Y-m-t', strtotime('last day of last month'))],
    'Minggu ini' => [date('Y-m-d', strtotime('monday this week')), date('Y-m-d', strtotime('sunday this week'))],
    'Tahun ini' => [date('Y-01-01'), date('Y-12-31')],
];

render_header('Laporan & Analitik', 'admin/reports');
page_title('Laporan & Analitik', 'Statistik penggunaan bilik khas bagi ' . fmt_date($from) . ' hingga ' . fmt_date($to) . '.',
    '<a href="' . url('admin/reports', ['from' => $from, 'to' => $to, 'export' => 'csv']) . '" class="btn btn-light"><i class="bi bi-filetype-csv me-1"></i>Eksport CSV</a>
     <button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button>');
?>
<div class="card mb-4 no-print">
    <div class="card-body d-flex flex-wrap gap-2 align-items-end">
        <form class="d-flex flex-wrap gap-2 align-items-end" method="get">
            <input type="hidden" name="p" value="admin/reports">
            <div><label class="form-label small fw-semibold">Dari</label><input type="date" name="from" class="form-control form-control-sm" value="<?= e($from) ?>"></div>
            <div><label class="form-label small fw-semibold">Hingga</label><input type="date" name="to" class="form-control form-control-sm" value="<?= e($to) ?>"></div>
            <button class="btn btn-sm btn-primary">Jana Laporan</button>
        </form>
        <div class="ms-md-auto d-flex flex-wrap gap-1">
            <?php foreach ($presets as $label => [$pf, $pt]): ?>
                <a href="<?= url('admin/reports', ['from' => $pf, 'to' => $pt]) ?>" class="btn btn-sm <?= $pf === $from && $pt === $to ? 'btn-primary' : 'btn-light' ?>"><?= e($label) ?></a>
            <?php endforeach; ?>
        </div>
    </div>
</div>

<div class="print-only mb-3">
    <h2 class="h4 mb-0">Laporan Penggunaan Bilik Khas</h2>
    <div><?= e(setting('school_name')) ?> · <?= fmt_date($from) ?> – <?= fmt_date($to) ?></div>
</div>

<div class="row g-3 mb-4">
    <?php foreach ([
        ['Jumlah Permohonan', $summary['total'], 'clipboard-data', 'primary'],
        ['Diluluskan', $summary['approved'], 'check-circle', 'success'],
        ['Jumlah Jam Digunakan', round($summary['minutes'] / 60, 1), 'clock-history', 'info'],
        ['Guru Terlibat', $summary['teachers'], 'people', 'warning'],
        ['Hari Persekolahan', $schoolDays, 'calendar-week', 'secondary'],
        ['Kadar Penggunaan Purata', ($perRoom ? round(array_sum(array_map(fn($r) => $util((int) $r['minutes']), $perRoom)) / count($perRoom), 1) : 0) . '%', 'speedometer2', 'danger'],
    ] as [$label, $value, $icon, $color]): ?>
        <div class="col-6 col-md-4 col-xl-2">
            <div class="stat-card stat-card-sm">
                <div class="stat-icon bg-<?= $color ?>-subtle text-<?= $color ?>-emphasis"><i class="bi bi-<?= $icon ?>"></i></div>
                <div><div class="stat-value"><?= $value ?></div><div class="stat-label"><?= e($label) ?></div></div>
            </div>
        </div>
    <?php endforeach; ?>
</div>

<div class="row g-4 mb-4">
    <div class="col-lg-8">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title">Penggunaan Mengikut Bilik</h2></div>
            <div class="table-responsive">
                <table class="table align-middle mb-0">
                    <thead><tr><th>Bilik</th><th class="text-center">Tempahan</th><th class="text-center">Jam</th><th style="width: 38%">Kadar penggunaan</th></tr></thead>
                    <tbody>
                    <?php foreach ($perRoom as $r): $u = $util((int) $r['minutes']); ?>
                        <tr>
                            <td><span class="room-dot" style="--c: <?= e($r['color']) ?>"></span><?= e($r['name']) ?></td>
                            <td class="text-center"><?= (int) $r['n'] ?></td>
                            <td class="text-center"><?= round($r['minutes'] / 60, 1) ?></td>
                            <td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1" style="height: 8px"><div class="progress-bar" style="width: <?= min(100, $u) ?>%; background: <?= e($r['color']) ?>"></div></div><span class="small fw-semibold" style="width: 48px"><?= $u ?>%</span></div></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <div class="card-footer xsmall text-body-secondary">Kadar penggunaan = jam diluluskan ÷ (hari persekolahan × waktu operasi <?= e(setting('open_time')) ?>–<?= e(setting('close_time')) ?>).</div>
        </div>
    </div>
    <div class="col-lg-4">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title">Status Permohonan</h2></div>
            <div class="card-body d-flex align-items-center justify-content-center"><canvas id="statusChart" height="240"></canvas></div>
        </div>
    </div>
</div>

<div class="row g-4">
    <div class="col-lg-4">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title">Mengikut Hari</h2></div>
            <div class="card-body"><canvas id="dowChart" height="220"></canvas></div>
        </div>
    </div>
    <div class="col-lg-4">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title">Waktu Paling Popular</h2></div>
            <div class="card-body"><canvas id="hourChart" height="220"></canvas></div>
        </div>
    </div>
    <div class="col-lg-4">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title">Pengguna Paling Aktif</h2></div>
            <ul class="list-group list-group-flush">
                <?php if (!$topUsers): ?><li class="list-group-item text-body-secondary small">Tiada data.</li><?php endif; ?>
                <?php foreach ($topUsers as $i => $u): ?>
                    <li class="list-group-item d-flex align-items-center gap-2">
                        <span class="rank"><?= $i + 1 ?></span>
                        <div class="flex-grow-1 min-w-0"><div class="small fw-semibold text-truncate"><?= e($u['name']) ?></div><div class="xsmall text-body-secondary"><?= e($u['department'] ?: '-') ?></div></div>
                        <span class="small fw-semibold"><?= (int) $u['n'] ?></span>
                    </li>
                <?php endforeach; ?>
            </ul>
        </div>
    </div>
</div>
<?php
$scripts = '<script src="assets/vendor/chartjs/chart.umd.min.js"></script><script>
TB.charts.doughnut("statusChart", ["Diluluskan","Menunggu","Ditolak","Dibatalkan"], ' . js([$summary['approved'], $summary['pending'], $summary['rejected'], $summary['cancelled']]) . ', ["#16a34a","#f59e0b","#dc2626","#94a3b8"]);
TB.charts.bar("dowChart", ' . js(MALAY_DAYS) . ', ' . js($byDow) . ');
TB.charts.bar("hourChart", ' . js(array_keys($byHour)) . ', ' . js(array_values($byHour)) . ');
</script>';
render_footer($scripts);
