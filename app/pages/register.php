<?php
declare(strict_types=1);

if (setting('allow_registration') !== '1') {
    flash('warning', 'Pendaftaran akaun baharu ditutup. Sila hubungi pentadbir.');
    redirect('login');
}

$errors = [];
$old = ['name' => '', 'email' => '', 'phone' => '', 'department' => ''];

if (is_post()) {
    foreach ($old as $k => $_) {
        $old[$k] = input($k);
    }
    $password = (string) ($_POST['password'] ?? '');
    $domain = trim((string) setting('email_domain'), " @");

    if (mb_strlen($old['name']) < 3) $errors[] = 'Sila masukkan nama penuh.';
    if (!filter_var($old['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'Alamat e-mel tidak sah.';
    elseif ($domain !== '' && !str_ends_with(strtolower($old['email']), '@' . strtolower($domain))) $errors[] = "Hanya e-mel berdomain @{$domain} dibenarkan.";
    if (strlen($password) < 8) $errors[] = 'Kata laluan mestilah sekurang-kurangnya 8 aksara.';
    if ($password !== ($_POST['password_confirm'] ?? '')) $errors[] = 'Pengesahan kata laluan tidak sepadan.';

    if (!$errors) {
        $st = db()->prepare('SELECT 1 FROM users WHERE email = ?');
        $st->execute([$old['email']]);
        if ($st->fetchColumn()) {
            $errors[] = 'E-mel ini telah didaftarkan.';
        }
    }

    if (!$errors) {
        db()->prepare("INSERT INTO users(name, email, phone, department, password_hash, role, status) VALUES (?,?,?,?,?, 'guru', 'pending')")
            ->execute([$old['name'], $old['email'], $old['phone'] ?: null, $old['department'] ?: null, password_hash($password, PASSWORD_DEFAULT)]);
        audit('auth.register', $old['email']);
        notify_admins('Pendaftaran pengguna baharu', $old['name'] . ' (' . $old['email'] . ') menunggu pengesahan akaun.', url('admin/users', ['status' => 'pending']));
        flash('success', 'Pendaftaran berjaya! Akaun anda akan diaktifkan selepas disahkan oleh pentadbir.');
        redirect('login');
    }
}

render_guest_header('Daftar Akaun');
?>
<div class="auth-wrap">
    <section class="auth-hero">
        <div class="auth-hero-inner">
            <div class="d-flex align-items-center gap-3 mb-5">
                <span class="brand-logo lg"><i class="bi bi-buildings"></i></span>
                <div>
                    <div class="fw-bold fs-5"><?= e(setting('system_name')) ?></div>
                    <div class="opacity-75 small"><?= e(setting('school_name')) ?></div>
                </div>
            </div>
            <h1 class="display-6 fw-bold mb-3">Daftar akaun guru</h1>
            <p class="lead opacity-75">Selepas mendaftar, pentadbir akan mengesahkan akaun anda sebelum anda boleh membuat tempahan.</p>
            <ol class="steps mt-5">
                <li><strong>Isi maklumat</strong><span>Nama, e-mel &amp; panitia/unit</span></li>
                <li><strong>Pengesahan pentadbir</strong><span>Akaun disemak &amp; diaktifkan</span></li>
                <li><strong>Mula menempah</strong><span>Semak kekosongan &amp; tempah bilik</span></li>
            </ol>
        </div>
    </section>
    <section class="auth-panel">
        <div class="auth-card">
            <h2 class="h3 fw-bold mb-1">Cipta akaun</h2>
            <p class="text-body-secondary mb-4">Semua maklumat bertanda <span class="text-danger">*</span> wajib diisi.</p>
            <?php if ($errors): ?>
                <div class="alert alert-danger py-2"><ul class="mb-0 ps-3"><?php foreach ($errors as $err): ?><li><?= e($err) ?></li><?php endforeach; ?></ul></div>
            <?php endif; ?>
            <form method="post">
                <?= csrf_field() ?>
                <div class="mb-3">
                    <label class="form-label fw-semibold">Nama penuh <span class="text-danger">*</span></label>
                    <input class="form-control" name="name" value="<?= e($old['name']) ?>" required>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-semibold">E-mel <span class="text-danger">*</span></label>
                    <input type="email" class="form-control" name="email" value="<?= e($old['email']) ?>" required placeholder="<?= setting('email_domain') ? 'nama@' . e(setting('email_domain')) : 'nama@sekolah.edu.my' ?>">
                </div>
                <div class="row g-3 mb-3">
                    <div class="col-sm-6">
                        <label class="form-label fw-semibold">No. telefon</label>
                        <input class="form-control" name="phone" value="<?= e($old['phone']) ?>" placeholder="012-3456789">
                    </div>
                    <div class="col-sm-6">
                        <label class="form-label fw-semibold">Panitia / Unit</label>
                        <input class="form-control" name="department" value="<?= e($old['department']) ?>" placeholder="cth. Sains">
                    </div>
                </div>
                <div class="row g-3 mb-4">
                    <div class="col-sm-6">
                        <label class="form-label fw-semibold">Kata laluan <span class="text-danger">*</span></label>
                        <input type="password" class="form-control" name="password" minlength="8" required>
                    </div>
                    <div class="col-sm-6">
                        <label class="form-label fw-semibold">Sahkan kata laluan <span class="text-danger">*</span></label>
                        <input type="password" class="form-control" name="password_confirm" minlength="8" required>
                    </div>
                </div>
                <button class="btn btn-primary btn-lg w-100 fw-semibold">Daftar</button>
            </form>
            <p class="text-center text-body-secondary mt-4 mb-0">Sudah mempunyai akaun? <a href="<?= url('login') ?>" class="fw-semibold">Log masuk</a></p>
        </div>
    </section>
</div>
<?php render_guest_footer();
