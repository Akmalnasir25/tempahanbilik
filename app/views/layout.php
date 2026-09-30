<?php
declare(strict_types=1);

function nav_items(): array
{
    $items = [
        ['section' => 'Utama'],
        ['dashboard', 'Papan Pemuka', 'grid-1x2'],
        ['book', 'Tempah Bilik', 'plus-square'],
        ['availability', 'Semak Kekosongan', 'search'],
        ['calendar', 'Jadual Tempahan', 'calendar3'],
        ['my-bookings', 'Tempahan Saya', 'journal-bookmark'],
        ['rooms', 'Senarai Bilik Khas', 'door-open'],
    ];
    if (is_admin()) {
        $items = array_merge($items, [
            ['section' => 'Pentadbiran'],
            ['admin/bookings', 'Rekod Tempahan', 'clipboard-data'],
            ['admin/rooms', 'Urus Bilik Khas', 'building-gear'],
            ['admin/users', 'Urus Pengguna', 'people'],
            ['admin/closures', 'Penutupan & Cuti', 'calendar-x'],
            ['admin/periods', 'Waktu Persekolahan', 'clock'],
            ['admin/reports', 'Laporan & Analitik', 'bar-chart-line'],
            ['admin/settings', 'Tetapan Sistem', 'gear'],
            ['admin/audit', 'Log Audit', 'shield-check'],
        ]);
    }
    return $items;
}

function head_tags(string $title): void
{
    ?>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?= e($title) ?> · <?= e(setting('system_name', 'Tempahan Bilik')) ?></title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%231e3a8a'/><path d='M9 23V9h9a5 5 0 010 10h-9' fill='none' stroke='white' stroke-width='3'/><circle cx='22' cy='23' r='2.5' fill='%2360a5fa'/></svg>">
    <link href="assets/vendor/bootstrap/bootstrap.min.css" rel="stylesheet">
    <link href="assets/vendor/bootstrap-icons/bootstrap-icons.min.css" rel="stylesheet">
    <link href="assets/css/app.css?v=<?= APP_VERSION ?>" rel="stylesheet">
    <script>
        (function () {
            var t = null;
            try { t = localStorage.getItem('tb-theme'); } catch (e) {}
            if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-bs-theme', t);
        })();
    </script>
    <?php
}

function render_header(string $title, string $active = '', array $opts = []): void
{
    $user = current_user();
    $unread = unread_notifications((int) $user['id']);
    $pendingCount = is_admin() ? (int) db()->query("SELECT COUNT(*) FROM bookings WHERE status = 'pending'")->fetchColumn() : 0;
    $pendingUsers = is_admin() ? (int) db()->query("SELECT COUNT(*) FROM users WHERE status = 'pending'")->fetchColumn() : 0;
    ?>
<!doctype html>
<html lang="ms">
<head>
    <?php head_tags($title); ?>
    <?= $opts['head'] ?? '' ?>
</head>
<body class="app" data-csrf="<?= e(csrf_token()) ?>">
<aside class="sidebar" id="sidebar">
    <a href="<?= url('dashboard') ?>" class="brand">
        <span class="brand-logo"><i class="bi bi-buildings"></i></span>
        <span class="brand-text">
            <strong><?= e(setting('system_name')) ?></strong>
            <small><?= e(setting('school_name')) ?></small>
        </span>
    </a>
    <nav class="side-nav">
        <?php foreach (nav_items() as $item): ?>
            <?php if (isset($item['section'])): ?>
                <div class="nav-section"><?= e($item['section']) ?></div>
            <?php else: [$page, $label, $icon] = $item; ?>
                <a href="<?= url($page) ?>" class="nav-link<?= $active === $page ? ' active' : '' ?>">
                    <i class="bi bi-<?= $icon ?>"></i><span><?= e($label) ?></span>
                    <?php if ($page === 'admin/bookings' && $pendingCount): ?><span class="nav-badge"><?= $pendingCount ?></span><?php endif; ?>
                    <?php if ($page === 'admin/users' && $pendingUsers): ?><span class="nav-badge"><?= $pendingUsers ?></span><?php endif; ?>
                </a>
            <?php endif; ?>
        <?php endforeach; ?>
    </nav>
    <div class="sidebar-footer">
        <a href="<?= url('display') ?>" target="_blank" class="nav-link"><i class="bi bi-tv"></i><span>Paparan Skrin Hari Ini</span></a>
    </div>
</aside>
<div class="sidebar-backdrop" data-toggle-sidebar></div>

<div class="main">
    <header class="topbar">
        <button class="btn btn-icon d-lg-none" data-toggle-sidebar aria-label="Menu"><i class="bi bi-list fs-4"></i></button>
        <div class="topbar-title d-none d-md-block">
            <div class="text-body-secondary small"><?= e(day_name(date('Y-m-d'))) ?>, <?= fmt_date(date('Y-m-d')) ?></div>
        </div>
        <div class="ms-auto d-flex align-items-center gap-2">
            <a href="<?= url('book') ?>" class="btn btn-primary btn-sm d-none d-sm-inline-flex align-items-center gap-1"><i class="bi bi-plus-lg"></i> Tempahan Baharu</a>
            <button class="btn btn-icon" id="themeToggle" title="Tukar tema" aria-label="Tukar tema"><i class="bi bi-moon-stars"></i></button>
            <div class="dropdown">
                <button class="btn btn-icon position-relative" data-bs-toggle="dropdown" id="notifBtn" aria-label="Notifikasi">
                    <i class="bi bi-bell"></i>
                    <?php if ($unread): ?><span class="notif-dot"><?= $unread > 9 ? '9+' : $unread ?></span><?php endif; ?>
                </button>
                <div class="dropdown-menu dropdown-menu-end notif-menu shadow-lg p-0">
                    <div class="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                        <strong>Notifikasi</strong>
                        <a href="<?= url('notifications') ?>" class="small">Lihat semua</a>
                    </div>
                    <div class="notif-list">
                        <?php
                        $st = db()->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 6');
                        $st->execute([$user['id']]);
                        $notifs = $st->fetchAll();
                        if (!$notifs): ?>
                            <div class="text-center text-body-secondary small py-4"><i class="bi bi-bell-slash fs-4 d-block mb-1"></i>Tiada notifikasi</div>
                        <?php endif;
                        foreach ($notifs as $n): ?>
                            <a href="<?= url('notifications', ['open' => $n['id']]) ?>" class="notif-item<?= $n['is_read'] ? '' : ' unread' ?>">
                                <div class="fw-semibold small"><?= e($n['title']) ?></div>
                                <div class="small text-body-secondary text-truncate"><?= e($n['message']) ?></div>
                                <div class="xsmall text-body-tertiary"><?= time_ago($n['created_at']) ?></div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>
            <div class="dropdown">
                <button class="btn user-chip" data-bs-toggle="dropdown">
                    <span class="avatar"><?= e(initials($user['name'])) ?></span>
                    <span class="d-none d-md-inline text-start lh-sm">
                        <span class="d-block fw-semibold small"><?= e($user['name']) ?></span>
                        <span class="d-block xsmall text-body-secondary"><?= $user['role'] === 'admin' ? 'Pentadbir' : 'Guru' ?></span>
                    </span>
                    <i class="bi bi-chevron-down small d-none d-md-inline"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                    <li><a class="dropdown-item" href="<?= url('profile') ?>"><i class="bi bi-person me-2"></i>Profil Saya</a></li>
                    <li><a class="dropdown-item" href="<?= url('my-bookings') ?>"><i class="bi bi-journal-bookmark me-2"></i>Tempahan Saya</a></li>
                    <li><hr class="dropdown-divider"></li>
                    <li>
                        <form method="post" action="<?= url('logout') ?>"><?= csrf_field() ?>
                            <button class="dropdown-item text-danger"><i class="bi bi-box-arrow-right me-2"></i>Log Keluar</button>
                        </form>
                    </li>
                </ul>
            </div>
        </div>
    </header>

    <main class="content">
        <?php if ($user['must_change_password'] && ($_GET['p'] ?? '') !== 'profile'): ?>
            <div class="alert alert-warning d-flex align-items-center gap-2">
                <i class="bi bi-shield-exclamation fs-5"></i>
                <div>Anda masih menggunakan kata laluan lalai / sementara. <a href="<?= url('profile') ?>#password" class="alert-link">Tukar kata laluan sekarang</a> untuk keselamatan akaun.</div>
            </div>
        <?php endif; ?>
        <?php foreach (take_flashes() as [$type, $msg]): ?>
            <div class="alert alert-<?= e($type) ?> alert-dismissible fade show d-flex align-items-start gap-2" role="alert">
                <i class="bi bi-<?= $type === 'success' ? 'check-circle' : ($type === 'danger' ? 'exclamation-octagon' : 'info-circle') ?> mt-1"></i>
                <div><?= e($msg) ?></div>
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        <?php endforeach; ?>
    <?php
}

function page_title(string $title, string $subtitle = '', string $actions = ''): void
{
    ?>
    <div class="page-head">
        <div>
            <h1 class="page-title"><?= e($title) ?></h1>
            <?php if ($subtitle): ?><p class="page-subtitle"><?= $subtitle ?></p><?php endif; ?>
        </div>
        <?php if ($actions): ?><div class="page-actions"><?= $actions ?></div><?php endif; ?>
    </div>
    <?php
}

function render_footer(string $scripts = ''): void
{
    ?>
    </main>
    <footer class="app-footer">
        <span>&copy; <?= date('Y') ?> <?= e(setting('school_name')) ?></span>
        <span class="text-body-tertiary"><?= e(setting('system_name')) ?> v<?= APP_VERSION ?></span>
    </footer>
</div>

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

function render_guest_header(string $title): void
{
    ?>
<!doctype html>
<html lang="ms">
<head><?php head_tags($title); ?></head>
<body class="guest">
    <?php
}

function render_guest_footer(): void
{
    ?>
<script src="assets/vendor/bootstrap/bootstrap.bundle.min.js"></script>
<script src="assets/js/app.js?v=<?= APP_VERSION ?>"></script>
</body>
</html>
    <?php
}
