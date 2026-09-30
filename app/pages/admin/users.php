<?php
declare(strict_types=1);

$me = current_user();

function find_user(int $id): ?array
{
    $st = db()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function temp_password(): string
{
    $chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $s = '';
    for ($i = 0; $i < 10; $i++) {
        $s .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $s;
}

if (is_post()) {
    $action = input('action');
    $id = (int) input('id');
    $target = $id ? find_user($id) : null;

    if ($id && !$target) {
        flash('danger', 'Pengguna tidak dijumpai.');
        redirect('admin/users');
    }
    if ($target && (int) $target['id'] === (int) $me['id'] && in_array($action, ['deactivate', 'delete'], true)) {
        flash('danger', 'Anda tidak boleh menyahaktif atau memadam akaun anda sendiri.');
        redirect('admin/users');
    }

    switch ($action) {
        case 'save':
            $d = ['name' => input('name'), 'email' => strtolower(input('email')), 'phone' => input('phone') ?: null,
                  'department' => input('department') ?: null, 'role' => input('role') === 'admin' ? 'admin' : 'guru'];
            $errors = [];
            if (mb_strlen($d['name']) < 3) $errors[] = 'Nama diperlukan.';
            if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'E-mel tidak sah.';
            $st = db()->prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?');
            $st->execute([$d['email'], $id]);
            if ($st->fetchColumn()) $errors[] = 'E-mel telah digunakan oleh pengguna lain.';
            if ($target && (int) $target['id'] === (int) $me['id'] && $d['role'] !== 'admin') $errors[] = 'Anda tidak boleh membuang peranan pentadbir anda sendiri.';
            if (!$target && input('password') !== '' && strlen(input('password')) < 8) $errors[] = 'Kata laluan awal mestilah sekurang-kurangnya 8 aksara.';
            if ($errors) {
                flash('danger', implode(' ', $errors));
                redirect('admin/users', $id ? ['edit' => $id] : ['new' => 1]);
            }
            if ($target) {
                db()->prepare('UPDATE users SET name=?, email=?, phone=?, department=?, role=? WHERE id=?')->execute([...array_values($d), $id]);
                audit('user.update', $d['email']);
                flash('success', 'Maklumat ' . $d['name'] . ' dikemas kini.');
            } else {
                $pw = input('password') ?: temp_password();
                db()->prepare("INSERT INTO users(name, email, phone, department, role, password_hash, status, must_change_password) VALUES (?,?,?,?,?,?, 'active', 1)")
                    ->execute([...array_values($d), password_hash($pw, PASSWORD_DEFAULT)]);
                audit('user.create', $d['email']);
                $_SESSION['new_password'] = ['name' => $d['name'], 'email' => $d['email'], 'password' => $pw];
                flash('success', 'Akaun ' . $d['name'] . ' berjaya dicipta.');
            }
            break;

        case 'approve':
        case 'activate':
            db()->prepare("UPDATE users SET status = 'active' WHERE id = ?")->execute([$id]);
            audit('user.' . $action, $target['email']);
            notify($id, 'Akaun anda telah diaktifkan', 'Selamat datang! Anda kini boleh membuat tempahan bilik khas.', url('book'));
            flash('success', 'Akaun ' . $target['name'] . ' telah diaktifkan.');
            break;

        case 'deactivate':
            db()->prepare("UPDATE users SET status = 'inactive' WHERE id = ?")->execute([$id]);
            audit('user.deactivate', $target['email']);
            flash('success', 'Akaun ' . $target['name'] . ' telah dinyahaktifkan.');
            break;

        case 'reset':
            $pw = temp_password();
            db()->prepare('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?')->execute([password_hash($pw, PASSWORD_DEFAULT), $id]);
            audit('user.reset_password', $target['email']);
            $_SESSION['new_password'] = ['name' => $target['name'], 'email' => $target['email'], 'password' => $pw];
            flash('success', 'Kata laluan ' . $target['name'] . ' telah ditetapkan semula.');
            break;

        case 'delete':
            $st = db()->prepare('SELECT COUNT(*) FROM bookings WHERE user_id = ?');
            $st->execute([$id]);
            if ((int) $st->fetchColumn() > 0) {
                flash('warning', $target['name'] . ' mempunyai rekod tempahan. Nyahaktifkan akaun untuk mengekalkan rekod.');
            } else {
                db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
                audit('user.delete', $target['email']);
                flash('success', 'Akaun ' . $target['name'] . ' dipadam.');
            }
            break;

        case 'import':
            $lines = preg_split('/\R/', input('bulk'));
            $created = 0;
            $skipped = [];
            $credentials = [];
            foreach ($lines as $line) {
                $parts = array_map('trim', str_getcsv($line, ',', '"', '\\'));
                if (count($parts) < 2 || $parts[0] === '') continue;
                [$name, $email] = $parts;
                $email = strtolower($email);
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipped[] = $email ?: $name; continue; }
                $st = db()->prepare('SELECT 1 FROM users WHERE email = ?');
                $st->execute([$email]);
                if ($st->fetchColumn()) { $skipped[] = $email; continue; }
                $pw = temp_password();
                db()->prepare("INSERT INTO users(name, email, department, password_hash, role, status, must_change_password) VALUES (?,?,?,?, 'guru', 'active', 1)")
                    ->execute([$name, $email, ($parts[2] ?? '') ?: null, password_hash($pw, PASSWORD_DEFAULT)]);
                $credentials[] = [$name, $email, $pw];
                $created++;
            }
            audit('user.import', "{$created} pengguna");
            $_SESSION['import_credentials'] = $credentials;
            flash($created ? 'success' : 'warning', "{$created} akaun dicipta." . ($skipped ? ' Dilangkau (tidak sah/sudah wujud): ' . implode(', ', array_slice($skipped, 0, 10)) : ''));
            break;
    }
    redirect('admin/users', array_filter(['status' => query('status')]));
}

$newPassword = $_SESSION['new_password'] ?? null;
$importCreds = $_SESSION['import_credentials'] ?? null;
unset($_SESSION['new_password'], $_SESSION['import_credentials']);

$form = null;
if ($editId = (int) query('edit')) {
    $form = find_user($editId);
} elseif (query('new')) {
    $form = ['id' => 0, 'name' => '', 'email' => '', 'phone' => '', 'department' => '', 'role' => 'guru'];
}

$status = query('status');
$q = query('q');
$where = '1=1';
$params = [];
if (in_array($status, ['active', 'pending', 'inactive'], true)) { $where .= ' AND u.status = ?'; $params[] = $status; }
if ($q !== '') { $where .= ' AND (u.name LIKE ? OR u.email LIKE ? OR u.department LIKE ?)'; array_push($params, "%$q%", "%$q%", "%$q%"); }
$st = db()->prepare("SELECT COUNT(*) FROM users u WHERE $where");
$st->execute($params);
$pg = paginate((int) $st->fetchColumn(), 25);
$st = db()->prepare("SELECT u.*, (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id) AS bookings
    FROM users u WHERE $where ORDER BY u.status = 'pending' DESC, u.name LIMIT {$pg['limit']} OFFSET {$pg['offset']}");
$st->execute($params);
$users = $st->fetchAll();
$counts = db()->query('SELECT status, COUNT(*) FROM users GROUP BY status')->fetchAll(PDO::FETCH_KEY_PAIR);

render_header('Urus Pengguna', 'admin/users');
page_title('Urus Pengguna', 'Urus akaun guru dan pentadbir.',
    '<button class="btn btn-light" data-bs-toggle="collapse" data-bs-target="#importBox"><i class="bi bi-upload me-1"></i>Import Pukal</button>
     <a href="' . url('admin/users', ['new' => 1]) . '" class="btn btn-primary"><i class="bi bi-person-plus me-1"></i>Tambah Pengguna</a>');
?>
<?php if ($newPassword): ?>
    <div class="alert alert-info d-flex gap-3 align-items-center">
        <i class="bi bi-key fs-3"></i>
        <div>Kata laluan sementara untuk <strong><?= e($newPassword['name']) ?></strong> (<?= e($newPassword['email']) ?>):
            <code class="fs-6 user-select-all px-2 py-1 bg-body rounded"><?= e($newPassword['password']) ?></code>
            <div class="small">Salin dan berikan kepada pengguna. Kata laluan ini tidak akan dipaparkan lagi; pengguna akan diminta menukarnya.</div></div>
    </div>
<?php endif; ?>
<?php if ($importCreds): ?>
    <div class="card mb-4 border-info-subtle">
        <div class="card-header d-flex justify-content-between"><h2 class="card-title">Kata laluan sementara (akaun diimport)</h2><button class="btn btn-sm btn-light" onclick="window.print()"><i class="bi bi-printer"></i></button></div>
        <div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Nama</th><th>E-mel</th><th>Kata laluan</th></tr></thead><tbody>
            <?php foreach ($importCreds as [$n, $em, $pw]): ?><tr><td><?= e($n) ?></td><td><?= e($em) ?></td><td><code><?= e($pw) ?></code></td></tr><?php endforeach; ?>
        </tbody></table></div>
    </div>
<?php endif; ?>

<div class="collapse mb-4" id="importBox">
    <div class="card">
        <div class="card-header"><h2 class="card-title">Import Pukal Guru</h2></div>
        <div class="card-body">
            <form method="post">
                <?= csrf_field() ?><input type="hidden" name="action" value="import">
                <label class="form-label small">Satu guru setiap baris dalam format: <code>Nama, e-mel, Panitia (pilihan)</code></label>
                <textarea name="bulk" class="form-control font-monospace" rows="6" placeholder="Siti Aminah binti Ali, siti@sekolah.edu.my, Bahasa Melayu&#10;Lim Wei Ming, lim@sekolah.edu.my, Matematik"></textarea>
                <button class="btn btn-primary mt-3">Import</button>
            </form>
        </div>
    </div>
</div>

<?php if ($form): ?>
    <div class="card mb-4 border-primary-subtle">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="card-title"><?= $form['id'] ? 'Kemas Kini Pengguna' : 'Tambah Pengguna Baharu' ?></h2>
            <a href="<?= url('admin/users') ?>" class="btn-close"></a>
        </div>
        <div class="card-body">
            <form method="post">
                <?= csrf_field() ?><input type="hidden" name="action" value="save"><input type="hidden" name="id" value="<?= (int) $form['id'] ?>">
                <div class="row g-3">
                    <div class="col-md-4"><label class="form-label fw-semibold">Nama penuh</label><input class="form-control" name="name" value="<?= e($form['name']) ?>" required></div>
                    <div class="col-md-4"><label class="form-label fw-semibold">E-mel</label><input type="email" class="form-control" name="email" value="<?= e($form['email']) ?>" required></div>
                    <div class="col-md-4"><label class="form-label fw-semibold">Peranan</label>
                        <select name="role" class="form-select"><option value="guru">Guru</option><option value="admin" <?= $form['role'] === 'admin' ? 'selected' : '' ?>>Pentadbir</option></select></div>
                    <div class="col-md-4"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone" value="<?= e($form['phone']) ?>"></div>
                    <div class="col-md-4"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" value="<?= e($form['department']) ?>"></div>
                    <?php if (!$form['id']): ?>
                        <div class="col-md-4"><label class="form-label fw-semibold">Kata laluan awal</label><input class="form-control" name="password" placeholder="Kosongkan untuk jana automatik" minlength="8"></div>
                    <?php endif; ?>
                </div>
                <div class="mt-4 d-flex gap-2"><button class="btn btn-primary px-4">Simpan</button><a href="<?= url('admin/users') ?>" class="btn btn-light">Batal</a></div>
            </form>
        </div>
    </div>
<?php endif; ?>

<div class="card">
    <div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <ul class="nav nav-pills nav-pills-soft">
            <?php foreach (['' => 'Semua', 'active' => 'Aktif', 'pending' => 'Menunggu Pengesahan', 'inactive' => 'Tidak Aktif'] as $k => $label): ?>
                <li class="nav-item"><a class="nav-link<?= $status === $k ? ' active' : '' ?>" href="<?= url('admin/users', array_filter(['status' => $k])) ?>"><?= $label ?>
                    <span class="badge rounded-pill"><?= $k === '' ? array_sum($counts) : (int) ($counts[$k] ?? 0) ?></span></a></li>
            <?php endforeach; ?>
        </ul>
        <form method="get"><input type="hidden" name="p" value="admin/users"><?php if ($status): ?><input type="hidden" name="status" value="<?= e($status) ?>"><?php endif; ?>
            <div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="<?= e($q) ?>" placeholder="Cari nama / e-mel…"></div></form>
    </div>
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
            <thead><tr><th>Pengguna</th><th>Panitia / Unit</th><th>Peranan</th><th class="text-center">Tempahan</th><th>Log masuk terakhir</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead>
            <tbody>
            <?php foreach ($users as $u): ?>
                <tr>
                    <td><div class="d-flex align-items-center gap-2"><span class="avatar avatar-sm"><?= e(initials($u['name'])) ?></span>
                        <div><div class="fw-semibold"><?= e($u['name']) ?></div><div class="xsmall text-body-secondary"><?= e($u['email']) ?></div></div></div></td>
                    <td class="small"><?= e($u['department'] ?: '-') ?></td>
                    <td><?= $u['role'] === 'admin' ? '<span class="badge badge-soft-primary">Pentadbir</span>' : '<span class="badge badge-soft-secondary">Guru</span>' ?></td>
                    <td class="text-center"><a href="<?= url('admin/bookings', ['user_id' => $u['id']]) ?>"><?= (int) $u['bookings'] ?></a></td>
                    <td class="small"><?= fmt_datetime($u['last_login_at']) ?></td>
                    <td><?= ['active' => '<span class="badge badge-soft-success">Aktif</span>', 'pending' => '<span class="badge badge-soft-warning">Menunggu</span>', 'inactive' => '<span class="badge badge-soft-secondary">Tidak aktif</span>'][$u['status']] ?></td>
                    <td class="text-end text-nowrap">
                        <?php if ($u['status'] === 'pending'): ?>
                            <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="action" value="approve"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                <button class="btn btn-sm btn-success"><i class="bi bi-check-lg me-1"></i>Sahkan</button></form>
                        <?php endif; ?>
                        <div class="dropdown d-inline">
                            <button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end shadow">
                                <li><a class="dropdown-item" href="<?= url('admin/users', ['edit' => $u['id']]) ?>"><i class="bi bi-pencil me-2"></i>Kemas kini</a></li>
                                <li><form method="post" data-confirm="Tetapkan semula kata laluan <?= e($u['name']) ?>?"><?= csrf_field() ?><input type="hidden" name="action" value="reset"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                    <button class="dropdown-item"><i class="bi bi-key me-2"></i>Set semula kata laluan</button></form></li>
                                <?php if ((int) $u['id'] !== (int) $me['id']): ?>
                                    <?php if ($u['status'] === 'active'): ?>
                                        <li><form method="post" data-confirm="Nyahaktifkan akaun <?= e($u['name']) ?>?"><?= csrf_field() ?><input type="hidden" name="action" value="deactivate"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                            <button class="dropdown-item"><i class="bi bi-person-slash me-2"></i>Nyahaktifkan</button></form></li>
                                    <?php elseif ($u['status'] === 'inactive'): ?>
                                        <li><form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="activate"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                            <button class="dropdown-item"><i class="bi bi-person-check me-2"></i>Aktifkan</button></form></li>
                                    <?php endif; ?>
                                    <?php if (!$u['bookings']): ?>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><form method="post" data-confirm="Padam akaun <?= e($u['name']) ?> secara kekal?"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $u['id'] ?>">
                                            <button class="dropdown-item text-danger"><i class="bi bi-trash me-2"></i>Padam</button></form></li>
                                    <?php endif; ?>
                                <?php endif; ?>
                            </ul>
                        </div>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php if ($pg['pages'] > 1): ?><div class="card-footer"><?= pagination_links($pg) ?></div><?php endif; ?>
</div>
<?php render_footer();
