<?php
// Salin fail ini kepada config.php untuk mengubah tetapan lalai.
return [
    // Lokasi folder pangkalan data SQLite. Sebaik-baiknya di luar public_html.
    'data_dir' => __DIR__ . '/data',
    'timezone' => 'Asia/Kuala_Lumpur',
    // Papar ralat penuh (untuk pembangunan sahaja — JANGAN aktifkan di pelayan sebenar)
    'debug'    => false,
    // Nama platform di laman utama & panel Super Admin
    'platform_name' => 'Sistem Tempahan Bilik Khas',
];
