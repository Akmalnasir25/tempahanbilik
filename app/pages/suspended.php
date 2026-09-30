<?php
declare(strict_types=1);

render_guest_header('Akaun Digantung');
?>
<div class="d-flex align-items-center justify-content-center min-vh-100 p-4">
    <div class="text-center" style="max-width: 460px">
        <div class="confirm-icon mb-3"><i class="bi bi-pause-circle"></i></div>
        <h1 class="h4 fw-bold"><?= e($school['name']) ?></h1>
        <p class="text-body-secondary">Akaun sekolah ini sedang digantung buat sementara waktu. Sila hubungi pentadbir sekolah anda atau pemilik platform untuk maklumat lanjut.</p>
        <a href="index.php?p=switch" class="btn btn-light">Pilih sekolah lain</a>
    </div>
</div>
<?php render_guest_footer();
