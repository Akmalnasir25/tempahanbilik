<?php
declare(strict_types=1);

// First run only: create the first super admin (the platform owner).
$errors = [];
$old = ['name' => '', 'email' => ''];
if (is_post()) {
    $old = ['name' => input('name'), 'email' => strtolower(input('email'))];
    $pw = (string) ($_POST['password'] ?? '');
    if (mb_strlen($old['name']) < 3) $errors[] = 'Sila masukkan nama.';
    if (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'E-mel tidak sah.';
    if (strlen($pw) < 10) $errors[] = 'Kata laluan Super Admin mestilah sekurang-kurangnya 10 aksara.';
    if ($pw !== ($_POST['password_confirm'] ?? '')) $errors[] = 'Pengesahan kata laluan tidak sepadan.';
    if (!$errors) {
        $pdo = platform_db();
        $pdo->exec('BEGIN IMMEDIATE');
        if ((int) $pdo->query('SELECT COUNT(*) FROM super_admins')->fetchColumn() === 0) {
            $pdo->prepare('INSERT INTO super_admins(name, email, password_hash) VALUES (?,?,?)')->execute([$old['name'], $old['email'], password_hash($pw, PASSWORD_DEFAULT)]);
            $id = (int) $pdo->lastInsertId();
            $pdo->exec('COMMIT');
            session_regenerate_id(true);
            $_SESSION['super_admin_id'] = $id;
            platform_audit('platform.setup', $old['email']);
            flash('success', 'Akaun Super Admin dicipta. Sekarang cipta sekolah pertama anda.');
            header('Location: index.php?p=platform/new');
            exit;
        }
        $pdo->exec('ROLLBACK');
        header('Location: index.php?p=platform/login');
        exit;
    }
}

platform_header('Persediaan Platform');
?>
<div class="mx-auto" style="max-width: 520px">
    <div class="card">
        <div class="card-body p-4">
            <h1 class="h4 fw-bold mb-1">Persediaan pertama platform</h1>
            <p class="text-body-secondary">Cipta akaun <strong>Super Admin</strong> anda. Akaun ini digunakan untuk mendaftar dan mengurus sekolah, dan tidak boleh mencapai data tempahan sekolah.</p>
            <div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>Halaman ini hanya muncul sekali. Lengkapkan sekarang sebelum orang lain membukanya.</div>
            <?php if ($errors): ?><div class="alert alert-danger small"><?= implode('<br>', array_map('e', $errors)) ?></div><?php endif; ?>
            <form method="post">
                <?= csrf_field() ?>
                <div class="mb-3"><label class="form-label fw-semibold">Nama</label><input class="form-control" name="name" value="<?= e($old['name']) ?>" required></div>
                <div class="mb-3"><label class="form-label fw-semibold">E-mel</label><input type="email" class="form-control" name="email" value="<?= e($old['email']) ?>" required></div>
                <div class="row g-3 mb-4">
                    <div class="col-sm-6"><label class="form-label fw-semibold">Kata laluan</label><input type="password" class="form-control" name="password" minlength="10" required autocomplete="new-password"></div>
                    <div class="col-sm-6"><label class="form-label fw-semibold">Sahkan</label><input type="password" class="form-control" name="password_confirm" minlength="10" required autocomplete="new-password"></div>
                </div>
                <button class="btn btn-primary w-100">Cipta akaun Super Admin</button>
            </form>
        </div>
    </div>
</div>
<?php platform_footer();
