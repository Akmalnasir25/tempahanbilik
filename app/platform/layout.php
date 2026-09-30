<?php
declare(strict_types=1);

function platform_header(string $title, string $active = ''): void
{
    $admin = super_admin();
    ?>
<!doctype html>
<html lang="ms">
<head><?php head_tags($title . ' · Super Admin'); ?></head>
<body class="app-platform">
<nav class="navbar navbar-expand-md navbar-dark platform-nav">
    <div class="container-xl">
        <a class="navbar-brand d-flex align-items-center gap-2" href="index.php?p=platform">
            <span class="brand-logo"><i class="bi bi-buildings"></i></span>
            <span class="lh-sm"><strong class="d-block"><?= e(PLATFORM_NAME) ?></strong><small class="opacity-75">Panel Super Admin</small></span>
        </a>
        <?php if ($admin): ?>
            <button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#pnav"><span class="navbar-toggler-icon"></span></button>
            <div class="collapse navbar-collapse" id="pnav">
                <ul class="navbar-nav ms-auto align-items-md-center gap-md-2">
                    <li class="nav-item"><a class="nav-link<?= $active === 'schools' ? ' active fw-semibold' : '' ?>" href="index.php?p=platform"><i class="bi bi-building me-1"></i>Sekolah</a></li>
                    <li class="nav-item"><a class="nav-link<?= $active === 'audit' ? ' active fw-semibold' : '' ?>" href="index.php?p=platform/audit"><i class="bi bi-shield-check me-1"></i>Log Audit</a></li>
                    <li class="nav-item"><a class="nav-link<?= $active === 'account' ? ' active fw-semibold' : '' ?>" href="index.php?p=platform/account"><i class="bi bi-person-gear me-1"></i><?= e($admin['name']) ?></a></li>
                    <li class="nav-item">
                        <form method="post" action="index.php?p=platform/logout"><?= csrf_field() ?>
                            <button class="btn btn-sm btn-outline-light"><i class="bi bi-box-arrow-right me-1"></i>Log keluar</button>
                        </form>
                    </li>
                </ul>
            </div>
        <?php endif; ?>
    </div>
</nav>
<main class="container-xl py-4">
    <?php foreach (take_flashes() as [$type, $msg]): ?>
        <div class="alert alert-<?= e($type) ?> alert-dismissible fade show"><?= e($msg) ?><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>
    <?php endforeach; ?>
    <?php
}

function platform_footer(string $scripts = ''): void
{
    ?>
</main>
<div class="modal fade" id="confirmModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-body p-4 text-center">
                <div class="confirm-icon mb-3"><i class="bi bi-exclamation-triangle"></i></div>
                <h5 class="mb-2" data-confirm-title>Adakah anda pasti?</h5>
                <p class="text-body-secondary mb-0" data-confirm-text></p>
            </div>
            <div class="modal-footer border-0 justify-content-center pb-4">
                <button type="button" class="btn btn-light px-4" data-bs-dismiss="modal">Batal</button>
                <button type="button" class="btn btn-danger px-4" data-confirm-ok>Ya, teruskan</button>
            </div>
        </div>
    </div>
</div>
<script src="assets/vendor/bootstrap/bootstrap.bundle.min.js"></script>
<script src="assets/js/app.js?v=<?= APP_VERSION ?>"></script>
<?= $scripts ?>
</body>
</html>
    <?php
}

/** Headline numbers for one school, read from its own database. */
function school_stats(array $school): array
{
    $path = school_db_path($school['slug']);
    $out = ['users' => 0, 'teachers_pending' => 0, 'rooms' => 0, 'bookings' => 0, 'month' => 0, 'last_activity' => null, 'size' => is_file($path) ? filesize($path) : 0, 'admins' => []];
    if (!is_file($path)) {
        return $out;
    }
    $pdo = open_school_db($path);
    $one = function (string $sql, array $p = []) use ($pdo) {
        $st = $pdo->prepare($sql);
        $st->execute($p);
        return $st->fetchColumn();
    };
    $out['users'] = (int) $one("SELECT COUNT(*) FROM users WHERE status = 'active'");
    $out['teachers_pending'] = (int) $one("SELECT COUNT(*) FROM users WHERE status = 'pending'");
    $out['rooms'] = (int) $one("SELECT COUNT(*) FROM rooms WHERE status != 'inactive'");
    $out['bookings'] = (int) $one('SELECT COUNT(*) FROM bookings');
    $out['month'] = (int) $one("SELECT COUNT(*) FROM bookings WHERE status IN ('pending','approved') AND strftime('%Y-%m', date) = ?", [date('Y-m')]);
    $out['last_activity'] = $one('SELECT MAX(x) FROM (SELECT MAX(created_at) AS x FROM bookings UNION ALL SELECT MAX(last_login_at) FROM users)') ?: null;
    $out['admins'] = $pdo->query("SELECT id, name, email, status, last_login_at FROM users WHERE role = 'admin' ORDER BY name")->fetchAll();
    return $out;
}

function human_size(int $bytes): string
{
    return $bytes >= 1048576 ? round($bytes / 1048576, 1) . ' MB' : max(1, (int) round($bytes / 1024)) . ' KB';
}

function random_password(int $len = 10): string
{
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $s = '';
    for ($i = 0; $i < $len; $i++) {
        $s .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $s;
}
