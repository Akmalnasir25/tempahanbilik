<?php
declare(strict_types=1);

if (is_post() && current_user()) {
    audit('auth.logout', current_user()['email']);
    unset($_SESSION['auth'][school_slug()]);
    session_regenerate_id(true);
    flash('success', 'Anda telah log keluar.');
}
redirect('login');
