<?php
declare(strict_types=1);

$user = current_user();

if (is_post()) {
    if (input('action') === 'profile') {
        $name = input('name');
        if (mb_strlen($name) < 3) {
            flash('danger', 'Sila masukkan nama penuh.');
        } else {
            db()->prepare('UPDATE users SET name = ?, phone = ?, department = ? WHERE id = ?')
                ->execute([$name, input('phone') ?: null, input('department') ?: null, $user['id']]);
            audit('profile.update');
            flash('success', 'Profil berjaya dikemas kini.');
        }
    } elseif (input('action') === 'password') {
        $current = (string) ($_POST['current_password'] ?? '');
        $new = (string) ($_POST['new_password'] ?? '');
        if (!password_verify($current, $user['password_hash'])) {
            flash('danger', 'Kata laluan semasa tidak tepat.');
        } elseif (strlen($new) < 8) {
            flash('danger', 'Kata laluan baharu mestilah sekurang-kurangnya 8 aksara.');
        } elseif ($new !== ($_POST['confirm_password'] ?? '')) {
            flash('danger', 'Pengesahan kata laluan tidak sepadan.');
        } elseif ($new === $current) {
            flash('danger', 'Kata laluan baharu mestilah berbeza daripada kata laluan semasa.');
        } else {
            db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?')
                ->execute([password_hash($new, PASSWORD_DEFAULT), $user['id']]);
            session_regenerate_id(true);
            audit('profile.password');
            flash('success', 'Kata laluan berjaya ditukar.');
        }
    }
    redirect('profile');
}

$st = db()->prepare("SELECT COUNT(*) AS total,
    SUM(status = 'approved') AS approved, SUM(status = 'pending') AS pending, SUM(status IN ('cancelled','rejected')) AS closed
    FROM bookings WHERE user_id = ?");
$st->execute([$user['id']]);
$s = array_map('intval', $st->fetch());

render_header('Profil Saya', '');
page_title('Profil Saya', 'Urus maklumat akaun dan kata laluan anda.');
?>
<div class="row g-4">
    <div class="col-lg-4">
        <div class="card text-center">
            <div class="card-body p-4">
                <div class="avatar avatar-xl mx-auto mb-3"><?= e(initials($user['name'])) ?></div>
                <h2 class="h5 fw-bold mb-0"><?= e($user['name']) ?></h2>
                <div class="text-body-secondary small mb-2"><?= e($user['email']) ?></div>
                <span class="badge badge-soft-primary"><?= $user['role'] === 'admin' ? 'Pentadbir' : 'Guru' ?></span>
                <div class="row g-0 mt-4 border-top pt-3">
                    <div class="col"><div class="fw-bold fs-5"><?= $s['total'] ?></div><div class="xsmall text-body-secondary">Jumlah</div></div>
                    <div class="col"><div class="fw-bold fs-5 text-success"><?= $s['approved'] ?></div><div class="xsmall text-body-secondary">Lulus</div></div>
                    <div class="col"><div class="fw-bold fs-5 text-warning"><?= $s['pending'] ?></div><div class="xsmall text-body-secondary">Menunggu</div></div>
                </div>
                <div class="xsmall text-body-tertiary mt-3">Log masuk terakhir: <?= fmt_datetime($user['last_login_at']) ?></div>
            </div>
        </div>
    </div>
    <div class="col-lg-8">
        <div class="card mb-4">
            <div class="card-header"><h2 class="card-title">Maklumat Peribadi</h2></div>
            <div class="card-body">
                <form method="post">
                    <?= csrf_field() ?><input type="hidden" name="action" value="profile">
                    <div class="row g-3">
                        <div class="col-md-6"><label class="form-label fw-semibold">Nama penuh</label><input class="form-control" name="name" value="<?= e($user['name']) ?>" required></div>
                        <div class="col-md-6"><label class="form-label fw-semibold">E-mel</label><input class="form-control" value="<?= e($user['email']) ?>" disabled><div class="form-text">Hubungi pentadbir untuk menukar e-mel.</div></div>
                        <div class="col-md-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone" value="<?= e($user['phone']) ?>"></div>
                        <div class="col-md-6"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" value="<?= e($user['department']) ?>"></div>
                    </div>
                    <button class="btn btn-primary mt-3">Simpan</button>
                </form>
            </div>
        </div>
        <div class="card" id="password">
            <div class="card-header"><h2 class="card-title">Tukar Kata Laluan</h2></div>
            <div class="card-body">
                <form method="post">
                    <?= csrf_field() ?><input type="hidden" name="action" value="password">
                    <div class="row g-3">
                        <div class="col-md-4"><label class="form-label fw-semibold">Kata laluan semasa</label><input type="password" class="form-control" name="current_password" required autocomplete="current-password"></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">Kata laluan baharu</label><input type="password" class="form-control" name="new_password" minlength="8" required autocomplete="new-password"></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">Sahkan kata laluan</label><input type="password" class="form-control" name="confirm_password" minlength="8" required autocomplete="new-password"></div>
                    </div>
                    <button class="btn btn-primary mt-3">Tukar Kata Laluan</button>
                </form>
            </div>
        </div>
    </div>
</div>
<?php render_footer();
