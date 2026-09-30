<?php
declare(strict_types=1);

$user = current_user();
$editing = null;
if ($id = (int) query('id')) {
    $editing = find_booking($id);
    if (!$editing || !can_modify_booking($editing, $user)) {
        flash('danger', 'Tempahan ini tidak boleh dipinda.');
        redirect('my-bookings');
    }
}

$data = [
    'room_id'      => $editing['room_id'] ?? query('room_id'),
    'date'         => $editing['date'] ?? (query('date') ?: date('Y-m-d')),
    'start_time'   => $editing['start_time'] ?? query('start'),
    'end_time'     => $editing['end_time'] ?? query('end'),
    'purpose'      => $editing['purpose'] ?? '',
    'class_name'   => $editing['class_name'] ?? '',
    'subject'      => $editing['subject'] ?? '',
    'attendees'    => $editing['attendees'] ?? '',
    'notes'        => $editing['notes'] ?? '',
    'repeat_weeks' => '1',
];
$errors = [];

if (is_post()) {
    foreach ($data as $k => $_) {
        $data[$k] = input($k);
    }
    if (empty($_POST['repeat'])) {
        $data['repeat_weeks'] = '1';
    }
    if ($editing) {
        $res = update_booking($editing, $data, $user);
        if ($res['ok']) {
            flash('success', 'Tempahan ' . $editing['ref_no'] . ' berjaya dikemas kini.');
            redirect('booking', ['id' => $editing['id']]);
        }
        $errors = $res['errors'];
    } else {
        $res = create_booking($data, $user);
        if ($res['ok']) {
            $n = count($res['ids']);
            $msg = $n > 1 ? "{$n} tempahan berulang berjaya dibuat." : 'Tempahan berjaya dibuat.';
            $msg .= $res['status'] === 'pending' ? ' Tempahan sedang menunggu kelulusan pentadbir.' : ' Tempahan anda telah disahkan.';
            flash('success', $msg);
            redirect('booking', ['id' => $res['ids'][0], 'new' => 1]);
        }
        $errors = $res['errors'];
    }
}

$rooms = all_rooms(true);
if ($editing && !array_filter($rooms, fn($r) => (int) $r['id'] === (int) $editing['room_id'])) {
    $rooms[] = find_room((int) $editing['room_id']);
}
$byCategory = [];
foreach ($rooms as $r) {
    $byCategory[$r['category'] ?: 'Lain-lain'][] = $r;
}
$periods = all_periods();
$maxDate = is_admin() ? '' : date('Y-m-d', strtotime('+' . (int) setting('max_advance_days', '60') . ' days'));
$roomsJs = array_map(fn($r) => [
    'id' => (int) $r['id'], 'name' => $r['name'], 'code' => $r['code'], 'location' => $r['location'], 'capacity' => (int) $r['capacity'],
    'facilities' => $r['facilities'], 'color' => $r['color'], 'approval' => (bool) $r['requires_approval'], 'pic' => $r['pic_name'],
], $rooms);

render_header($editing ? 'Pinda Tempahan' : 'Tempah Bilik', 'book');
page_title($editing ? 'Pinda Tempahan ' . $editing['ref_no'] : 'Tempah Bilik Khas',
    'Pilih bilik, tarikh dan masa. Sistem akan menyemak kekosongan secara automatik.');
?>
<?php if ($errors): ?>
    <div class="alert alert-danger">
        <div class="fw-semibold mb-1"><i class="bi bi-exclamation-octagon me-1"></i>Tempahan tidak dapat diproses:</div>
        <ul class="mb-0 ps-3"><?php foreach ($errors as $err): ?><li><?= e($err) ?></li><?php endforeach; ?></ul>
    </div>
<?php endif; ?>

<form method="post" id="bookingForm" data-exclude="<?= (int) ($editing['id'] ?? 0) ?>" autocomplete="off">
    <?= csrf_field() ?>
    <div class="row g-4">
        <div class="col-xl-8">
            <div class="card mb-4">
                <div class="card-header"><h2 class="card-title"><span class="step-no">1</span>Bilik &amp; Tarikh</h2></div>
                <div class="card-body">
                    <div class="row g-3">
                        <div class="col-md-7">
                            <label class="form-label fw-semibold" for="room_id">Bilik khas <span class="text-danger">*</span></label>
                            <select class="form-select form-select-lg" name="room_id" id="room_id" required>
                                <option value="">— Pilih bilik —</option>
                                <?php foreach ($byCategory as $cat => $list): ?>
                                    <optgroup label="<?= e($cat) ?>">
                                        <?php foreach ($list as $r): ?>
                                            <option value="<?= $r['id'] ?>" <?= (string) $data['room_id'] === (string) $r['id'] ? 'selected' : '' ?>>
                                                <?= e($r['name']) ?> (<?= (int) $r['capacity'] ?> orang)<?= $r['requires_approval'] ? ' — perlu kelulusan' : '' ?>
                                            </option>
                                        <?php endforeach; ?>
                                    </optgroup>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="col-md-5">
                            <label class="form-label fw-semibold" for="date">Tarikh <span class="text-danger">*</span></label>
                            <input type="date" class="form-control form-control-lg" name="date" id="date" value="<?= e($data['date']) ?>"
                                   min="<?= date('Y-m-d') ?>" <?= $maxDate ? 'max="' . $maxDate . '"' : '' ?> required>
                            <div class="form-text" id="dateLabel"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h2 class="card-title"><span class="step-no">2</span>Masa</h2>
                    <span class="small text-body-secondary"><i class="bi bi-hand-index me-1"></i>Klik waktu mula, kemudian waktu akhir</span>
                </div>
                <div class="card-body">
                    <div class="period-grid mb-3" id="periodGrid">
                        <?php foreach ($periods as $p): ?>
                            <button type="button" class="period-chip<?= $p['is_break'] ? ' is-break' : '' ?>" data-start="<?= e($p['start_time']) ?>" data-end="<?= e($p['end_time']) ?>">
                                <span class="pc-label"><?= e($p['label']) ?></span>
                                <span class="pc-time"><?= e($p['start_time']) ?>–<?= e($p['end_time']) ?></span>
                            </button>
                        <?php endforeach; ?>
                    </div>
                    <div class="row g-3 align-items-end">
                        <div class="col-sm-4">
                            <label class="form-label fw-semibold" for="start_time">Masa mula <span class="text-danger">*</span></label>
                            <input type="time" class="form-control" name="start_time" id="start_time" step="300" value="<?= e($data['start_time']) ?>" required>
                        </div>
                        <div class="col-sm-4">
                            <label class="form-label fw-semibold" for="end_time">Masa tamat <span class="text-danger">*</span></label>
                            <input type="time" class="form-control" name="end_time" id="end_time" step="300" value="<?= e($data['end_time']) ?>" required>
                        </div>
                        <div class="col-sm-4">
                            <div class="duration-box" id="durationBox"><i class="bi bi-stopwatch"></i> <span>—</span></div>
                        </div>
                    </div>

                    <?php if (!$editing): ?>
                        <div class="repeat-box mt-3">
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" role="switch" id="repeat" name="repeat" value="1" <?= (int) $data['repeat_weeks'] > 1 ? 'checked' : '' ?>>
                                <label class="form-check-label fw-semibold" for="repeat"><i class="bi bi-arrow-repeat me-1"></i>Ulang setiap minggu</label>
                            </div>
                            <div class="repeat-options mt-2" id="repeatOptions">
                                <div class="input-group" style="max-width: 280px">
                                    <span class="input-group-text">Selama</span>
                                    <input type="number" class="form-control" name="repeat_weeks" id="repeat_weeks" min="2" max="<?= (int) setting('max_recurring_weeks', '16') ?>" value="<?= max(2, (int) $data['repeat_weeks']) ?>">
                                    <span class="input-group-text">minggu</span>
                                </div>
                                <div class="form-text" id="repeatSummary"></div>
                            </div>
                        </div>
                    <?php endif; ?>

                    <div class="check-result mt-3" id="checkResult" hidden></div>
                </div>
            </div>

            <div class="card mb-4">
                <div class="card-header"><h2 class="card-title"><span class="step-no">3</span>Butiran Penggunaan</h2></div>
                <div class="card-body">
                    <div class="mb-3">
                        <label class="form-label fw-semibold" for="purpose">Tujuan / Aktiviti <span class="text-danger">*</span></label>
                        <input class="form-control" name="purpose" id="purpose" value="<?= e($data['purpose']) ?>" maxlength="150" required
                               placeholder="cth. PdP Sains – Eksperimen fotosintesis" list="purposeList">
                        <datalist id="purposeList">
                            <option value="Pengajaran & Pembelajaran (PdP)"><option value="Mesyuarat Panitia"><option value="Kelas Tambahan">
                            <option value="Aktiviti Kokurikulum"><option value="Peperiksaan / Ujian"><option value="Taklimat"><option value="Latihan / Bengkel">
                        </datalist>
                    </div>
                    <div class="row g-3 mb-3">
                        <div class="col-md-4">
                            <label class="form-label fw-semibold" for="class_name">Kelas</label>
                            <input class="form-control" name="class_name" id="class_name" value="<?= e($data['class_name']) ?>" maxlength="50" placeholder="cth. 4 Bestari">
                        </div>
                        <div class="col-md-5">
                            <label class="form-label fw-semibold" for="subject">Subjek</label>
                            <input class="form-control" name="subject" id="subject" value="<?= e($data['subject']) ?>" maxlength="80" placeholder="cth. Biologi">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label fw-semibold" for="attendees">Bil. peserta</label>
                            <input type="number" class="form-control" name="attendees" id="attendees" value="<?= e($data['attendees']) ?>" min="1">
                            <div class="form-text" id="capacityHint"></div>
                        </div>
                    </div>
                    <div>
                        <label class="form-label fw-semibold" for="notes">Catatan / Keperluan tambahan</label>
                        <textarea class="form-control" name="notes" id="notes" rows="3" maxlength="500" placeholder="cth. Perlukan projektor dan pembesar suara"><?= e($data['notes']) ?></textarea>
                    </div>
                </div>
            </div>

            <div class="d-flex gap-2 justify-content-end mb-4">
                <a href="<?= $editing ? url('booking', ['id' => $editing['id']]) : url('dashboard') ?>" class="btn btn-light px-4">Batal</a>
                <button class="btn btn-primary btn-lg px-5" id="submitBtn"><i class="bi bi-check2-circle me-1"></i><?= $editing ? 'Simpan Pindaan' : 'Hantar Tempahan' ?></button>
            </div>
        </div>

        <div class="col-xl-4">
            <div class="sticky-xl-top" style="top: 84px">
                <div class="card mb-4 room-info" id="roomInfo" hidden>
                    <div class="room-info-banner" id="roomBanner"><i class="bi bi-door-open"></i></div>
                    <div class="card-body">
                        <h3 class="h5 fw-bold mb-1" id="riName"></h3>
                        <div class="small text-body-secondary mb-3" id="riLocation"></div>
                        <div class="d-flex gap-3 mb-3 small">
                            <span><i class="bi bi-people me-1"></i><span id="riCapacity"></span> orang</span>
                            <span id="riPic"></span>
                        </div>
                        <div class="d-flex flex-wrap gap-1" id="riFacilities"></div>
                        <div class="alert alert-warning small py-2 mt-3 mb-0" id="riApproval" hidden><i class="bi bi-shield-lock me-1"></i>Bilik ini memerlukan kelulusan pentadbir.</div>
                    </div>
                </div>
                <div class="card">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <h2 class="card-title"><i class="bi bi-calendar-day me-2 text-primary"></i>Jadual Bilik</h2>
                        <span class="small text-body-secondary" id="dayTitle"></span>
                    </div>
                    <div class="card-body">
                        <div id="dayTimeline" class="day-timeline">
                            <div class="empty-state py-4"><i class="bi bi-door-closed"></i><p>Pilih bilik dan tarikh untuk melihat jadual.</p></div>
                        </div>
                        <div class="d-flex gap-3 xsmall text-body-secondary mt-3">
                            <span><span class="legend-box bg-free"></span>Kosong</span>
                            <span><span class="legend-box bg-busy"></span>Ditempah</span>
                            <span><span class="legend-box bg-pending"></span>Menunggu</span>
                            <span><span class="legend-box bg-selected"></span>Pilihan anda</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</form>
<?php
render_footer('<script>TB.bookingForm(' . js(['rooms' => $roomsJs, 'maxWeeks' => (int) setting('max_recurring_weeks', '16')]) . ');</script>');
