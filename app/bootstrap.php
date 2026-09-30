<?php
declare(strict_types=1);

define('APP_ROOT', dirname(__DIR__));
define('APP_DIR', __DIR__);
define('APP_VERSION', '1.0.0');

$config = [
    'data_dir' => APP_ROOT . '/data',
    'timezone' => 'Asia/Kuala_Lumpur',
    'debug'    => false,
    // Name shown on the platform landing page and super admin panel.
    'platform_name' => 'Sistem Tempahan Bilik Khas',
];
if (is_file(APP_ROOT . '/config.php')) {
    $config = array_merge($config, (array) require APP_ROOT . '/config.php');
}
define('DATA_DIR', rtrim($config['data_dir'], '/'));
define('APP_DEBUG', (bool) $config['debug']);
define('PLATFORM_NAME', (string) $config['platform_name']);

date_default_timezone_set($config['timezone']);
ini_set('display_errors', APP_DEBUG ? '1' : '0');
error_reporting(E_ALL);

if (session_status() !== PHP_SESSION_ACTIVE && PHP_SAPI !== 'cli') {
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name('TBSESSID');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'secure'   => $secure,
        'samesite' => 'Lax',
    ]);
    session_start();
}

if (PHP_SAPI !== 'cli') {
    header('X-Frame-Options: SAMEORIGIN');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
}

require APP_DIR . '/tenancy.php';
require APP_DIR . '/db.php';
require APP_DIR . '/helpers.php';
require APP_DIR . '/booking.php';
require APP_DIR . '/views/layout.php';
