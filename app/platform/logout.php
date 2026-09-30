<?php
declare(strict_types=1);

if (is_post()) {
    platform_audit('platform.logout');
    unset($_SESSION['super_admin_id']);
    session_regenerate_id(true);
}
header('Location: index.php?p=platform/login');
exit;
