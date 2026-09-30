<?php
declare(strict_types=1);

$admin = super_admin();
if (is_post()) {
    $pdo = platform_db();
    if (input('action') === 'password') {
        $new = (string) ($_POST['new_password'] ?? '');
        if (!password_verify((string) ($_POST['current_password'] ?? ''), $admin['password_hash'])) {
            flash('danger', 'Kata laluan semasa tidak tepat.');
        } elseif (strlen($new) < 10) {
            flash('danger', 'Kata laluan baharu mestilah sekurang-kurangnya 10 aksara.');
        } elseif ($new !== ($_POST['confirm_password'] ?? '')) {
            flash('danger', 'Pengesahan kata laluan tidak sepadan.');
        } else {
            $pdo->prepare('UPDATE super_admins SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $admin['id']]);
            session_regenerate_id(true);
            platform_audit('platform.password');
            flash('success', 'Kata laluan ditukar.');
        }
    } elseif (input('action') === 'add') {
        $email = strtolower(input('email'));
        $pw = (string) ($_POST['password'] ?? '');
        $x = $pdo->prepare('SELECT 1 FROM super_admins WHERE email = ?');
        $x->execute([$email]);
        if (mb_strlen(input('name')) < 3 || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($pw) < 10) {
            flash('danger', 'Sila masukkan nama, e-mel yang sah dan kata laluan sekurang-kurangnya 10 aksara.');
        } elseif ($x->fetchColumn()) {
            flash('danger', 'E-mel ini sudah didaftarkan.');
        } else {
            $pdo->prepare('INSERT INTO super_admins(name, email, password_hash) VALUES (?,?,?)')->execute([input('name'), $email, password_hash($pw, PASSWORD_DEFAULT)]);
            platform_audit('platform.add_admin', $email);
            flash('success', 'Super Admin ' . $email . ' ditambah.');
        }
    }
    header('Location: index.php?p=platform/account');
    exit;
}
$admins = platform_db()->query('SELECT id, name, email, last_login_at FROM super_admins ORDER BY name')->fetchAll();

platform_header('Akaun', 'account');
?>
<h1 class="page-title mb-4">Akaun Super Admin</h1>
<div class="row g-4">
    <div class="col-lg-6">
        <div class="card">
            <div class="card-header"><h2 class="card-title">Tukar Kata Laluan</h2></div>
            <div class="card-body">
                <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="password">
                    <div class="mb-3"><label class="form-label fw-semibold">Kata laluan semasa</label><input type="password" class="form-control" name="current_password" required autocomplete="current-password"></div>
                    <div class="row g-3 mb-3">
                        <div class="col-sm-6"><label class="form-label fw-semibold">Kata laluan baharu</label><input type="password" class="form-control" name="new_password" minlength="10" required autocomplete="new-password"></div>
                        <div class="col-sm-6"><label class="form-label fw-semibold">Sahkan</label><input type="password" class="form-control" name="confirm_password" minlength="10" required autocomplete="new-password"></div>
                    </div>
                    <button class="btn btn-primary">Tukar</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="card">
            <div class="card-header"><h2 class="card-title">Super Admin</h2></div>
            <ul class="list-group list-group-flush">
                <?php foreach ($admins as $a): ?>
                    <li class="list-group-item small"><strong><?= e($a['name']) ?></strong> · <?= e($a['email']) ?><div class="xsmall text-body-secondary">Log masuk terakhir: <?= fmt_datetime($a['last_login_at']) ?></div></li>
                <?php endforeach; ?>
            </ul>
            <div class="card-body border-top">
                <form method="post" class="row g-2"><?= csrf_field() ?><input type="hidden" name="action" value="add">
                    <div class="col-12 small fw-semibold">Tambah Super Admin</div>
                    <div class="col-sm-6"><input class="form-control form-control-sm" name="name" placeholder="Nama" required></div>
                    <div class="col-sm-6"><input type="email" class="form-control form-control-sm" name="email" placeholder="E-mel" required></div>
                    <div class="col-sm-8"><input type="password" class="form-control form-control-sm" name="password" placeholder="Kata laluan (min. 10 aksara)" minlength="10" required autocomplete="new-password"></div>
                    <div class="col-sm-4"><button class="btn btn-sm btn-primary w-100">Tambah</button></div>
                </form>
            </div>
        </div>
    </div>
</div>
<?php platform_footer();
