<?php
declare(strict_types=1);

$error = '';
$email = '';

if (is_post()) {
    $email = input('email');
    $password = (string) ($_POST['password'] ?? '');

    $attempts = $_SESSION['login_attempts'] ?? ['n' => 0, 't' => time()];
    if (time() - $attempts['t'] > 900) {
        $attempts = ['n' => 0, 't' => time()];
    }

    if ($attempts['n'] >= 5) {
        $error = 'Terlalu banyak cubaan log masuk. Sila cuba semula dalam 15 minit.';
    } else {
        $st = db()->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $user = $st->fetch();

        if (!$user || !password_verify($password, $user['password_hash'])) {
            $attempts['n']++;
            $_SESSION['login_attempts'] = $attempts;
            usleep(300000);
            $error = 'E-mel atau kata laluan tidak sah.';
        } elseif ($user['status'] === 'pending') {
            $error = 'Akaun anda sedang menunggu pengesahan pentadbir.';
        } elseif ($user['status'] !== 'active') {
            $error = 'Akaun anda telah dinyahaktifkan. Sila hubungi pentadbir.';
        } else {
            unset($_SESSION['login_attempts']);
            if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
                db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
            }
            login_user($user);
            audit('auth.login', $user['email']);
            $intended = $_SESSION['intended'] ?? '';
            unset($_SESSION['intended']);
            // Only same-origin relative paths ("/…" but never "//host" or "/\host")
            if ($intended !== '' && preg_match('#^/(?![/\\\\])#', $intended)) {
                header('Location: ' . $intended);
                exit;
            }
            redirect('dashboard');
        }
    }
}

render_guest_header('Log Masuk');
$roomCount = (int) db()->query("SELECT COUNT(*) FROM rooms WHERE status = 'active'")->fetchColumn();
?>
<div class="auth-wrap">
    <section class="auth-hero">
        <div class="auth-hero-inner">
            <div class="d-flex align-items-center gap-3 mb-5">
                <?= brand_logo('lg') ?>
                <div>
                    <div class="fw-bold fs-5"><?= e(setting('system_name')) ?></div>
                    <div class="opacity-75 small"><?= e(setting('school_name')) ?></div>
                </div>
            </div>
            <h1 class="display-6 fw-bold mb-3">Tempah bilik khas sekolah dengan mudah, pantas &amp; tanpa pertembungan.</h1>
            <p class="lead opacity-75 mb-5">Semak kekosongan secara langsung, tempah dalam beberapa klik dan pantau jadual mingguan atau bulanan di satu tempat.</p>
            <div class="row g-3 auth-features">
                <div class="col-sm-6"><div class="feat"><i class="bi bi-lightning-charge"></i><div><strong>Semakan masa nyata</strong><span>Sistem menghalang tempahan bertindih secara automatik</span></div></div></div>
                <div class="col-sm-6"><div class="feat"><i class="bi bi-calendar-week"></i><div><strong>Jadual interaktif</strong><span>Paparan harian, mingguan &amp; bulanan</span></div></div></div>
                <div class="col-sm-6"><div class="feat"><i class="bi bi-arrow-repeat"></i><div><strong>Tempahan berulang</strong><span>Tempah slot yang sama setiap minggu</span></div></div></div>
                <div class="col-sm-6"><div class="feat"><i class="bi bi-door-open"></i><div><strong><?= $roomCount ?> bilik khas</strong><span>Makmal, bilik tayang, pusat sumber &amp; lain-lain</span></div></div></div>
            </div>
        </div>
    </section>
    <section class="auth-panel">
        <div class="auth-card">
            <div class="d-lg-none text-center mb-4">
                <?= brand_logo('lg mx-auto mb-2') ?>
                <div class="fw-bold"><?= e(setting('system_name')) ?></div>
            </div>
            <h2 class="h3 fw-bold mb-1">Selamat kembali 👋</h2>
            <p class="text-body-secondary mb-4">Log masuk menggunakan akaun guru anda.</p>

            <?php foreach (take_flashes() as [$type, $msg]): ?>
                <div class="alert alert-<?= e($type) ?> py-2"><?= e($msg) ?></div>
            <?php endforeach; ?>
            <?php if ($error): ?>
                <div class="alert alert-danger py-2 d-flex gap-2"><i class="bi bi-exclamation-circle mt-1"></i><?= e($error) ?></div>
            <?php endif; ?>

            <form method="post" novalidate>
                <?= csrf_field() ?>
                <div class="mb-3">
                    <label class="form-label fw-semibold" for="email">E-mel</label>
                    <div class="input-icon"><i class="bi bi-envelope"></i>
                        <input type="email" class="form-control form-control-lg" id="email" name="email" value="<?= e($email) ?>" placeholder="nama@sekolah.edu.my" required autofocus autocomplete="username">
                    </div>
                </div>
                <div class="mb-4">
                    <label class="form-label fw-semibold" for="password">Kata laluan</label>
                    <div class="input-icon"><i class="bi bi-lock"></i>
                        <input type="password" class="form-control form-control-lg" id="password" name="password" placeholder="••••••••" required autocomplete="current-password">
                        <button type="button" class="btn-reveal" data-reveal="#password" aria-label="Papar kata laluan"><i class="bi bi-eye"></i></button>
                    </div>
                </div>
                <button class="btn btn-primary btn-lg w-100 fw-semibold">Log Masuk <i class="bi bi-arrow-right ms-1"></i></button>
            </form>

            <?php if (setting('allow_registration') === '1'): ?>
                <p class="text-center text-body-secondary mt-4 mb-0">Belum mempunyai akaun? <a href="<?= url('register') ?>" class="fw-semibold">Daftar sekarang</a></p>
            <?php endif; ?>
            <p class="text-center xsmall text-body-tertiary mt-4 mb-0">Lupa kata laluan? Hubungi pentadbir sistem untuk menetapkan semula.</p>
            <p class="text-center xsmall mt-2 mb-0"><a href="index.php?p=switch" class="text-body-secondary"><i class="bi bi-arrow-left-right me-1"></i>Bukan <?= e(setting('school_name')) ?>? Tukar sekolah</a></p>
        </div>
    </section>
</div>
<?php render_guest_footer();
