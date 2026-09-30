<?php
declare(strict_types=1);

if (super_admin()) {
    header('Location: index.php?p=platform');
    exit;
}
$error = '';
$email = '';
if (is_post()) {
    $email = strtolower(input('email'));
    $attempts = $_SESSION['platform_attempts'] ?? ['n' => 0, 't' => time()];
    if (time() - $attempts['t'] > 900) {
        $attempts = ['n' => 0, 't' => time()];
    }
    if ($attempts['n'] >= 5) {
        $error = 'Terlalu banyak cubaan. Sila cuba semula dalam 15 minit.';
    } else {
        $st = platform_db()->prepare('SELECT * FROM super_admins WHERE email = ?');
        $st->execute([$email]);
        $admin = $st->fetch();
        if (!$admin || !password_verify((string) ($_POST['password'] ?? ''), $admin['password_hash'])) {
            $attempts['n']++;
            $_SESSION['platform_attempts'] = $attempts;
            usleep(400000);
            $error = 'E-mel atau kata laluan tidak sah.';
        } else {
            unset($_SESSION['platform_attempts']);
            session_regenerate_id(true);
            $_SESSION['super_admin_id'] = (int) $admin['id'];
            platform_db()->prepare("UPDATE super_admins SET last_login_at = datetime('now','localtime') WHERE id = ?")->execute([$admin['id']]);
            platform_audit('platform.login', $email);
            header('Location: index.php?p=platform');
            exit;
        }
    }
}

platform_header('Log Masuk');
?>
<div class="mx-auto" style="max-width: 420px">
    <div class="card">
        <div class="card-body p-4">
            <h1 class="h4 fw-bold mb-1">Log masuk Super Admin</h1>
            <p class="text-body-secondary small">Untuk pemilik platform sahaja. Guru dan admin sekolah log masuk melalui pautan sekolah masing-masing.</p>
            <?php if ($error): ?><div class="alert alert-danger py-2 small"><?= e($error) ?></div><?php endif; ?>
            <form method="post">
                <?= csrf_field() ?>
                <div class="mb-3"><label class="form-label fw-semibold">E-mel</label><input type="email" class="form-control" name="email" value="<?= e($email) ?>" required autofocus autocomplete="username"></div>
                <div class="mb-4"><label class="form-label fw-semibold">Kata laluan</label><input type="password" class="form-control" name="password" required autocomplete="current-password"></div>
                <button class="btn btn-primary w-100">Log Masuk</button>
            </form>
        </div>
    </div>
</div>
<?php platform_footer();
