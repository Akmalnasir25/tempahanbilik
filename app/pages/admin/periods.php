<?php
declare(strict_types=1);

if (is_post()) {
    $action = input('action');
    if ($action === 'delete') {
        db()->prepare('DELETE FROM periods WHERE id = ?')->execute([(int) input('id')]);
        audit('period.delete', '#' . input('id'));
        flash('success', 'Waktu dipadam.');
    } elseif ($action === 'save_all') {
        $ids = (array) ($_POST['id'] ?? []);
        $errors = 0;
        $pdo = db();
        $pdo->exec('BEGIN');
        foreach ($ids as $i => $id) {
            $label = trim((string) ($_POST['label'][$i] ?? ''));
            $s = (string) ($_POST['start_time'][$i] ?? '');
            $e = (string) ($_POST['end_time'][$i] ?? '');
            $brk = in_array((string) $id, (array) ($_POST['is_break'] ?? []), true) ? 1 : 0;
            if ($label === '' && $s === '' && $e === '') continue;
            if ($label === '' || !valid_time($s) || !valid_time($e) || $e <= $s) { $errors++; continue; }
            if ($id === 'new') {
                $pdo->prepare('INSERT INTO periods(label, start_time, end_time, is_break) VALUES (?,?,?,?)')->execute([$label, $s, $e, $brk]);
            } else {
                $pdo->prepare('UPDATE periods SET label=?, start_time=?, end_time=?, is_break=? WHERE id=?')->execute([$label, $s, $e, $brk, (int) $id]);
            }
        }
        $pdo->exec('COMMIT');
        audit('period.update');
        flash($errors ? 'warning' : 'success', $errors ? "Disimpan, tetapi {$errors} baris tidak sah diabaikan." : 'Waktu persekolahan dikemas kini.');
    }
    redirect('admin/periods');
}

$periods = all_periods();
render_header('Waktu Persekolahan', 'admin/periods');
page_title('Waktu Persekolahan', 'Waktu ini dipaparkan sebagai pilihan pantas semasa menempah dan sebagai lajur dalam paparan kekosongan.');
?>
<div class="card" style="max-width: 820px">
    <form method="post">
        <?= csrf_field() ?><input type="hidden" name="action" value="save_all">
        <div class="table-responsive">
            <table class="table align-middle mb-0">
                <thead><tr><th>Label</th><th>Mula</th><th>Tamat</th><th class="text-center">Rehat</th><th></th></tr></thead>
                <tbody>
                <?php foreach ($periods as $p): ?>
                    <tr>
                        <td><input type="hidden" name="id[]" value="<?= $p['id'] ?>"><input name="label[]" class="form-control form-control-sm" value="<?= e($p['label']) ?>"></td>
                        <td><input type="time" name="start_time[]" class="form-control form-control-sm" value="<?= e($p['start_time']) ?>"></td>
                        <td><input type="time" name="end_time[]" class="form-control form-control-sm" value="<?= e($p['end_time']) ?>"></td>
                        <td class="text-center"><input type="checkbox" class="form-check-input" name="is_break[]" value="<?= $p['id'] ?>" <?= $p['is_break'] ? 'checked' : '' ?>></td>
                        <td class="text-end"><button type="submit" form="del<?= $p['id'] ?>" class="btn btn-sm btn-light text-danger"><i class="bi bi-trash"></i></button></td>
                    </tr>
                <?php endforeach; ?>
                <tr class="table-light">
                    <td><input type="hidden" name="id[]" value="new"><input name="label[]" class="form-control form-control-sm" placeholder="+ Tambah waktu baharu"></td>
                    <td><input type="time" name="start_time[]" class="form-control form-control-sm"></td>
                    <td><input type="time" name="end_time[]" class="form-control form-control-sm"></td>
                    <td class="text-center"><input type="checkbox" class="form-check-input" name="is_break[]" value="new"></td>
                    <td></td>
                </tr>
                </tbody>
            </table>
        </div>
        <div class="card-footer"><button class="btn btn-primary"><i class="bi bi-save me-1"></i>Simpan Semua</button></div>
    </form>
    <?php foreach ($periods as $p): ?>
        <form method="post" id="del<?= $p['id'] ?>" data-confirm="Padam <?= e($p['label']) ?>?"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= $p['id'] ?>"></form>
    <?php endforeach; ?>
</div>
<?php render_footer();
