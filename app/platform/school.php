<?php
declare(strict_types=1);

$st = platform_db()->prepare('SELECT * FROM schools WHERE id = ?');
$st->execute([(int) query('id')]);
$school = $st->fetch();
if (!$school) {
    flash('warning', 'Sekolah tidak dijumpai.');
    header('Location: index.php?p=platform');
    exit;
}
$self = 'index.php?p=platform/school&id=' . $school['id'];
$path = school_db_path($school['slug']);

// Backup download (GET): a consistent copy of this school's database.
if (query('backup') === '1') {
    $tmp = tempnam(sys_get_temp_dir(), 'tb');
    $src = open_school_db($path);
    @unlink($tmp);
    $src->exec('VACUUM INTO ' . $src->quote($tmp));
    platform_audit('school.backup', $school['slug']);
    header('Content-Type: application/vnd.sqlite3');
    header('Content-Disposition: attachment; filename="sandaran-' . $school['slug'] . '-' . date('Ymd-His') . '.sqlite"');
    header('Content-Length: ' . filesize($tmp));
    readfile($tmp);
    @unlink($tmp);
    exit;
}

if (is_post()) {
    $action = input('action');
    $pdo = platform_db();
    switch ($action) {
        case 'save':
            $name = input('name');
            if (mb_strlen($name) < 3) {
                flash('danger', 'Sila masukkan nama sekolah.');
                break;
            }
            $pdo->prepare('UPDATE schools SET name=?, school_code=?, contact_name=?, contact_email=?, contact_phone=?, notes=? WHERE id=?')
                ->execute([$name, input('school_code') ?: null, input('contact_name') ?: null, input('contact_email') ?: null, input('contact_phone') ?: null, input('notes') ?: null, $school['id']]);
            platform_audit('school.update', $school['slug']);
            flash('success', 'Maklumat sekolah dikemas kini.');
            break;

        case 'suspend':
        case 'activate':
            $pdo->prepare('UPDATE schools SET status = ? WHERE id = ?')->execute([$action === 'suspend' ? 'suspended' : 'active', $school['id']]);
            platform_audit('school.' . $action, $school['slug']);
            flash('success', $action === 'suspend' ? 'Sekolah digantung. Guru dan admin sekolah tidak boleh log masuk sehingga diaktifkan semula.' : 'Sekolah diaktifkan semula.');
            break;

        case 'reset_admin':
            $sdb = open_school_db($path);
            $uid = (int) input('user_id');
            $u = $sdb->prepare("SELECT * FROM users WHERE id = ? AND role = 'admin'");
            $u->execute([$uid]);
            if ($admin = $u->fetch()) {
                $pw = random_password();
                $sdb->prepare("UPDATE users SET password_hash = ?, must_change_password = 1, status = 'active' WHERE id = ?")->execute([password_hash($pw, PASSWORD_DEFAULT), $uid]);
                platform_audit('school.reset_admin', $school['slug'] . ' – ' . $admin['email']);
                $_SESSION['reset_credentials'] = ['email' => $admin['email'], 'password' => $pw];
            }
            break;

        case 'add_admin':
            $sdb = open_school_db($path);
            $email = strtolower(input('email'));
            $name = input('admin_name');
            if (mb_strlen($name) < 3 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                flash('danger', 'Sila masukkan nama dan e-mel admin yang sah.');
                break;
            }
            $x = $sdb->prepare('SELECT id FROM users WHERE email = ?');
            $x->execute([$email]);
            $pw = random_password();
            if ($existing = $x->fetchColumn()) {
                // Promote an existing teacher account at this school.
                $sdb->prepare("UPDATE users SET role = 'admin', status = 'active', password_hash = ?, must_change_password = 1 WHERE id = ?")->execute([password_hash($pw, PASSWORD_DEFAULT), $existing]);
            } else {
                $sdb->prepare("INSERT INTO users(name, email, department, password_hash, role, must_change_password) VALUES (?,?, 'Pentadbiran', ?, 'admin', 1)")
                    ->execute([$name, $email, password_hash($pw, PASSWORD_DEFAULT)]);
            }
            platform_audit('school.add_admin', $school['slug'] . ' – ' . $email);
            $_SESSION['reset_credentials'] = ['email' => $email, 'password' => $pw];
            break;

        case 'delete':
            if (input('confirm_slug') !== $school['slug']) {
                flash('danger', 'Kod pengesahan tidak sepadan. Sekolah tidak dipadam.');
                break;
            }
            // Keep the data file (renamed) so an accidental delete can be recovered by hand.
            if (!is_dir(DATA_DIR . '/deleted')) {
                mkdir(DATA_DIR . '/deleted', 0775, true);
            }
            $stamp = date('Ymd-His');
            foreach (['', '-wal', '-shm'] as $suffix) {
                if (is_file($path . $suffix)) {
                    rename($path . $suffix, DATA_DIR . '/deleted/' . $school['slug'] . '-' . $stamp . '.sqlite' . $suffix);
                }
            }
            $pdo->prepare('DELETE FROM schools WHERE id = ?')->execute([$school['id']]);
            platform_audit('school.delete', $school['slug'] . ' – ' . $school['name']);
            flash('success', 'Sekolah ' . $school['name'] . ' dipadam. Salinan data disimpan dalam folder data/deleted.');
            header('Location: index.php?p=platform');
            exit;
    }
    header('Location: ' . $self);
    exit;
}

$stats = school_stats($school);
$creds = $_SESSION['reset_credentials'] ?? null;
unset($_SESSION['reset_credentials']);

platform_header($school['name'], 'schools');
?>
<a href="index.php?p=platform" class="small"><i class="bi bi-arrow-left me-1"></i>Semua sekolah</a>
<div class="page-head mt-1">
    <div>
        <h1 class="page-title"><?= e($school['name']) ?> <?= $school['status'] === 'active' ? '<span class="badge badge-soft-success fs-6 align-middle">Aktif</span>' : '<span class="badge badge-soft-danger fs-6 align-middle">Digantung</span>' ?></h1>
        <p class="page-subtitle"><a href="<?= e(school_url($school['slug'])) ?>" target="_blank" class="school-link"><?= e(school_url($school['slug'])) ?> <i class="bi bi-box-arrow-up-right"></i></a></p>
    </div>
    <div class="page-actions">
        <a href="<?= e($self) ?>&amp;backup=1" class="btn btn-light"><i class="bi bi-download me-1"></i>Muat turun sandaran</a>
        <form method="post" data-confirm="<?= $school['status'] === 'active' ? 'Gantung sekolah ini? Semua guru dan admin sekolah tidak dapat log masuk.' : 'Aktifkan semula sekolah ini?' ?>">
            <?= csrf_field() ?><input type="hidden" name="action" value="<?= $school['status'] === 'active' ? 'suspend' : 'activate' ?>">
            <button class="btn <?= $school['status'] === 'active' ? 'btn-outline-danger' : 'btn-success' ?>"><i class="bi bi-<?= $school['status'] === 'active' ? 'pause-circle' : 'play-circle' ?> me-1"></i><?= $school['status'] === 'active' ? 'Gantung' : 'Aktifkan' ?></button>
        </form>
    </div>
</div>

<?php if ($creds): ?>
    <div class="alert alert-info">
        Kata laluan sementara untuk <strong><?= e($creds['email']) ?></strong>: <code class="fs-6 user-select-all px-2 py-1 bg-body rounded"><?= e($creds['password']) ?></code>
        <div class="small mt-1">Hantar kepada admin sekolah. Ia tidak akan dipaparkan lagi, dan admin akan diminta menukarnya.</div>
    </div>
<?php endif; ?>

<div class="row g-3 mb-4">
    <?php foreach ([['Pengguna aktif', $stats['users'], 'people', 'primary'], ['Bilik khas', $stats['rooms'], 'door-open', 'info'],
        ['Jumlah tempahan', $stats['bookings'], 'calendar-check', 'success'], ['Saiz data', human_size($stats['size']), 'database', 'secondary']] as [$l, $v, $i, $c]): ?>
        <div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon bg-<?= $c ?>-subtle text-<?= $c ?>-emphasis"><i class="bi bi-<?= $i ?>"></i></div><div><div class="stat-value"><?= $v ?></div><div class="stat-label"><?= $l ?></div></div></div></div>
    <?php endforeach; ?>
</div>

<div class="row g-4">
    <div class="col-lg-7">
        <div class="card mb-4">
            <div class="card-header"><h2 class="card-title">Maklumat Sekolah</h2></div>
            <div class="card-body">
                <form method="post">
                    <?= csrf_field() ?><input type="hidden" name="action" value="save">
                    <div class="row g-3">
                        <div class="col-md-8"><label class="form-label fw-semibold">Nama sekolah</label><input class="form-control" name="name" value="<?= e($school['name']) ?>" required></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">Kod sekolah KPM</label><input class="form-control" name="school_code" value="<?= e($school['school_code']) ?>"></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">Pegawai dihubungi</label><input class="form-control" name="contact_name" value="<?= e($school['contact_name']) ?>"></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">E-mel</label><input type="email" class="form-control" name="contact_email" value="<?= e($school['contact_email']) ?>"></div>
                        <div class="col-md-4"><label class="form-label fw-semibold">Telefon</label><input class="form-control" name="contact_phone" value="<?= e($school['contact_phone']) ?>"></div>
                        <div class="col-12"><label class="form-label fw-semibold">Catatan dalaman</label><textarea class="form-control" name="notes" rows="2"><?= e($school['notes']) ?></textarea></div>
                    </div>
                    <div class="form-text">Kod pautan <code><?= e($school['slug']) ?></code> tidak boleh ditukar. Nama yang dipaparkan kepada guru ditetapkan oleh admin sekolah di Tetapan Sistem sekolah.</div>
                    <button class="btn btn-primary mt-3">Simpan</button>
                </form>
            </div>
        </div>
        <div class="card border-danger-subtle">
            <div class="card-header"><h2 class="card-title text-danger"><i class="bi bi-trash me-2"></i>Padam Sekolah</h2></div>
            <div class="card-body">
                <p class="small">Sekolah akan dikeluarkan dari platform dan pautannya berhenti berfungsi. Fail data dipindahkan ke <code>data/deleted/</code> (tidak dimusnahkan) supaya boleh dipulihkan secara manual jika perlu.</p>
                <form method="post" class="d-flex flex-wrap gap-2">
                    <?= csrf_field() ?><input type="hidden" name="action" value="delete">
                    <input class="form-control" style="max-width: 260px" name="confirm_slug" placeholder="Taip <?= e($school['slug']) ?> untuk sahkan" autocomplete="off" required>
                    <button class="btn btn-danger">Padam sekolah</button>
                </form>
            </div>
        </div>
    </div>
    <div class="col-lg-5">
        <div class="card">
            <div class="card-header"><h2 class="card-title"><i class="bi bi-person-badge me-2"></i>Admin Sekolah</h2></div>
            <ul class="list-group list-group-flush">
                <?php if (!$stats['admins']): ?><li class="list-group-item small text-body-secondary">Tiada admin. Tambah seorang di bawah.</li><?php endif; ?>
                <?php foreach ($stats['admins'] as $a): ?>
                    <li class="list-group-item d-flex align-items-center gap-2">
                        <span class="avatar avatar-sm"><?= e(initials($a['name'])) ?></span>
                        <div class="flex-grow-1 min-w-0"><div class="fw-semibold small text-truncate"><?= e($a['name']) ?></div><div class="xsmall text-body-secondary text-truncate"><?= e($a['email']) ?> · <?= $a['last_login_at'] ? 'log masuk ' . fmt_datetime($a['last_login_at']) : 'belum log masuk' ?></div></div>
                        <form method="post" data-confirm="Jana kata laluan sementara baharu untuk <?= e($a['email']) ?>?">
                            <?= csrf_field() ?><input type="hidden" name="action" value="reset_admin"><input type="hidden" name="user_id" value="<?= (int) $a['id'] ?>">
                            <button class="btn btn-sm btn-light" title="Set semula kata laluan"><i class="bi bi-key"></i></button>
                        </form>
                    </li>
                <?php endforeach; ?>
            </ul>
            <div class="card-body border-top">
                <form method="post" class="row g-2">
                    <?= csrf_field() ?><input type="hidden" name="action" value="add_admin">
                    <div class="col-12 small fw-semibold">Tambah admin</div>
                    <div class="col-sm-6"><input class="form-control form-control-sm" name="admin_name" placeholder="Nama" required></div>
                    <div class="col-sm-6"><input type="email" class="form-control form-control-sm" name="email" placeholder="E-mel" required></div>
                    <div class="col-12"><button class="btn btn-sm btn-primary">Tambah &amp; jana kata laluan</button></div>
                </form>
            </div>
        </div>
    </div>
</div>
<?php platform_footer();
