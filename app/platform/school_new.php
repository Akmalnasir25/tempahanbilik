<?php
declare(strict_types=1);

$legacy = is_file(DATA_DIR . '/tempahan.sqlite');
$errors = [];
$d = ['slug' => '', 'name' => '', 'school_code' => '', 'admin_name' => '', 'admin_email' => '', 'contact_name' => '', 'contact_email' => '', 'contact_phone' => '', 'notes' => ''];

if (is_post()) {
    foreach ($d as $k => $_) {
        $d[$k] = input($k);
    }
    $d['slug'] = strtolower($d['slug']);
    $d['adopt_legacy'] = $legacy && !empty($_POST['adopt_legacy']);
    $password = input('admin_password') ?: random_password();

    if (!valid_slug($d['slug'])) $errors[] = 'Kod pautan mestilah 3–30 aksara: huruf kecil, nombor dan sengkang (cth. smkabc), dan bukan perkataan simpanan sistem.';
    elseif (find_school($d['slug']) || is_file(school_db_path($d['slug']))) $errors[] = 'Kod pautan "' . $d['slug'] . '" sudah digunakan.';
    else {
        $st = platform_db()->prepare('SELECT 1 FROM schools WHERE slug = ?');
        $st->execute([$d['slug']]);
        if ($st->fetchColumn()) $errors[] = 'Kod pautan "' . $d['slug'] . '" sudah digunakan.';
    }
    if (mb_strlen($d['name']) < 3) $errors[] = 'Sila masukkan nama sekolah.';
    if (!$d['adopt_legacy']) {
        if (mb_strlen($d['admin_name']) < 3) $errors[] = 'Sila masukkan nama admin sekolah.';
        if (!filter_var($d['admin_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'E-mel admin sekolah tidak sah.';
        if (strlen($password) < 8) $errors[] = 'Kata laluan admin mestilah sekurang-kurangnya 8 aksara (atau kosongkan untuk jana automatik).';
    }
    if ($d['contact_email'] !== '' && !filter_var($d['contact_email'], FILTER_VALIDATE_EMAIL)) $errors[] = 'E-mel untuk dihubungi tidak sah.';

    if (!$errors) {
        $school = create_school($d + ['admin_password' => $password]);
        platform_audit('school.create', $school['slug'] . ' – ' . $school['name'] . ($d['adopt_legacy'] ? ' (data sedia ada diimport)' : ''));
        $_SESSION['new_school_credentials'] = [
            'name' => $school['name'], 'slug' => $school['slug'], 'url' => school_url($school['slug']),
            'email' => $d['adopt_legacy'] ? '' : strtolower($d['admin_email']), 'password' => $d['adopt_legacy'] ? '' : $password,
        ];
        header('Location: index.php?p=platform');
        exit;
    }
}

platform_header('Tambah Sekolah', 'schools');
?>
<a href="index.php?p=platform" class="small"><i class="bi bi-arrow-left me-1"></i>Kembali</a>
<h1 class="page-title mt-1 mb-4">Tambah Sekolah</h1>
<?php if ($errors): ?><div class="alert alert-danger"><ul class="mb-0 ps-3"><?php foreach ($errors as $err): ?><li><?= e($err) ?></li><?php endforeach; ?></ul></div><?php endif; ?>
<form method="post" class="row g-4" autocomplete="off">
    <?= csrf_field() ?>
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title"><i class="bi bi-building me-2"></i>Maklumat Sekolah</h2></div>
            <div class="card-body">
                <div class="mb-3"><label class="form-label fw-semibold">Nama sekolah <span class="text-danger">*</span></label><input class="form-control" name="name" value="<?= e($d['name']) ?>" required placeholder="cth. SMK Taman Contoh"></div>
                <div class="mb-3">
                    <label class="form-label fw-semibold">Kod pautan <span class="text-danger">*</span></label>
                    <div class="input-group"><span class="input-group-text small"><?= e(preg_replace('#/[^/]*$#', '/', school_url('x'))) ?></span><input class="form-control text-lowercase" name="slug" id="slug" value="<?= e($d['slug']) ?>" required pattern="[a-z0-9][a-z0-9\-]{1,28}[a-z0-9]" placeholder="smkabc"></div>
                    <div class="form-text">Guru akan buka sistem melalui pautan ini. Guna huruf kecil, nombor dan sengkang sahaja. <strong>Tidak boleh ditukar kemudian.</strong></div>
                </div>
                <div class="mb-3"><label class="form-label fw-semibold">Kod sekolah KPM</label><input class="form-control" name="school_code" value="<?= e($d['school_code']) ?>" placeholder="cth. ABC1234"></div>
                <div class="row g-3">
                    <div class="col-md-6"><label class="form-label fw-semibold">Pegawai untuk dihubungi</label><input class="form-control" name="contact_name" value="<?= e($d['contact_name']) ?>"></div>
                    <div class="col-md-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="contact_phone" value="<?= e($d['contact_phone']) ?>"></div>
                    <div class="col-12"><label class="form-label fw-semibold">E-mel untuk dihubungi</label><input type="email" class="form-control" name="contact_email" value="<?= e($d['contact_email']) ?>"></div>
                    <div class="col-12"><label class="form-label fw-semibold">Catatan dalaman</label><textarea class="form-control" name="notes" rows="2" placeholder="cth. Langganan tamat Disember 2027"><?= e($d['notes']) ?></textarea></div>
                </div>
            </div>
        </div>
    </div>
    <div class="col-lg-6">
        <div class="card h-100">
            <div class="card-header"><h2 class="card-title"><i class="bi bi-person-badge me-2"></i>Admin Sekolah</h2></div>
            <div class="card-body">
                <p class="small text-body-secondary">Admin sekolah akan mendaftar guru, mengurus bilik khas dan tetapan sekolah tersebut.</p>
                <div id="adminFields">
                    <div class="mb-3"><label class="form-label fw-semibold">Nama admin <span class="text-danger">*</span></label><input class="form-control" name="admin_name" value="<?= e($d['admin_name']) ?>"></div>
                    <div class="mb-3"><label class="form-label fw-semibold">E-mel admin <span class="text-danger">*</span></label><input type="email" class="form-control" name="admin_email" value="<?= e($d['admin_email']) ?>"></div>
                    <div class="mb-3"><label class="form-label fw-semibold">Kata laluan sementara</label><input class="form-control font-monospace" name="admin_password" placeholder="Kosongkan untuk jana automatik" minlength="8"></div>
                </div>
                <?php if ($legacy): ?>
                    <div class="form-check p-3 border rounded bg-body-tertiary">
                        <input class="form-check-input ms-0 me-2" type="checkbox" name="adopt_legacy" value="1" id="adopt" <?= !empty($_POST['adopt_legacy']) ? 'checked' : '' ?>>
                        <label class="form-check-label" for="adopt"><strong>Import data sedia ada</strong><br>
                            <span class="small text-body-secondary">Fail <code>data/tempahan.sqlite</code> daripada versi satu-sekolah dijumpai. Tanda untuk jadikan data itu (guru, bilik, tempahan) milik sekolah ini. Akaun admin sedia ada akan terus digunakan.</span></label>
                    </div>
                <?php endif; ?>
            </div>
        </div>
    </div>
    <div class="col-12"><button class="btn btn-primary btn-lg px-5"><i class="bi bi-check2-circle me-1"></i>Cipta Sekolah</button></div>
</form>
<script>
(function () {
    var adopt = document.getElementById('adopt'), fields = document.getElementById('adminFields');
    function sync() { if (adopt) fields.style.display = adopt.checked ? 'none' : ''; }
    if (adopt) { adopt.addEventListener('change', sync); sync(); }
    var slug = document.getElementById('slug');
    slug.addEventListener('input', function () { slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); });
})();
</script>
<?php platform_footer();
