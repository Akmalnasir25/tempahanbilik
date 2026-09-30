<?php
declare(strict_types=1);

$text = ['system_name', 'school_name', 'school_code', 'school_address', 'email_domain'];
$times = ['open_time', 'close_time'];
$ints = ['max_advance_days' => [0, 365], 'max_duration_hours' => [0, 24], 'max_recurring_weeks' => [1, 52], 'cancel_cutoff_hours' => [0, 168]];
$bools = ['allow_weekend', 'allow_registration', 'public_display'];

if (is_post()) {
    $errors = [];
    foreach ($text as $k) {
        save_setting($k, mb_substr(input($k), 0, 150));
    }
    if (valid_time(input('open_time')) && valid_time(input('close_time')) && input('close_time') > input('open_time')) {
        save_setting('open_time', input('open_time'));
        save_setting('close_time', input('close_time'));
    } else {
        $errors[] = 'Waktu operasi tidak sah.';
    }
    foreach ($ints as $k => [$min, $max]) {
        save_setting($k, (string) max($min, min($max, (int) input($k))));
    }
    foreach ($bools as $k) {
        save_setting($k, empty($_POST[$k]) ? '0' : '1');
    }
    $mode = input('approval_mode');
    if (isset(APPROVAL_MODES[$mode])) {
        save_setting('approval_mode', $mode);
        settings(true);
    }

    // Optionally clear the queue of requests that no longer need review under the new mode.
    $approved = 0;
    if (!empty($_POST['approve_pending'])) {
        $admin = current_user();
        $ids = db()->query("SELECT b.id FROM bookings b WHERE b.status = 'pending' AND b.date >= date('now','localtime') ORDER BY b.date")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($ids as $id) {
            $b = find_booking((int) $id);
            if ($b && !room_needs_approval(find_room((int) $b['room_id']))
                && change_booking_status($b, 'approved', $admin, 'Diluluskan automatik (mod kelulusan ditukar)')['ok']) {
                $approved++;
            }
        }
    }
    audit('settings.update', 'Mod kelulusan: ' . setting('approval_mode'));
    $msg = 'Tetapan sistem disimpan.' . ($approved ? " {$approved} tempahan yang menunggu telah diluluskan." : '');
    flash($errors ? 'warning' : 'success', $errors ? implode(' ', $errors) : $msg);
    redirect('admin/settings');
}

$s = settings();
$currentMode = $s['approval_mode'] ?? 'auto';
$pendingCount = (int) db()->query("SELECT COUNT(*) FROM bookings WHERE status = 'pending' AND date >= date('now','localtime')")->fetchColumn();
render_header('Tetapan Sistem', 'admin/settings');
page_title('Tetapan Sistem', 'Konfigurasi maklumat sekolah dan peraturan tempahan.');
?>
<form method="post">
    <?= csrf_field() ?>
    <div class="card mb-4">
        <div class="card-header"><h2 class="card-title"><i class="bi bi-shield-check me-2"></i>Mod Kelulusan Tempahan</h2></div>
        <div class="card-body">
            <p class="text-body-secondary small mb-3">Tempahan yang bertindih <strong>sentiasa disekat</strong> dalam semua mod. Tetapan ini hanya menentukan sama ada tempahan guru yang tidak bertindih perlu menunggu kelulusan pentadbir. Tempahan oleh pentadbir sentiasa diluluskan terus.</p>
            <div class="row g-3">
                <?php foreach (APPROVAL_MODES as $key => [$label, $desc]): ?>
                    <div class="col-md-4">
                        <label class="mode-option h-100">
                            <input type="radio" name="approval_mode" value="<?= $key ?>" class="form-check-input" <?= $currentMode === $key ? 'checked' : '' ?>>
                            <span>
                                <strong><i class="bi bi-<?= ['auto' => 'lightning-charge', 'manual' => 'person-check', 'room' => 'door-open'][$key] ?> me-1"></i><?= e($label) ?></strong>
                                <small><?= e($desc) ?><?= $key === 'room' ? ' Tetapkan di <a href="' . url('admin/rooms') . '">Urus Bilik Khas</a>.' : '' ?></small>
                            </span>
                        </label>
                    </div>
                <?php endforeach; ?>
            </div>
            <?php if ($pendingCount): ?>
                <div class="form-check mt-3">
                    <input class="form-check-input" type="checkbox" name="approve_pending" value="1" id="approvePending">
                    <label class="form-check-label small" for="approvePending">Luluskan juga <strong><?= $pendingCount ?> tempahan</strong> yang sedang menunggu, jika mod baharu tidak lagi memerlukan kelulusan untuk tempahan tersebut</label>
                </div>
            <?php endif; ?>
        </div>
    </div>
    <div class="row g-4">
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-building me-2"></i>Maklumat Sekolah</h2></div>
                <div class="card-body">
                    <div class="mb-3"><label class="form-label fw-semibold">Nama sistem</label><input class="form-control" name="system_name" value="<?= e($s['system_name'] ?? '') ?>"></div>
                    <div class="mb-3"><label class="form-label fw-semibold">Nama sekolah</label><input class="form-control" name="school_name" value="<?= e($s['school_name'] ?? '') ?>"></div>
                    <div class="mb-3"><label class="form-label fw-semibold">Kod sekolah</label><input class="form-control" name="school_code" value="<?= e($s['school_code'] ?? '') ?>"></div>
                    <div class="mb-0"><label class="form-label fw-semibold">Alamat</label><input class="form-control" name="school_address" value="<?= e($s['school_address'] ?? '') ?>"></div>
                </div>
            </div>
        </div>
        <div class="col-lg-6">
            <div class="card h-100">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-sliders me-2"></i>Peraturan Tempahan</h2></div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-6"><label class="form-label fw-semibold">Waktu buka</label><input type="time" class="form-control" name="open_time" value="<?= e($s['open_time'] ?? '07:00') ?>"></div>
                        <div class="col-6"><label class="form-label fw-semibold">Waktu tutup</label><input type="time" class="form-control" name="close_time" value="<?= e($s['close_time'] ?? '18:00') ?>"></div>
                        <div class="col-6"><label class="form-label fw-semibold">Tempah awal maksimum</label>
                            <div class="input-group"><input type="number" class="form-control" name="max_advance_days" value="<?= e($s['max_advance_days'] ?? '60') ?>"><span class="input-group-text">hari</span></div></div>
                        <div class="col-6"><label class="form-label fw-semibold">Tempoh maksimum</label>
                            <div class="input-group"><input type="number" class="form-control" name="max_duration_hours" value="<?= e($s['max_duration_hours'] ?? '6') ?>"><span class="input-group-text">jam</span></div></div>
                        <div class="col-6"><label class="form-label fw-semibold">Ulangan maksimum</label>
                            <div class="input-group"><input type="number" class="form-control" name="max_recurring_weeks" value="<?= e($s['max_recurring_weeks'] ?? '16') ?>"><span class="input-group-text">minggu</span></div></div>
                        <div class="col-6"><label class="form-label fw-semibold">Had batal / pinda</label>
                            <div class="input-group"><input type="number" class="form-control" name="cancel_cutoff_hours" value="<?= e($s['cancel_cutoff_hours'] ?? '0') ?>"><span class="input-group-text">jam sebelum</span></div></div>
                    </div>
                    <div class="form-text">Had 0 = tiada had. Peraturan ini tidak dikenakan ke atas pentadbir.</div>
                </div>
            </div>
        </div>
        <div class="col-12">
            <div class="card">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-toggles me-2"></i>Pilihan</h2></div>
                <div class="card-body">
                    <div class="row g-4">
                        <div class="col-md-4">
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="allow_weekend" id="aw" value="1" <?= ($s['allow_weekend'] ?? '') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label fw-semibold" for="aw">Benarkan tempahan hujung minggu</label></div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="allow_registration" id="ar" value="1" <?= ($s['allow_registration'] ?? '') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label fw-semibold" for="ar">Benarkan guru mendaftar sendiri</label></div>
                            <div class="form-text">Akaun baharu perlu disahkan oleh pentadbir.</div>
                            <label class="form-label small fw-semibold mt-2">Hadkan domain e-mel (pilihan)</label>
                            <div class="input-group input-group-sm"><span class="input-group-text">@</span><input class="form-control" name="email_domain" value="<?= e($s['email_domain'] ?? '') ?>" placeholder="moe-dl.edu.my"></div>
                        </div>
                        <div class="col-md-4">
                            <div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="public_display" id="pd" value="1" <?= ($s['public_display'] ?? '') === '1' ? 'checked' : '' ?>>
                                <label class="form-check-label fw-semibold" for="pd">Paparan skrin awam</label></div>
                            <div class="form-text">Benarkan <a href="<?= url('display') ?>" target="_blank">paparan jadual hari ini</a> dibuka tanpa log masuk (untuk TV di bilik guru / lobi).</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="mt-4"><button class="btn btn-primary btn-lg px-5"><i class="bi bi-save me-1"></i>Simpan Tetapan</button></div>
</form>
<?php render_footer();
