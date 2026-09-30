<?php
declare(strict_types=1);

require __DIR__ . '/app/bootstrap.php';

// page => [file, access]  access: guest | public | user | admin
$routes = [
    'login'          => ['login.php', 'guest'],
    'register'       => ['register.php', 'guest'],
    'logout'         => ['logout.php', 'public'],
    'display'        => ['display.php', 'public'],
    'logo'           => ['logo.php', 'public'],
    'dashboard'      => ['dashboard.php', 'user'],
    'book'           => ['book.php', 'user'],
    'availability'   => ['availability.php', 'user'],
    'calendar'       => ['calendar.php', 'user'],
    'my-bookings'    => ['my_bookings.php', 'user'],
    'booking'        => ['booking_view.php', 'user'],
    'rooms'          => ['rooms.php', 'user'],
    'notifications'  => ['notifications.php', 'user'],
    'profile'        => ['profile.php', 'user'],
    'admin/bookings' => ['admin/bookings.php', 'admin'],
    'admin/rooms'    => ['admin/rooms.php', 'admin'],
    'admin/users'    => ['admin/users.php', 'admin'],
    'admin/closures' => ['admin/closures.php', 'admin'],
    'admin/periods'  => ['admin/periods.php', 'admin'],
    'admin/reports'  => ['admin/reports.php', 'admin'],
    'admin/settings' => ['admin/settings.php', 'admin'],
    'admin/audit'    => ['admin/audit.php', 'admin'],
];

$page = is_string($_GET['p'] ?? null) ? $_GET['p'] : 'dashboard';
if (!isset($routes[$page])) {
    http_response_code(404);
    $page = current_user() ? 'dashboard' : 'login';
    flash('warning', 'Halaman yang diminta tidak dijumpai.');
}
[$file, $access] = $routes[$page];

try {
    match ($access) {
        'guest' => current_user() ? redirect('dashboard') : null,
        'user'  => require_login(),
        'admin' => require_admin(),
        default => null,
    };
    if (is_post()) {
        verify_csrf();
    }
    require APP_DIR . '/pages/' . $file;
} catch (Throwable $e) {
    error_log((string) $e);
    http_response_code(500);
    echo '<!doctype html><meta charset="utf-8"><title>Ralat</title><div style="font-family:sans-serif;max-width:560px;margin:10vh auto;padding:24px">';
    echo '<h2>Maaf, berlaku ralat sistem.</h2><p>Sila cuba sebentar lagi atau hubungi pentadbir sistem.</p>';
    if (APP_DEBUG) {
        echo '<pre style="white-space:pre-wrap;background:#f1f5f9;padding:12px">' . e($e) . '</pre>';
    }
    echo '<p><a href="index.php">Kembali ke laman utama</a></p></div>';
}
