<?php
// Router for PHP's built-in server:  php -S localhost:8000 router.php
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if (preg_match('#^/(app|data|design|firebase-gas)(/|$)|/\.|\.(sqlite|md)$|^/(config|router)\.php$#i', $path)) {
    http_response_code(403);
    exit('403 Forbidden');
}
if ($path !== '/' && is_file(__DIR__ . $path) && !str_ends_with($path, '.php')) {
    return false; // static asset
}
// Short school links: /smkabc -> index.php?s=smkabc
if (preg_match('#^/([A-Za-z0-9][A-Za-z0-9-]{1,28}[A-Za-z0-9])/?$#', $path, $m) && !is_file(__DIR__ . $path) && !is_dir(__DIR__ . $path)) {
    header('Location: /index.php?s=' . strtolower($m[1]), true, 302);
    exit;
}
if ($path === '/api.php') {
    require __DIR__ . '/api.php';
    return true;
}
require __DIR__ . '/index.php';
