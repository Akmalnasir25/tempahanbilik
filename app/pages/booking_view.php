<?php
declare(strict_types=1);

$user = current_user();
$booking = find_booking((int) query('id'));
if (!$booking) {
    flash('warning', 'Tempahan tidak dijumpai.');
    redirect('dashboard');
}
$isOwner = (int) $booking['user_id'] === (int) $user['id'];

// Download as calendar (.ics) file
if (query('ics') === '1') {
    $stamp = fn(string $d, string $t) => date('Ymd\THis', strtotime("$d $t"));
    $esc = fn(string $s) => addcslashes(str_replace(["\r\n", "\n"], '\n', $s), ',;');
    header('Content-Type: text/calendar; charset=utf-8');
    header('Content-Disposition: attachment; filename="tempahan-' . $booking['ref_no'] . '.ics"');
    echo "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Tempahan Bilik//MS\r\nBEGIN:VEVENT\r\n",
        'UID:', $booking['ref_no'], '@tempahanbilik', "\r\n",
        'DTSTAMP:', gmdate('Ymd\THis\Z'), "\r\n",
        'DTSTART;TZID=', date_default_timezone_get(), ':', $stamp($booking['date'], $booking['start_time']), "\r\n",
        'DTEND;TZID=', date_default_timezone_get(), ':', $stamp($booking['date'], $booking['end_time']), "\r\n",
        'SUMMARY:', $esc($booking['room_name'] . ' – ' . $booking['purpose']), "\r\n",
        'LOCATION:', $esc((string) $booking['room_location']), "\r\n",
        'DESCRIPTION:', $esc('No. rujukan: ' . $booking['ref_no']), "\r\n",
        "END:VEVENT\r\nEND:VCALENDAR\r\n";
    exit;
}

if (is_post()) {
    $action = input('action');
    $remark = mb_substr(input('remark'), 0, 300);
    $return = input('return');
    $targets = [$booking];

    if (input('scope') === 'series' && $booking['series_id']) {
        $st = db()->prepare("SELECT id FROM bookings WHERE series_id = ? AND date >= ? AND status IN ('pending','approved') ORDER BY date");
        $st->execute([$booking['series_id'], date('Y-m-d')]);
        $targets = array_map(fn($id) => find_booking((int) $id), $st->fetchAll(PDO::FETCH_COLUMN));
    }

    $done = 0;
    $lastError = '';
    foreach ($targets as $t) {
        if (in_array($action, ['approved', 'rejected'], true)) {
            if (!is_admin()) {
                $lastError = 'Hanya pentadbir boleh meluluskan atau menolak tempahan.';
                continue;
            }
        } elseif ($action === 'cancelled') {
            if (!can_modify_booking($t, $user)) {
                $lastError = 'Tempahan ini tidak boleh dibatalkan lagi.';
                continue;
            }
        } else {
            $lastError = 'Tindakan tidak sah.';
            continue;
        }
        $res = change_booking_status($t, $action, $user, $remark);
        if ($res['ok']) {
            $done++;
        } else {
            $lastError = $res['error'];
        }
    }

    if ($done) {
        $verb = ['approved' => 'diluluskan', 'rejected' => 'ditolak', 'cancelled' => 'dibatalkan'][$action];
        flash('success', $done > 1 ? "{$done} tempahan telah {$verb}." : "Tempahan {$booking['ref_no']} telah {$verb}.");
    }
    if ($lastError) {
        flash('danger', $lastError);
    }
    if (in_array($return, ['dashboard', 'my-bookings', 'admin/bookings'], true)) {
        redirect_back($return);
    }
    redirect('booking', ['id' => $booking['id']]);
}

$canModify = can_modify_booking($booking, $user);
$series = [];
if ($booking['series_id']) {
    $st = db()->prepare('SELECT id, date, status FROM bookings WHERE series_id = ? ORDER BY date');
    $st->execute([$booking['series_id']]);
    $series = $st->fetchAll();
}
$activeSeries = count(array_filter($series, fn($s) => in_array($s['status'], ['pending', 'approved'], true) && $s['date'] >= date('Y-m-d')));

render_header('Tempahan ' . $booking['ref_no'], $isOwner ? 'my-bookings' : (is_admin() ? 'admin/bookings' : 'calendar'));
?>
<div class="page-head no-print">
    <div>
        <a href="javascript:history.back()" class="small text-decoration-none"><i class="bi bi-arrow-left me-1"></i>Kembali</a>
        <h1 class="page-title mt-1">Butiran Tempahan</h1>
    </div>
    <div class="page-actions">
        <a href="<?= url('booking', ['id' => $booking['id'], 'ics' => 1]) ?>" class="btn btn-light"><i class="bi bi-calendar-plus me-1"></i>Tambah ke kalendar</a>
        <button onclick="window.print()" class="btn btn-light"><i class="bi bi-printer me-1"></i>Cetak slip</button>
    </div>
</div>

<?php if (query('new') === '1'): ?>
    <div class="success-banner mb-4 no-print">
        <div class="success-icon"><i class="bi bi-check-lg"></i></div>
        <div>
            <h2 class="h5 fw-bold mb-1"><?= $booking['status'] === 'pending' ? 'Permohonan tempahan dihantar!' : 'Tempahan berjaya disahkan!' ?></h2>
            <p class="mb-0 text-body-secondary">No. rujukan anda ialah <strong><?= e($booking['ref_no']) ?></strong>.
                <?= $booking['status'] === 'pending' ? 'Anda akan dimaklumkan melalui notifikasi selepas pentadbir membuat keputusan.' : 'Bilik telah dikhaskan untuk anda.' ?></p>
        </div>
    </div>
<?php endif; ?>

<div class="row g-4">
    <div class="col-lg-8">
        <div class="card booking-slip">
            <div class="slip-head" style="--c: <?= e($booking['room_color']) ?>">
                <div class="d-flex align-items-center gap-3">
                    <?= brand_logo('lg') ?>
                    <div>
                        <div class="small opacity-75">No. Rujukan</div>
                        <div class="fs-4 fw-bold font-monospace"><?= e($booking['ref_no']) ?></div>
                    </div>
                </div>
                <div class="text-end">
                    <?= status_badge($booking['status']) ?>
                    <div class="small opacity-75 mt-1 print-only"><?= e(setting('school_name')) ?></div>
                </div>
            </div>
            <div class="card-body p-4">
                <div class="row g-4 mb-2">
                    <div class="col-sm-6">
                        <div class="detail-label">Bilik</div>
                        <div class="detail-value"><span class="room-dot" style="--c: <?= e($booking['room_color']) ?>"></span><?= e($booking['room_name']) ?> <span class="text-body-secondary">(<?= e($booking['room_code']) ?>)</span></div>
                        <div class="small text-body-secondary"><i class="bi bi-geo-alt me-1"></i><?= e($booking['room_location']) ?></div>
                    </div>
                    <div class="col-sm-6">
                        <div class="detail-label">Tarikh &amp; Masa</div>
                        <div class="detail-value"><?= fmt_date($booking['date'], true) ?></div>
                        <div class="small text-body-secondary"><i class="bi bi-clock me-1"></i><?= e($booking['start_time']) ?> – <?= e($booking['end_time']) ?> (<?= duration_label($booking['start_time'], $booking['end_time']) ?>)</div>
                    </div>
                    <div class="col-sm-6">
                        <div class="detail-label">Tujuan / Aktiviti</div>
                        <div class="detail-value"><?= e($booking['purpose']) ?></div>
                    </div>
                    <div class="col-sm-3 col-6">
                        <div class="detail-label">Kelas</div>
                        <div class="detail-value"><?= e($booking['class_name'] ?: '-') ?></div>
                    </div>
                    <div class="col-sm-3 col-6">
                        <div class="detail-label">Subjek</div>
                        <div class="detail-value"><?= e($booking['subject'] ?: '-') ?></div>
                    </div>
                    <div class="col-sm-6">
                        <div class="detail-label">Ditempah oleh</div>
                        <div class="detail-value"><?= e($booking['user_name']) ?></div>
                        <div class="small text-body-secondary"><?= e($booking['user_department'] ?: '') ?><?= $booking['user_phone'] ? ' · ' . e($booking['user_phone']) : '' ?></div>
                    </div>
                    <div class="col-sm-3 col-6">
                        <div class="detail-label">Bil. peserta</div>
                        <div class="detail-value"><?= $booking['attendees'] ? (int) $booking['attendees'] . ' orang' : '-' ?></div>
                    </div>
                    <div class="col-sm-3 col-6">
                        <div class="detail-label">Dibuat pada</div>
                        <div class="detail-value small"><?= fmt_datetime($booking['created_at']) ?></div>
                    </div>
                    <?php if ($booking['notes']): ?>
                        <div class="col-12">
                            <div class="detail-label">Catatan</div>
                            <div class="detail-value fw-normal" style="white-space: pre-line"><?= e($booking['notes']) ?></div>
                        </div>
                    <?php endif; ?>
                    <?php if ($booking['admin_remark'] || $booking['reviewer_name']): ?>
                        <div class="col-12">
                            <div class="remark-box">
                                <div class="detail-label mb-1"><i class="bi bi-chat-square-text me-1"></i>Maklum balas pentadbir</div>
                                <?php if ($booking['admin_remark']): ?><div><?= e($booking['admin_remark']) ?></div><?php endif; ?>
                                <?php if ($booking['reviewer_name']): ?><div class="xsmall text-body-secondary mt-1">— <?= e($booking['reviewer_name']) ?>, <?= fmt_datetime($booking['reviewed_at']) ?></div><?php endif; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </div>
            </div>
        </div>

        <?php if ($series): ?>
            <div class="card mt-4 no-print">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-arrow-repeat me-2"></i>Siri Tempahan Berulang (<?= count($series) ?> minggu)</h2></div>
                <div class="card-body d-flex flex-wrap gap-2">
                    <?php foreach ($series as $s): [$lbl, $clr] = STATUS_LABELS[$s['status']]; ?>
                        <a href="<?= url('booking', ['id' => $s['id']]) ?>" class="series-chip border-<?= $clr ?>-subtle<?= (int) $s['id'] === (int) $booking['id'] ? ' current' : '' ?>" title="<?= e($lbl) ?>">
                            <span class="dot bg-<?= $clr ?>"></span><?= fmt_date($s['date'], false, true) ?>
                        </a>
                    <?php endforeach; ?>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <div class="col-lg-4 no-print">
        <?php if (is_admin() && in_array($booking['status'], ['pending', 'approved', 'rejected'], true)): ?>
            <div class="card mb-4">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-shield-check me-2"></i>Tindakan Pentadbir</h2></div>
                <div class="card-body">
                    <form method="post">
                        <?= csrf_field() ?>
                        <label class="form-label small fw-semibold">Catatan kepada pemohon (pilihan)</label>
                        <textarea name="remark" class="form-control mb-3" rows="2" placeholder="cth. Sila pastikan bilik dikemas selepas digunakan"></textarea>
                        <?php if ($activeSeries > 1): ?>
                            <select name="scope" class="form-select form-select-sm mb-3">
                                <option value="one">Tempahan ini sahaja</option>
                                <option value="series">Semua tempahan aktif dalam siri (<?= $activeSeries ?>)</option>
                            </select>
                        <?php endif; ?>
                        <div class="d-grid gap-2">
                            <?php if ($booking['status'] !== 'approved'): ?>
                                <button name="action" value="approved" class="btn btn-success"><i class="bi bi-check-lg me-1"></i>Luluskan</button>
                            <?php endif; ?>
                            <?php if ($booking['status'] !== 'rejected'): ?>
                                <button name="action" value="rejected" class="btn btn-outline-danger"><i class="bi bi-x-lg me-1"></i>Tolak</button>
                            <?php endif; ?>
                        </div>
                    </form>
                </div>
            </div>
        <?php endif; ?>

        <?php if ($canModify): ?>
            <div class="card mb-4">
                <div class="card-header"><h2 class="card-title"><i class="bi bi-gear me-2"></i>Urus Tempahan</h2></div>
                <div class="card-body d-grid gap-2">
                    <a href="<?= url('book', ['id' => $booking['id']]) ?>" class="btn btn-light"><i class="bi bi-pencil me-1"></i>Pinda tempahan</a>
                    <form method="post" data-confirm="Batalkan tempahan ini? Slot akan dibuka semula kepada guru lain.">
                        <?= csrf_field() ?><input type="hidden" name="action" value="cancelled">
                        <button class="btn btn-outline-danger w-100"><i class="bi bi-x-circle me-1"></i>Batalkan tempahan ini</button>
                    </form>
                    <?php if ($activeSeries > 1): ?>
                        <form method="post" data-confirm="Batalkan SEMUA <?= $activeSeries ?> tempahan akan datang dalam siri ini?">
                            <?= csrf_field() ?><input type="hidden" name="action" value="cancelled"><input type="hidden" name="scope" value="series">
                            <button class="btn btn-outline-danger w-100"><i class="bi bi-calendar-x me-1"></i>Batalkan seluruh siri (<?= $activeSeries ?>)</button>
                        </form>
                    <?php endif; ?>
                </div>
            </div>
        <?php endif; ?>

        <div class="card">
            <div class="card-header"><h2 class="card-title"><i class="bi bi-clock-history me-2"></i>Sejarah</h2></div>
            <div class="card-body">
                <ul class="mini-timeline">
                    <li><strong>Dibuat</strong><span><?= fmt_datetime($booking['created_at']) ?></span></li>
                    <?php if ($booking['updated_at'] !== $booking['created_at']): ?><li><strong>Kemas kini terakhir</strong><span><?= fmt_datetime($booking['updated_at']) ?></span></li><?php endif; ?>
                    <?php if ($booking['reviewed_at']): ?><li><strong>Disemak oleh <?= e($booking['reviewer_name']) ?></strong><span><?= fmt_datetime($booking['reviewed_at']) ?></span></li><?php endif; ?>
                    <li><strong>Status semasa</strong><span><?= status_badge($booking['status']) ?></span></li>
                </ul>
            </div>
        </div>
    </div>
</div>
<?php render_footer();
