<?php
declare(strict_types=1);

$q = query('q');
$schools = platform_db()->query('SELECT * FROM schools ORDER BY name')->fetchAll();
if ($q !== '') {
    $schools = array_values(array_filter($schools, fn($s) => stripos($s['name'] . ' ' . $s['slug'] . ' ' . $s['school_code'], $q) !== false));
}
$rows = array_map(fn($s) => $s + ['stats' => school_stats($s)], $schools);
$totals = ['schools' => count($rows), 'active' => 0, 'users' => 0, 'month' => 0];
foreach ($rows as $r) {
    $totals['active'] += $r['status'] === 'active' ? 1 : 0;
    $totals['users'] += $r['stats']['users'];
    $totals['month'] += $r['stats']['month'];
}
$credentials = $_SESSION['new_school_credentials'] ?? null;
unset($_SESSION['new_school_credentials']);

platform_header('Sekolah', 'schools');
?>
<?php if ($credentials): ?>
    <div class="card border-success-subtle mb-4">
        <div class="card-body">
            <h2 class="h5 fw-bold text-success"><i class="bi bi-check-circle me-1"></i><?= e($credentials['name']) ?> berjaya dicipta</h2>
            <p class="mb-2">Hantar maklumat ini kepada admin sekolah. Kata laluan tidak akan dipaparkan lagi, dan admin akan diminta menukarnya semasa log masuk pertama.</p>
            <div class="bg-body-tertiary rounded p-3 font-monospace small user-select-all" style="white-space: pre-line">Pautan sistem: <?= e($credentials['url']) ?>
Kod sekolah: <?= e(strtoupper($credentials['slug'])) ?>
<?php if ($credentials['email']): ?>E-mel admin: <?= e($credentials['email']) ?>
Kata laluan sementara: <?= e($credentials['password']) ?><?php else: ?>Data sedia ada diimport (gunakan akaun admin yang sedia ada).<?php endif; ?></div>
        </div>
    </div>
<?php endif; ?>

<div class="page-head">
    <div>
        <h1 class="page-title">Sekolah</h1>
        <p class="page-subtitle">Setiap sekolah mempunyai pangkalan data, admin, guru dan bilik khas sendiri.</p>
    </div>
    <div class="page-actions"><a href="index.php?p=platform/new" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tambah Sekolah</a></div>
</div>

<div class="row g-3 mb-4">
    <?php foreach ([['Jumlah Sekolah', $totals['schools'], 'building', 'primary'], ['Sekolah Aktif', $totals['active'], 'check-circle', 'success'],
        ['Pengguna Aktif', $totals['users'], 'people', 'info'], ['Tempahan Bulan Ini', $totals['month'], 'calendar-check', 'warning']] as [$l, $v, $i, $c]): ?>
        <div class="col-6 col-lg-3">
            <div class="stat-card"><div class="stat-icon bg-<?= $c ?>-subtle text-<?= $c ?>-emphasis"><i class="bi bi-<?= $i ?>"></i></div><div><div class="stat-value"><?= $v ?></div><div class="stat-label"><?= $l ?></div></div></div>
        </div>
    <?php endforeach; ?>
</div>

<div class="card">
    <div class="card-header d-flex justify-content-between align-items-center">
        <h2 class="card-title">Senarai Sekolah</h2>
        <form method="get"><input type="hidden" name="p" value="platform">
            <div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="<?= e($q) ?>" placeholder="Cari sekolah…"></div></form>
    </div>
    <?php if (!$rows): ?>
        <div class="empty-state py-5"><i class="bi bi-building-add"></i><p>Belum ada sekolah.</p><a href="index.php?p=platform/new" class="btn btn-primary btn-sm">Tambah sekolah pertama</a></div>
    <?php else: ?>
        <div class="table-responsive">
            <table class="table table-hover align-middle mb-0">
                <thead><tr><th>Sekolah</th><th>Pautan</th><th class="text-center">Pengguna</th><th class="text-center">Bilik</th><th class="text-center">Tempahan (bulan ini)</th><th>Aktiviti terakhir</th><th>Status</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($rows as $r): $st = $r['stats']; ?>
                    <tr>
                        <td><strong><?= e($r['name']) ?></strong><div class="xsmall text-body-secondary"><?= human_size($st['size']) ?></div></td>
                        <td><span class="school-link fw-semibold"><?= e(strtoupper($r['slug'])) ?></span></td>
                        <td class="text-center"><?= $st['users'] ?><?= $st['teachers_pending'] ? ' <span class="badge badge-soft-warning" title="Menunggu pengesahan">+' . $st['teachers_pending'] . '</span>' : '' ?></td>
                        <td class="text-center"><?= $st['rooms'] ?></td>
                        <td class="text-center"><?= $st['bookings'] ?> <span class="text-body-secondary">(<?= $st['month'] ?>)</span></td>
                        <td class="small"><?= $st['last_activity'] ? fmt_datetime($st['last_activity']) : '<span class="text-body-tertiary">Belum ada</span>' ?></td>
                        <td><?= $r['status'] === 'active' ? '<span class="badge badge-soft-success">Aktif</span>' : '<span class="badge badge-soft-danger">Digantung</span>' ?></td>
                        <td class="text-end"><a href="index.php?p=platform/school&amp;id=<?= $r['id'] ?>" class="btn btn-sm btn-light">Urus <i class="bi bi-chevron-right"></i></a></td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    <?php endif; ?>
</div>
<?php platform_footer();
