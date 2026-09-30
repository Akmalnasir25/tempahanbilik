<?php
declare(strict_types=1);

/**
 * Super admin (platform owner) area: index.php?p=platform[/...]
 * Manages the school registry; never reads or writes teachers' bookings directly.
 */

require APP_DIR . '/platform/layout.php';

$routes = [
    'platform'          => 'schools.php',
    'platform/school'   => 'school.php',
    'platform/new'      => 'school_new.php',
    'platform/audit'    => 'audit.php',
    'platform/account'  => 'account.php',
    'platform/login'    => 'login.php',
    'platform/setup'    => 'setup.php',
    'platform/logout'   => 'logout.php',
];

$page = (string) $_GET['p'];
if (!isset($routes[$page])) {
    $page = 'platform';
}

try {
    if (is_post()) {
        verify_csrf();
    }
    $hasAdmins = (int) platform_db()->query('SELECT COUNT(*) FROM super_admins')->fetchColumn() > 0;
    if (!$hasAdmins && $page !== 'platform/setup') {
        header('Location: index.php?p=platform/setup');
        exit;
    }
    if ($hasAdmins && $page === 'platform/setup') {
        header('Location: index.php?p=platform/login');
        exit;
    }
    if (!in_array($page, ['platform/login', 'platform/setup'], true) && !super_admin()) {
        header('Location: index.php?p=platform/login');
        exit;
    }
    require APP_DIR . '/platform/' . $routes[$page];
} catch (Throwable $e) {
    error_log((string) $e);
    http_response_code(500);
    echo '<!doctype html><meta charset="utf-8"><title>Ralat</title><div style="font-family:sans-serif;max-width:560px;margin:10vh auto;padding:24px">';
    echo '<h2>Maaf, berlaku ralat sistem.</h2>';
    if (APP_DEBUG) {
        echo '<pre style="white-space:pre-wrap;background:#f1f5f9;padding:12px">' . e($e) . '</pre>';
    }
    echo '<p><a href="index.php?p=platform">Kembali</a></p></div>';
}
