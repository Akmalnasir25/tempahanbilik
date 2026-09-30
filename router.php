<?php
// Router for PHP's built-in server:  php -S localhost:8000 router.php
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');
if (preg_match('#^/(app|data)(/|$)|/\.|\.(sqlite|md)$|^/(config|router)\.php$#i', $path)) {
    http_response_code(403);
    exit('403 Forbidden');
}
if ($path !== '/' && is_file(__DIR__ . $path) && !str_ends_with($path, '.php')) {
    return false; // static asset
}
if ($path === '/api.php') {
    require __DIR__ . '/api.php';
    return true;
}
require __DIR__ . '/index.php';
