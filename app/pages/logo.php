<?php
declare(strict_types=1);

// Serves the school logo stored in the settings table.
$data = setting('logo_data');
$mime = setting('logo_mime');
if (!$data || !in_array($mime, LOGO_MIMES, true)) {
    http_response_code(404);
    exit;
}
$etag = '"' . setting('logo_version') . '"';
header('Content-Type: ' . $mime);
header('Cache-Control: public, max-age=' . (query('v') === setting('logo_version') ? '31536000, immutable' : '300'));
header('ETag: ' . $etag);
header("Content-Security-Policy: default-src 'none'");
if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
    http_response_code(304);
    exit;
}
echo base64_decode($data);
