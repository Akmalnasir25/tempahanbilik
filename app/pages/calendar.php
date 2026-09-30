<?php
declare(strict_types=1);

$rooms = all_rooms();
$roomId = (int) query('room_id');
$views = ['month' => 'dayGridMonth', 'week' => 'timeGridWeek', 'day' => 'timeGridDay', 'list' => 'listWeek'];
$view = $views[query('view')] ?? 'timeGridWeek';
$periods = all_periods();

render_header('Jadual Tempahan', 'calendar');
page_title('Jadual Tempahan', 'Paparan jadual tempahan bilik khas mengikut hari, minggu atau bulan.',
    '<button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button>
     <a href="' . url('book') . '" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tempahan Baharu</a>');
?>
<div class="card mb-3 no-print">
    <div class="card-body py-3">
        <div class="row g-2 align-items-center">
            <div class="col-md-5 col-lg-4">
                <div class="input-group">
                    <span class="input-group-text"><i class="bi bi-door-open"></i></span>
                    <select id="calRoom" class="form-select">
                        <option value="">Semua bilik khas</option>
                        <?php foreach ($rooms as $r): ?>
                            <option value="<?= $r['id'] ?>" <?= $roomId === (int) $r['id'] ? 'selected' : '' ?>><?= e($r['name']) ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
            </div>
            <div class="col-auto">
                <div class="form-check form-switch mb-0">
                    <input class="form-check-input" type="checkbox" id="calMine">
                    <label class="form-check-label" for="calMine">Tempahan saya sahaja</label>
                </div>
            </div>
            <div class="col d-none d-lg-flex flex-wrap gap-2 justify-content-end room-legend">
                <?php foreach ($rooms as $r): if ($r['status'] === 'inactive') continue; ?>
                    <span class="xsmall"><span class="room-dot" style="--c: <?= e($r['color']) ?>"></span><?= e($r['code']) ?></span>
                <?php endforeach; ?>
                <span class="xsmall"><span class="legend-box bg-pending"></span>Menunggu</span>
            </div>
        </div>
    </div>
</div>

<div class="card">
    <div class="card-body">
        <div id="calendar"></div>
    </div>
</div>

<div class="modal fade" id="eventModal" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header border-0 pb-0">
                <div>
                    <div class="small text-body-secondary" data-ev="ref"></div>
                    <h5 class="modal-title fw-bold" data-ev="purpose"></h5>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <dl class="row mb-0 small detail-list">
                    <dt class="col-4">Bilik</dt><dd class="col-8" data-ev="room"></dd>
                    <dt class="col-4">Tarikh</dt><dd class="col-8" data-ev="date"></dd>
                    <dt class="col-4">Masa</dt><dd class="col-8" data-ev="time"></dd>
                    <dt class="col-4">Ditempah oleh</dt><dd class="col-8" data-ev="user"></dd>
                    <dt class="col-4">Kelas / Subjek</dt><dd class="col-8" data-ev="class"></dd>
                    <dt class="col-4">Status</dt><dd class="col-8" data-ev="status"></dd>
                </dl>
            </div>
            <div class="modal-footer border-0">
                <a href="#" class="btn btn-primary" data-ev="url">Lihat butiran penuh</a>
            </div>
        </div>
    </div>
</div>
<?php
$slotMin = setting('open_time', '07:00') . ':00';
$slotMax = setting('close_time', '18:00') . ':00';
$scripts = '<script src="assets/vendor/fullcalendar/index.global.min.js"></script><script src="assets/vendor/fullcalendar/locale-ms.global.min.js"></script>
<script>TB.calendar(' . js([
    'view' => $view,
    'slotMin' => $slotMin,
    'slotMax' => $slotMax,
    'weekends' => true,
    'today' => date('Y-m-d'),
    'bookUrl' => url('book'),
    'date' => valid_date(query('date')) ? query('date') : null,
]) . ');</script>';
render_footer($scripts);
