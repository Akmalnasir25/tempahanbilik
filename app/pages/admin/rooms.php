<?php
declare(strict_types=1);

$fields = ['code', 'name', 'category', 'location', 'capacity', 'facilities', 'description', 'pic_name', 'color', 'status'];

if (is_post()) {
    $action = input('action');
    $id = (int) input('id');

    if ($action === 'delete') {
        $room = find_room($id);
        $st = db()->prepare('SELECT COUNT(*) FROM bookings WHERE room_id = ?');
        $st->execute([$id]);
        if (!$room) {
            flash('danger', 'Bilik tidak dijumpai.');
        } elseif ((int) $st->fetchColumn() > 0) {
            flash('warning', 'Bilik ' . $room['name'] . ' mempunyai rekod tempahan dan tidak boleh dipadam. Tukar status kepada "Tidak Aktif" untuk menyembunyikannya.');
        } else {
            db()->prepare('DELETE FROM rooms WHERE id = ?')->execute([$id]);
            audit('room.delete', $room['name']);
            flash('success', 'Bilik ' . $room['name'] . ' telah dipadam.');
        }
        redirect('admin/rooms');
    }

    $d = [];
    foreach ($fields as $k) {
        $d[$k] = input($k);
    }
    $d['code'] = strtoupper($d['code']);
    $d['capacity'] = max(0, (int) $d['capacity']);
    $d['requires_approval'] = empty($_POST['requires_approval']) ? 0 : 1;
    if (!preg_match('/^#[0-9a-f]{6}$/i', $d['color'])) $d['color'] = '#1d4ed8';
    if (!isset(ROOM_STATUS_LABELS[$d['status']])) $d['status'] = 'active';

    $errors = [];
    if ($d['code'] === '' || !preg_match('/^[A-Z0-9\-]{1,10}$/', $d['code'])) $errors[] = 'Kod bilik diperlukan (huruf/nombor, maks. 10 aksara).';
    if ($d['name'] === '') $errors[] = 'Nama bilik diperlukan.';
    $st = db()->prepare('SELECT 1 FROM rooms WHERE code = ? AND id <> ?');
    $st->execute([$d['code'], $id]);
    if ($st->fetchColumn()) $errors[] = 'Kod bilik ' . $d['code'] . ' telah digunakan.';

    if ($errors) {
        flash('danger', implode(' ', $errors));
        $_SESSION['room_form'] = $d + ['id' => $id];
        redirect('admin/rooms', $id ? ['edit' => $id] : ['new' => 1]);
    }

    $cols = array_keys($d);
    if ($id) {
        $set = implode(', ', array_map(fn($c) => "$c = ?", $cols));
        db()->prepare("UPDATE rooms SET $set WHERE id = ?")->execute([...array_values($d), $id]);
        audit('room.update', $d['name']);
        flash('success', 'Maklumat bilik ' . $d['name'] . ' dikemas kini.');
    } else {
        db()->prepare('INSERT INTO rooms(' . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')')->execute(array_values($d));
        audit('room.create', $d['name']);
        flash('success', 'Bilik ' . $d['name'] . ' berjaya ditambah.');
    }
    redirect('admin/rooms');
}

$form = null;
if (isset($_SESSION['room_form'])) {
    $form = $_SESSION['room_form'];
    unset($_SESSION['room_form']);
} elseif ($editId = (int) query('edit')) {
    $form = find_room($editId);
} elseif (query('new')) {
    $form = ['id' => 0, 'code' => '', 'name' => '', 'category' => '', 'location' => '', 'capacity' => 30, 'facilities' => '', 'description' => '',
        'pic_name' => '', 'color' => '#1d4ed8', 'status' => 'active', 'requires_approval' => 0];
}

$rooms = db()->query("SELECT r.*,
    (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id AND b.status IN ('approved','pending') AND b.date >= date('now','localtime')) AS upcoming,
    (SELECT COUNT(*) FROM bookings b WHERE b.room_id = r.id) AS total
    FROM rooms r ORDER BY r.category, r.name")->fetchAll();
$categories = array_values(array_unique(array_filter(array_column($rooms, 'category'))));

render_header('Urus Bilik Khas', 'admin/rooms');
page_title('Urus Bilik Khas', 'Tambah, kemas kini dan tetapkan status bilik khas.', '<a href="' . url('admin/rooms', ['new' => 1]) . '" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tambah Bilik</a>');
?>
<?php if ($form): ?>
    <div class="card mb-4 border-primary-subtle">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h2 class="card-title"><?= $form['id'] ? 'Kemas Kini: ' . e($form['name']) : 'Tambah Bilik Khas Baharu' ?></h2>
            <a href="<?= url('admin/rooms') ?>" class="btn-close" aria-label="Tutup"></a>
        </div>
        <div class="card-body">
            <form method="post">
                <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $form['id'] ?>">
                <div class="row g-3">
                    <div class="col-md-2"><label class="form-label fw-semibold">Kod <span class="text-danger">*</span></label><input class="form-control text-uppercase" name="code" value="<?= e($form['code']) ?>" maxlength="10" required></div>
                    <div class="col-md-5"><label class="form-label fw-semibold">Nama bilik <span class="text-danger">*</span></label><input class="form-control" name="name" value="<?= e($form['name']) ?>" required></div>
                    <div class="col-md-3"><label class="form-label fw-semibold">Kategori</label><input class="form-control" name="category" value="<?= e($form['category']) ?>" list="catList" placeholder="cth. Makmal">
                        <datalist id="catList"><?php foreach ($categories as $c): ?><option value="<?= e($c) ?>"><?php endforeach; ?></datalist></div>
                    <div class="col-md-2"><label class="form-label fw-semibold">Warna</label><input type="color" class="form-control form-control-color w-100" name="color" value="<?= e($form['color']) ?>"></div>
                    <div class="col-md-4"><label class="form-label fw-semibold">Lokasi</label><input class="form-control" name="location" value="<?= e($form['location']) ?>" placeholder="cth. Blok A, Aras 2"></div>
                    <div class="col-md-2"><label class="form-label fw-semibold">Kapasiti</label><input type="number" class="form-control" name="capacity" value="<?= (int) $form['capacity'] ?>" min="0"></div>
                    <div class="col-md-3"><label class="form-label fw-semibold">Penyelaras / PIC</label><input class="form-control" name="pic_name" value="<?= e($form['pic_name']) ?>"></div>
                    <div class="col-md-3"><label class="form-label fw-semibold">Status</label>
                        <select name="status" class="form-select"><?php foreach (ROOM_STATUS_LABELS as $k => [$l]): ?><option value="<?= $k ?>" <?= $form['status'] === $k ? 'selected' : '' ?>><?= e($l) ?></option><?php endforeach; ?></select></div>
                    <div class="col-md-6"><label class="form-label fw-semibold">Kemudahan</label><input class="form-control" name="facilities" value="<?= e($form['facilities']) ?>" placeholder="Pisahkan dengan koma: Projektor, Pendingin hawa, …"></div>
                    <div class="col-md-6"><label class="form-label fw-semibold">Keterangan / Peraturan</label><input class="form-control" name="description" value="<?= e($form['description']) ?>"></div>
                    <div class="col-12">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" role="switch" name="requires_approval" id="ra" value="1" <?= $form['requires_approval'] ? 'checked' : '' ?>>
                            <label class="form-check-label" for="ra"><strong>Perlu kelulusan pentadbir</strong> <span class="text-body-secondary small">— tempahan guru akan berstatus "Menunggu" sehingga diluluskan</span></label>
                        </div>
                    </div>
                </div>
                <div class="mt-4 d-flex gap-2">
                    <button class="btn btn-primary px-4"><i class="bi bi-save me-1"></i>Simpan</button>
                    <a href="<?= url('admin/rooms') ?>" class="btn btn-light">Batal</a>
                </div>
            </form>
        </div>
    </div>
<?php endif; ?>

<div class="card">
    <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
            <thead><tr><th>Bilik</th><th>Kategori</th><th>Lokasi</th><th class="text-center">Kapasiti</th><th class="text-center">Kelulusan</th><th class="text-center">Akan datang</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead>
            <tbody>
            <?php foreach ($rooms as $r): ?>
                <tr>
                    <td><span class="room-dot" style="--c: <?= e($r['color']) ?>"></span><strong><?= e($r['name']) ?></strong><div class="xsmall text-body-secondary font-monospace"><?= e($r['code']) ?></div></td>
                    <td class="small"><?= e($r['category']) ?></td>
                    <td class="small"><?= e($r['location']) ?></td>
                    <td class="text-center"><?= (int) $r['capacity'] ?></td>
                    <td class="text-center"><?= $r['requires_approval'] ? '<i class="bi bi-shield-lock text-warning" title="Perlu kelulusan"></i>' : '<i class="bi bi-lightning-charge text-success" title="Automatik"></i>' ?></td>
                    <td class="text-center"><a href="<?= url('admin/bookings', ['room_id' => $r['id'], 'from' => date('Y-m-d')]) ?>"><?= (int) $r['upcoming'] ?></a></td>
                    <td><?= room_status_badge($r['status']) ?></td>
                    <td class="text-end text-nowrap">
                        <a href="<?= url('calendar', ['room_id' => $r['id']]) ?>" class="btn btn-sm btn-light" title="Jadual"><i class="bi bi-calendar3"></i></a>
                        <a href="<?= url('admin/rooms', ['edit' => $r['id']]) ?>" class="btn btn-sm btn-light" title="Kemas kini"><i class="bi bi-pencil"></i></a>
                        <?php if (!$r['total']): ?>
                            <form method="post" class="d-inline" data-confirm="Padam bilik <?= e($r['name']) ?>?">
                                <?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $r['id'] ?>">
                                <button class="btn btn-sm btn-light text-danger" title="Padam"><i class="bi bi-trash"></i></button>
                            </form>
                        <?php endif; ?>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
</div>
<?php render_footer();
