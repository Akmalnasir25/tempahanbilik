<?php
declare(strict_types=1);

// Landing page: asks for the KPM school code. The list of schools is never shown,
// and the teacher list only appears after a valid code.
$requested = is_string($_GET['s'] ?? null) ? strtoupper(trim($_GET['s'])) : '';
$notFound = $requested !== '';

render_guest_header('Pilih Sekolah');
?>
<div class="auth-wrap">
    <section class="auth-hero">
        <div class="auth-hero-inner">
            <div class="d-flex align-items-center gap-3 mb-5">
                <span class="brand-logo lg"><i class="bi bi-buildings"></i></span>
                <div class="fw-bold fs-5"><?= e(PLATFORM_NAME) ?></div>
            </div>
            <h1 class="display-6 fw-bold mb-3">Tempah bilik khas sekolah dengan mudah, pantas &amp; tanpa pertembungan.</h1>
            <p class="lead opacity-75 mb-5">Setiap sekolah mempunyai ruang tersendiri: guru, bilik khas dan tempahan sekolah anda sahaja.</p>
            <div class="row g-3 auth-features">
                <div class="col-sm-6"><div class="feat"><i class="bi bi-shield-lock"></i><div><strong>Data berasingan</strong><span>Setiap sekolah mempunyai pangkalan data sendiri</span></div></div></div>
                <div class="col-sm-6"><div class="feat"><i class="bi bi-lightning-charge"></i><div><strong>Semakan masa nyata</strong><span>Tempahan bertindih disekat secara automatik</span></div></div></div>
            </div>
        </div>
    </section>
    <section class="auth-panel">
        <div class="auth-card">
            <div class="d-lg-none text-center mb-4">
                <span class="brand-logo lg mx-auto mb-2"><i class="bi bi-buildings"></i></span>
                <div class="fw-bold"><?= e(PLATFORM_NAME) ?></div>
            </div>
            <h2 class="h3 fw-bold mb-1">Selamat datang 👋</h2>
            <p class="text-body-secondary mb-4">Masukkan kod sekolah anda untuk log masuk.</p>
            <?php if ($notFound): ?>
                <div class="alert alert-danger py-2 small"><i class="bi bi-exclamation-circle me-1"></i>Kod sekolah <strong><?= e($requested) ?></strong> tidak dijumpai. Sila semak dengan pentadbir sekolah anda.</div>
            <?php endif; ?>
            <form method="get" action="index.php" autocomplete="off">
                <label class="form-label fw-semibold" for="s">Kod sekolah</label>
                <div class="input-icon mb-3"><i class="bi bi-building"></i>
                    <input class="form-control form-control-lg text-uppercase" id="s" name="s" required pattern="\s*[A-Za-z0-9\-]{3,30}\s*" placeholder="cth. PEA1234" autocapitalize="characters" spellcheck="false" autofocus>
                </div>
                <input type="hidden" name="p" value="login">
                <button class="btn btn-primary btn-lg w-100 fw-semibold">Teruskan <i class="bi bi-arrow-right ms-1"></i></button>
            </form>
            <p class="text-center xsmall text-body-tertiary mt-4 mb-0">Gunakan kod sekolah KPM anda. Sekolah anda akan diingati pada peranti ini.</p>
        </div>
    </section>
</div>
<?php render_guest_footer();
