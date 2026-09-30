/* Sistem Tempahan Bilik Khas — teacher-facing pages */
(function (A) {
    'use strict';
    var $ = A.$, $$ = A.$$, esc = A.esc, S = A.S;
    

    function dateTile(b) {
        var d = new Date(b.date + 'T00:00:00');
        return '<div class="date-tile" style="--c:' + esc(b.room_color) + '"><span>' + A.MONTHS_SHORT[d.getMonth()] + '</span><strong>' + d.getDate() + '</strong></div>';
    }

    /* ==================================================================
     * Dashboard
     * ================================================================== */
    A.route('dashboard', { title: 'Papan Pemuka', render: function (ctx) {
        var admin = S.user.role === 'admin';
        return Promise.all([A.api('dashboard'), admin ? A.loadScript(A.vendor.chart) : null]).then(function (res) {
            if (!ctx.alive()) return;
            var d = res[0], now = d.now;
            var labels = admin ? ['Tempahan Hari Ini', 'Menunggu Kelulusan', 'Tempahan Bulan Ini', 'Pengguna Aktif'] : ['Tempahan Akan Datang', 'Menunggu Kelulusan', 'Tempahan Bulan Ini', 'Bilik Kosong Sekarang'];
            var icons = [['calendar-check', 'primary'], ['hourglass-split', 'warning'], ['graph-up-arrow', 'success'], [admin ? 'people' : 'door-open', 'info']];
            var links = admin ? ['#/admin/bookings', '#/admin/bookings?status=pending', '#/admin/reports', '#/admin/users'] : ['#/my-bookings', '#/my-bookings', '#/my-bookings?tab=all', '#/availability'];
            var h = '<div class="hero-card mb-4"><div class="row align-items-center g-3"><div class="col-lg-7">' +
                '<div class="text-white-50 small fw-semibold text-uppercase ls-1 mb-1">' + esc(S.settings.school_name) + '</div>' +
                '<h1 class="h3 fw-bold text-white mb-2">' + greeting() + ', ' + esc(S.user.name) + '</h1><p class="text-white-50 mb-0">' +
                (d.today.length ? 'Terdapat <strong class="text-white">' + d.today.length + ' tempahan</strong> bilik khas hari ini. ' + d.freeNow.length + ' bilik kosong pada masa ini.' : 'Tiada tempahan bilik khas hari ini. Semua bilik sedia untuk ditempah.') +
                '</p></div><div class="col-lg-5"><div class="d-flex flex-wrap gap-2 justify-content-lg-end">' +
                '<a href="#/book" class="btn btn-white fw-semibold"><i class="bi bi-plus-lg me-1"></i>Tempah Bilik</a>' +
                '<a href="#/availability" class="btn btn-outline-light"><i class="bi bi-search me-1"></i>Semak Kekosongan</a>' +
                '<a href="#/calendar" class="btn btn-outline-light"><i class="bi bi-calendar3 me-1"></i>Jadual</a></div></div></div></div>';

            h += '<div class="row g-3 mb-4">' + labels.map(function (l, i) {
                var v = i === 3 && !admin ? d.stats[3] + '<small class="fs-6 text-body-secondary fw-medium"> / ' + d.activeRooms + '</small>' : d.stats[i];
                return '<div class="col-6 col-xl-3"><a href="' + links[i] + '" class="stat-card"><div class="stat-icon bg-' + icons[i][1] + '-subtle text-' + icons[i][1] + '-emphasis"><i class="bi bi-' + icons[i][0] + '"></i></div><div><div class="stat-value">' + v + '</div><div class="stat-label">' + l + '</div></div></a></div>';
            }).join('') + '</div>';

            h += '<div class="row g-4"><div class="col-xl-8">';
            if (admin) {
                h += '<div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title"><i class="bi bi-hourglass-split text-warning me-2"></i>Menunggu Kelulusan</h2><a href="#/admin/bookings?status=pending" class="btn btn-sm btn-light">Lihat semua</a></div>' +
                    (d.pending.length ? '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><tbody>' + d.pending.map(function (b) {
                        return '<tr><td>' + A.dot(b.room_color) + '<strong>' + esc(b.room_name) + '</strong><div class="small text-body-secondary">' + esc(b.purpose) + '</div></td>' +
                            '<td class="small">' + A.fmtDate(b.date, true, true) + '<div class="text-body-secondary">' + b.start_time + ' – ' + b.end_time + '</div></td><td class="small">' + esc(b.user_name) + '</td>' +
                            '<td class="text-end text-nowrap"><button class="btn btn-sm btn-success" data-approve="' + b.id + '" title="Luluskan"><i class="bi bi-check-lg"></i></button> ' +
                            '<a href="#/booking?id=' + b.id + '" class="btn btn-sm btn-light"><i class="bi bi-eye"></i></a></td></tr>';
                    }).join('') + '</tbody></table></div>' : A.empty('check2-all', 'Tiada tempahan menunggu kelulusan.')) + '</div>';
            }
            h += '<div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title"><i class="bi bi-clock-history text-primary me-2"></i>Jadual Hari Ini</h2><a href="#/calendar?view=day" class="btn btn-sm btn-light">Paparan kalendar</a></div><div class="card-body">' +
                (d.today.length ? '<ul class="timeline">' + d.today.map(function (b) {
                    var st = b.end_time <= now ? 'past' : (b.start_time <= now ? 'live' : 'next');
                    return '<li class="timeline-item ' + st + '"><div class="timeline-time">' + b.start_time + '<small>' + b.end_time + '</small></div><div class="timeline-body" style="--c:' + esc(b.room_color) + '">' +
                        '<div class="d-flex justify-content-between gap-2 flex-wrap"><strong>' + esc(b.room_name) + '</strong><span>' + (st === 'live' ? '<span class="badge text-bg-danger live-badge">Sedang berlangsung</span>' : '') +
                        (b.status === 'pending' ? A.statusBadge('pending') : '') + '</span></div><div class="small">' + esc(b.purpose) + (b.class_name ? ' · ' + esc(b.class_name) : '') +
                        '</div><div class="small text-body-secondary"><i class="bi bi-person me-1"></i>' + esc(b.user_name) + '</div></div></li>';
                }).join('') + '</ul>' : A.empty('calendar2-check', 'Tiada tempahan untuk hari ini.')) + '</div></div>';
            if (admin) {
                h += '<div class="row g-4"><div class="col-md-7"><div class="card h-100"><div class="card-header"><h2 class="card-title">Trend Tempahan (6 bulan)</h2></div><div class="card-body"><canvas id="trendChart" height="220"></canvas></div></div></div>' +
                    '<div class="col-md-5"><div class="card h-100"><div class="card-header"><h2 class="card-title">Penggunaan Bilik Bulan Ini</h2></div><div class="card-body"><canvas id="roomChart" height="220"></canvas></div></div></div></div>';
            }
            h += '</div><div class="col-xl-4">';
            h += '<div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title"><i class="bi bi-journal-bookmark text-primary me-2"></i>Tempahan Saya</h2><a href="#/my-bookings" class="small">Semua</a></div><div class="list-group list-group-flush">' +
                (d.upcoming.length ? d.upcoming.map(function (b) {
                    return '<a href="#/booking?id=' + b.id + '" class="list-group-item list-group-item-action d-flex gap-3 align-items-center py-3">' + dateTile(b) +
                        '<div class="flex-grow-1 min-w-0"><div class="fw-semibold text-truncate">' + esc(b.room_name) + '</div><div class="small text-body-secondary">' + A.dayName(b.date) + ' · ' + b.start_time + ' – ' + b.end_time + '</div></div>' +
                        (b.status === 'pending' ? A.statusBadge('pending') : '') + '</a>';
                }).join('') : A.empty('calendar-plus', 'Anda tiada tempahan akan datang.', '<a href="#/book" class="btn btn-sm btn-primary">Buat tempahan</a>')) + '</div></div>';
            h += '<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title"><i class="bi bi-door-open text-success me-2"></i>Kosong Sekarang</h2><span class="badge badge-soft-success">' + d.freeNow.length + ' / ' + d.activeRooms + '</span></div><div class="list-group list-group-flush free-list">' +
                (d.freeNow.length ? d.freeNow.map(function (r) {
                    return '<div class="list-group-item d-flex align-items-center gap-2 py-2">' + A.dot(r.color) + '<div class="flex-grow-1 min-w-0"><div class="small fw-semibold text-truncate">' + esc(r.name) +
                        '</div><div class="xsmall text-body-secondary">' + (r.next_start ? 'Kosong hingga ' + r.next_start : 'Kosong sepanjang hari') + '</div></div><a href="' + A.link('book', { room_id: r.id, date: A.todayIso() }) + '" class="btn btn-sm btn-outline-primary">Tempah</a></div>';
                }).join('') : A.empty('x-octagon', 'Semua bilik sedang digunakan.')) + '</div></div></div></div>';

            ctx.view.innerHTML = h;
            $$('[data-approve]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.busy(btn, true);
                    A.api('booking.setStatus', { id: +btn.dataset.approve, status: 'approved' }).then(function (r) {
                        if (r.errors.length) A.toast(r.errors.join(' '), 'danger'); else A.toast('Tempahan diluluskan.');
                        A.reload();
                    }).catch(function (e) { A.busy(btn, false); A.showError(e); });
                };
            });
            if (admin) {
                A.charts.line('trendChart', d.trend.labels, d.trend.data);
                A.charts.bar('roomChart', d.perRoom.map(function (r) { return r.code; }), d.perRoom.map(function (r) { return r.n; }), d.perRoom.map(function (r) { return r.color; }), d.perRoom.map(function (r) { return r.name; }));
            }
        });
    } });

    function greeting() {
        var h = new Date().getHours();
        return h < 12 ? 'Selamat pagi' : h < 15 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
    }

    /* ==================================================================
     * Booking form (create / edit)
     * ================================================================== */
    A.route('book', { title: 'Tempah Bilik', render: function (ctx) {
        var p = ctx.params;
        var editP = p.id ? A.api('booking.get', { id: p.id }) : Promise.resolve(null);
        return editP.then(function (editing) {
            if (!ctx.alive()) return;
            if (editing && !editing.can_modify) { A.toast('Tempahan ini tidak boleh dipinda.', 'warning'); A.go('booking', { id: editing.id }); return; }
            var data = editing || { room_id: p.room_id || '', date: p.date || A.todayIso(), start_time: p.start || '', end_time: p.end || '', purpose: '', class_name: '', subject: '', attendees: '', notes: '' };
            var rooms = S.rooms.filter(function (r) { return r.status === 'active' || (editing && r.id === editing.room_id); });
            var byCat = {};
            rooms.forEach(function (r) { (byCat[r.category || 'Lain-lain'] = byCat[r.category || 'Lain-lain'] || []).push(r); });
            var maxDate = S.user.role === 'admin' ? '' : A.addDays(A.todayIso(), +S.settings.max_advance_days || 60);
            var h = A.pageTitle(editing ? 'Pinda Tempahan ' + editing.ref_no : 'Tempah Bilik Khas', 'Pilih bilik, tarikh dan masa. Sistem akan menyemak kekosongan secara automatik.') +
                '<div id="formErrors"></div><form id="bookingForm" autocomplete="off"><div class="row g-4"><div class="col-xl-8">' +
                '<div class="card mb-4"><div class="card-header"><h2 class="card-title"><span class="step-no">1</span>Bilik &amp; Tarikh</h2></div><div class="card-body"><div class="row g-3">' +
                '<div class="col-md-7"><label class="form-label fw-semibold" for="room_id">Bilik khas <span class="text-danger">*</span></label><select class="form-select form-select-lg" name="room_id" id="room_id" required><option value="">— Pilih bilik —</option>' +
                Object.keys(byCat).map(function (c) {
                    return '<optgroup label="' + esc(c) + '">' + byCat[c].map(function (r) {
                        return '<option value="' + r.id + '"' + (String(data.room_id) === String(r.id) ? ' selected' : '') + '>' + esc(r.name) + ' (' + r.capacity + ' orang)' + (A.roomNeedsApproval(r) ? ' — perlu kelulusan' : '') + '</option>';
                    }).join('') + '</optgroup>';
                }).join('') + '</select></div>' +
                '<div class="col-md-5"><label class="form-label fw-semibold" for="date">Tarikh <span class="text-danger">*</span></label><input type="date" class="form-control form-control-lg" name="date" id="date" value="' + esc(data.date) + '" min="' + A.todayIso() + '"' + (maxDate ? ' max="' + maxDate + '"' : '') + ' required><div class="form-text" id="dateLabel"></div></div>' +
                '</div></div></div>' +
                '<div class="card mb-4"><div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2"><h2 class="card-title"><span class="step-no">2</span>Masa</h2><span class="small text-body-secondary"><i class="bi bi-hand-index me-1"></i>Klik waktu mula, kemudian waktu akhir</span></div><div class="card-body">' +
                '<div class="period-grid mb-3" id="periodGrid">' + S.periods.map(function (pr) {
                    return '<button type="button" class="period-chip' + (+pr.is_break ? ' is-break' : '') + '" data-start="' + pr.start_time + '" data-end="' + pr.end_time + '"><span class="pc-label">' + esc(pr.label) + '</span><span class="pc-time">' + pr.start_time + '–' + pr.end_time + '</span></button>';
                }).join('') + '</div>' +
                '<div class="row g-3 align-items-end"><div class="col-sm-4"><label class="form-label fw-semibold" for="start_time">Masa mula <span class="text-danger">*</span></label><input type="time" class="form-control" name="start_time" id="start_time" step="300" value="' + esc(data.start_time) + '" required></div>' +
                '<div class="col-sm-4"><label class="form-label fw-semibold" for="end_time">Masa tamat <span class="text-danger">*</span></label><input type="time" class="form-control" name="end_time" id="end_time" step="300" value="' + esc(data.end_time) + '" required></div>' +
                '<div class="col-sm-4"><div class="duration-box" id="durationBox"><i class="bi bi-stopwatch"></i> <span>—</span></div></div></div>' +
                (editing ? '' : '<div class="repeat-box mt-3"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" id="repeat"><label class="form-check-label fw-semibold" for="repeat"><i class="bi bi-arrow-repeat me-1"></i>Ulang setiap minggu</label></div>' +
                    '<div class="repeat-options mt-2"><div class="input-group" style="max-width:280px"><span class="input-group-text">Selama</span><input type="number" class="form-control" id="repeat_weeks" min="2" max="' + (+S.settings.max_recurring_weeks || 16) + '" value="4"><span class="input-group-text">minggu</span></div><div class="form-text" id="repeatSummary"></div></div></div>') +
                '<div class="check-result mt-3" id="checkResult" hidden></div></div></div>' +
                '<div class="card mb-4"><div class="card-header"><h2 class="card-title"><span class="step-no">3</span>Butiran Penggunaan</h2></div><div class="card-body">' +
                '<div class="mb-3"><label class="form-label fw-semibold" for="purpose">Tujuan / Aktiviti <span class="text-danger">*</span></label><input class="form-control" name="purpose" id="purpose" value="' + esc(data.purpose) + '" maxlength="150" required placeholder="cth. PdP Sains – Eksperimen fotosintesis" list="purposeList">' +
                '<datalist id="purposeList"><option value="Pengajaran & Pembelajaran (PdP)"><option value="Mesyuarat Panitia"><option value="Kelas Tambahan"><option value="Aktiviti Kokurikulum"><option value="Peperiksaan / Ujian"><option value="Taklimat"><option value="Latihan / Bengkel"></datalist></div>' +
                '<div class="row g-3 mb-3"><div class="col-md-4"><label class="form-label fw-semibold">Kelas</label><input class="form-control" name="class_name" value="' + esc(data.class_name) + '" maxlength="50" placeholder="cth. 4 Bestari"></div>' +
                '<div class="col-md-5"><label class="form-label fw-semibold">Subjek</label><input class="form-control" name="subject" value="' + esc(data.subject) + '" maxlength="80" placeholder="cth. Biologi"></div>' +
                '<div class="col-md-3"><label class="form-label fw-semibold">Bil. peserta</label><input type="number" class="form-control" name="attendees" id="attendees" value="' + esc(data.attendees) + '" min="1"><div class="form-text" id="capacityHint"></div></div></div>' +
                '<div><label class="form-label fw-semibold">Catatan / Keperluan tambahan</label><textarea class="form-control" name="notes" rows="3" maxlength="500" placeholder="cth. Perlukan projektor dan pembesar suara">' + esc(data.notes) + '</textarea></div></div></div>' +
                '<div class="d-flex gap-2 justify-content-end mb-4"><a href="' + (editing ? '#/booking?id=' + editing.id : '#/dashboard') + '" class="btn btn-light px-4">Batal</a><button class="btn btn-primary btn-lg px-5" id="submitBtn"><i class="bi bi-check2-circle me-1"></i>' + (editing ? 'Simpan Pindaan' : 'Hantar Tempahan') + '</button></div>' +
                '</div><div class="col-xl-4"><div class="sticky-xl-top" style="top:84px">' +
                '<div class="card mb-4 room-info" id="roomInfo" hidden><div class="room-info-banner" id="roomBanner"><i class="bi bi-door-open"></i></div><div class="card-body"><h3 class="h5 fw-bold mb-1" id="riName"></h3><div class="small text-body-secondary mb-3" id="riLocation"></div>' +
                '<div class="d-flex gap-3 mb-3 small"><span><i class="bi bi-people me-1"></i><span id="riCapacity"></span> orang</span><span id="riPic"></span></div><div class="d-flex flex-wrap gap-1" id="riFacilities"></div>' +
                '<div class="alert alert-warning small py-2 mt-3 mb-0" id="riApproval" hidden><i class="bi bi-shield-lock me-1"></i>Tempahan bilik ini memerlukan kelulusan pentadbir.</div></div></div>' +
                '<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title"><i class="bi bi-calendar-day me-2 text-primary"></i>Jadual Bilik</h2><span class="small text-body-secondary" id="dayTitle"></span></div>' +
                '<div class="card-body"><div id="dayTimeline" class="day-timeline"></div><div class="d-flex gap-3 xsmall text-body-secondary mt-3"><span><span class="legend-box bg-free"></span>Kosong</span><span><span class="legend-box bg-busy"></span>Ditempah</span><span><span class="legend-box bg-pending"></span>Menunggu</span><span><span class="legend-box bg-selected"></span>Pilihan anda</span></div></div></div>' +
                '</div></div></div></form>';
            ctx.view.innerHTML = h;
            bookingForm(ctx, editing);
        });
    } });

    function bookingForm(ctx, editing) {
        var form = $('#bookingForm'), room = $('#room_id'), date = $('#date'), start = $('#start_time'), end = $('#end_time');
        var chips = $$('.period-chip'), repeat = $('#repeat'), repeatWeeks = $('#repeat_weeks');
        var result = $('#checkResult'), submit = $('#submitBtn');
        var exclude = editing ? editing.id : 0;
        var dayBookings = [], dayClosed = null, dayOpen = S.settings.open_time || '07:00', dayClose = S.settings.close_time || '18:00', anchor = null;

        function roomInfo() {
            var r = A.room(room.value);
            $('#roomInfo').hidden = !r;
            if (!r) return;
            $('#roomBanner').style.setProperty('--c', r.color);
            $('#riName').textContent = r.name;
            $('#riLocation').innerHTML = '<i class="bi bi-geo-alt me-1"></i>' + esc(r.location || '-') + ' · ' + esc(r.code);
            $('#riCapacity').textContent = r.capacity;
            $('#riPic').innerHTML = r.pic_name ? '<i class="bi bi-person-badge me-1"></i>' + esc(r.pic_name) : '';
            $('#riFacilities').innerHTML = String(r.facilities || '').split(',').map(function (f) { return f.trim(); }).filter(Boolean).map(function (f) { return '<span class="facility-tag">' + esc(f) + '</span>'; }).join('');
            $('#riApproval').hidden = !(A.roomNeedsApproval(r) && S.user.role !== 'admin');
            capacityHint();
        }
        function capacityHint() {
            var r = A.room(room.value), n = +$('#attendees').value, hint = $('#capacityHint');
            if (!r || !n) { hint.textContent = ''; hint.className = 'form-text'; return; }
            var over = r.capacity > 0 && n > r.capacity;
            hint.textContent = over ? 'Melebihi kapasiti (' + r.capacity + ')' : 'Kapasiti: ' + r.capacity;
            hint.className = 'form-text ' + (over ? 'text-danger fw-semibold' : '');
        }
        var isToday = function () { return date.value === A.todayIso(); };
        function paintChips() {
            chips.forEach(function (c) {
                var cs = c.dataset.start, ce = c.dataset.end;
                var busyC = dayClosed || dayBookings.some(function (b) { return b.start < ce && b.end > cs; });
                var past = !date.value || date.value < A.todayIso() || (isToday() && A.toMin(ce) <= A.nowMin());
                c.classList.toggle('busy', !!busyC);
                c.classList.toggle('past', past);
                c.classList.toggle('selected', !!(start.value && end.value && cs >= start.value && ce <= end.value));
                c.classList.toggle('anchor', c === anchor);
                c.title = busyC ? 'Telah ditempah' : '';
            });
        }
        function paintDuration() {
            $('#durationBox span').textContent = start.value && end.value && end.value > start.value ? A.duration(start.value, end.value) : '—';
        }
        function paintTimeline() {
            var el = $('#dayTimeline');
            $('#dayTitle').textContent = date.value ? A.fmtDate(date.value, true) : '';
            if (!room.value || !date.value) { el.innerHTML = A.empty('door-closed', 'Pilih bilik dan tarikh untuk melihat jadual.'); return; }
            if (dayClosed) { el.innerHTML = '<div class="dt-closed"><i class="bi bi-lock fs-4 d-block mb-1"></i>Bilik ditutup pada tarikh ini:<br><strong>' + esc(dayClosed) + '</strong></div>'; return; }
            var from = Math.floor(A.toMin(dayOpen) / 60) * 60, to = Math.ceil(A.toMin(dayClose) / 60) * 60, PX = 42;
            var y = function (t) { return (A.toMin(t) - from) / 60 * PX; };
            var html = '<div class="dt-grid" style="height:' + ((to - from) / 60 * PX) + 'px">';
            for (var m = from; m < to; m += 60) html += '<div class="dt-hour" style="height:' + PX + 'px"><span>' + A.toTime(m) + '</span></div>';
            dayBookings.forEach(function (b) {
                html += '<div class="dt-block ' + (b.status === 'pending' ? 'pending' : '') + '" style="top:' + y(b.start) + 'px;height:' + Math.max(16, y(b.end) - y(b.start)) + 'px" title="' + esc(b.purpose + ' — ' + b.user) + '"><strong>' + b.start + '–' + b.end + '</strong> ' + esc(b.purpose) + ' <span class="opacity-75">· ' + esc(b.user) + '</span></div>';
            });
            if (start.value && end.value && end.value > start.value) {
                var clash = dayBookings.some(function (b) { return b.start < end.value && b.end > start.value; });
                html += '<div class="dt-block mine-sel' + (clash ? ' clash' : '') + '" style="top:' + y(start.value) + 'px;height:' + Math.max(16, y(end.value) - y(start.value)) + 'px"><strong>' + (clash ? 'Bertembung!' : 'Pilihan anda') + '</strong> ' + start.value + '–' + end.value + '</div>';
            }
            if (isToday() && A.nowMin() >= from && A.nowMin() <= to) html += '<div class="dt-now" style="top:' + ((A.nowMin() - from) / 60 * PX) + 'px"></div>';
            el.innerHTML = html + '</div>';
        }
        function paintAll() { paintChips(); paintDuration(); paintTimeline(); }
        function loadDay() {
            $('#dateLabel').textContent = date.value ? A.fmtDate(date.value, true) : '';
            if (!room.value || !date.value) { dayBookings = []; dayClosed = null; paintAll(); return; }
            $('#dayTimeline').innerHTML = '<div class="view-loading" style="min-height:120px"><span class="spinner-border spinner-border-sm"></span></div>';
            A.api('availability', { date: date.value, room_id: room.value, exclude: exclude }).then(function (res) {
                if (!ctx.alive()) return;
                dayBookings = res.bookings; dayClosed = res.closures[room.value] || null; dayOpen = res.open; dayClose = res.close;
                paintAll();
            }).catch(A.showError);
            check();
        }
        var seq = 0;
        var check = A.debounce(function () {
            if (!room.value || !date.value || !start.value || !end.value) { result.hidden = true; submit.disabled = false; return; }
            var weeks = repeat && repeat.checked ? +repeatWeeks.value : 1, my = ++seq;
            result.hidden = false;
            result.className = 'check-result mt-3 loading';
            result.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyemak kekosongan…';
            A.api('check', { room_id: room.value, date: date.value, start: start.value, end: end.value, repeat_weeks: weeks, exclude: exclude }).then(function (res) {
                if (my !== seq || !ctx.alive()) return;
                if (res.ok) {
                    result.className = 'check-result mt-3 ok';
                    result.innerHTML = '<i class="bi bi-check-circle-fill fs-5"></i><div><strong>Slot tersedia!</strong> ' + (weeks > 1 ? 'Kesemua ' + weeks + ' minggu kosong. ' : '') +
                        (res.approval ? 'Tempahan akan menunggu kelulusan pentadbir.' : 'Tempahan akan disahkan serta-merta.') + '</div>';
                    submit.disabled = false;
                } else {
                    result.className = 'check-result mt-3 bad';
                    result.innerHTML = '<i class="bi bi-x-octagon-fill fs-5"></i><div><strong>Tidak boleh ditempah:</strong><ul>' + res.errors.slice(0, 8).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
                    submit.disabled = true;
                }
            }).catch(function () { result.hidden = true; submit.disabled = false; });
        }, 350);

        chips.forEach(function (c, idx) {
            c.onclick = function () {
                if (c.classList.contains('past')) return;
                if (anchor && anchor !== c) {
                    var a = chips.indexOf(anchor), lo = Math.min(a, idx), hi = Math.max(a, idx);
                    start.value = chips[lo].dataset.start; end.value = chips[hi].dataset.end; anchor = null;
                } else {
                    start.value = c.dataset.start; end.value = c.dataset.end; anchor = c;
                }
                paintAll(); check();
            };
        });
        [start, end].forEach(function (i) { i.onchange = function () { anchor = null; paintAll(); check(); }; });
        room.onchange = function () { roomInfo(); loadDay(); };
        date.onchange = function () { loadDay(); summary(); };
        $('#attendees').oninput = capacityHint;
        function summary() {
            if (!repeat) return;
            var box = repeat.closest('.repeat-box');
            box.classList.toggle('on', repeat.checked);
            var n = +repeatWeeks.value || 0;
            $('#repeatSummary').textContent = repeat.checked && date.value && n > 1 ? 'Setiap ' + A.dayName(date.value) + ', ' + n + ' kali — hingga ' + A.fmtDate(A.addDays(date.value, (n - 1) * 7)) : '';
        }
        if (repeat) {
            repeat.onchange = function () { summary(); check(); };
            repeatWeeks.oninput = function () {
                var max = +S.settings.max_recurring_weeks || 16;
                if (+repeatWeeks.value > max) repeatWeeks.value = max;
                summary(); check();
            };
        }
        form.onsubmit = function (e) {
            e.preventDefault();
            var d = A.formData(form);
            if (!d.room_id || !d.date || !d.start_time || !d.end_time || !d.purpose) { A.toast('Sila lengkapkan semua medan wajib.', 'warning'); return; }
            d.repeat_weeks = repeat && repeat.checked ? +repeatWeeks.value : 1;
            if (editing) d.id = editing.id;
            A.busy(submit, true);
            A.api(editing ? 'booking.update' : 'booking.create', d).then(function (res) {
                if (editing) { A.toast('Tempahan ' + editing.ref_no + ' berjaya dikemas kini.'); A.go('booking', { id: editing.id }); return; }
                var n = res.ids.length;
                A.toast((n > 1 ? n + ' tempahan berulang berjaya dibuat.' : 'Tempahan berjaya dibuat.') + (res.status === 'pending' ? ' Menunggu kelulusan pentadbir.' : ' Tempahan disahkan.'));
                A.go('booking', { id: res.ids[0], new: 1 });
            }).catch(function (err) {
                A.busy(submit, false);
                var list = (err.info && err.info.errors) || [err.message];
                $('#formErrors').innerHTML = '<div class="alert alert-danger"><div class="fw-semibold mb-1"><i class="bi bi-exclamation-octagon me-1"></i>Tempahan tidak dapat diproses:</div><ul class="mb-0 ps-3">' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
                window.scrollTo(0, 0);
                check();
            });
        };
        roomInfo(); loadDay(); summary(); paintAll();
    }

    /* ==================================================================
     * Availability grid & free-room finder
     * ================================================================== */
    A.route('availability', { title: 'Semak Kekosongan', render: function (ctx) {
        var p = ctx.params;
        var date = /^\d{4}-\d{2}-\d{2}$/.test(p.date || '') ? p.date : A.todayIso();
        return A.api('availability', { date: date }).then(function (d) {
            if (!ctx.alive()) return;
            var rooms = S.rooms.filter(function (r) { return r.status === 'active' && (!p.category || r.category === p.category); });
            var cats = S.rooms.map(function (r) { return r.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
            var byRoom = {};
            d.bookings.forEach(function (b) { (byRoom[b.room_id] = byRoom[b.room_id] || []).push(b); });
            var today = A.todayIso(), nowT = A.toTime(A.nowMin()), isToday = date === today, pastDay = date < today;
            var finder = null;
            if (p.start && p.end && p.end > p.start) {
                finder = rooms.filter(function (r) {
                    if (d.closures[r.id] || (p.capacity && r.capacity < +p.capacity)) return false;
                    return !(byRoom[r.id] || []).some(function (b) { return b.start < p.end && b.end > p.start; });
                });
            }
            var nav = function (dd) { return A.link('availability', { date: dd, category: p.category }); };
            var h = A.pageTitle('Semak Kekosongan Bilik', 'Lihat status semua bilik khas mengikut waktu, atau cari bilik yang kosong pada masa tertentu.') +
                '<div class="card mb-4"><div class="card-body"><form class="row g-3 align-items-end" id="finder">' +
                '<div class="col-sm-6 col-lg-3"><label class="form-label fw-semibold small">Tarikh</label><input type="date" name="date" class="form-control" value="' + date + '"></div>' +
                '<div class="col-6 col-lg-2"><label class="form-label fw-semibold small">Dari</label><input type="time" name="start" class="form-control" value="' + esc(p.start || '') + '" step="300"></div>' +
                '<div class="col-6 col-lg-2"><label class="form-label fw-semibold small">Hingga</label><input type="time" name="end" class="form-control" value="' + esc(p.end || '') + '" step="300"></div>' +
                '<div class="col-6 col-lg-2"><label class="form-label fw-semibold small">Kategori</label><select name="category" class="form-select"><option value="">Semua</option>' + cats.map(function (c) { return '<option' + (c === p.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
                '<div class="col-6 col-lg-1"><label class="form-label fw-semibold small">Min. kapasiti</label><input type="number" name="capacity" class="form-control" value="' + esc(p.capacity || '') + '" min="1"></div>' +
                '<div class="col-lg-2 d-grid"><button class="btn btn-primary"><i class="bi bi-search me-1"></i>Cari</button></div></form></div></div>';
            if (finder) {
                h += '<div class="card mb-4 border-primary-subtle"><div class="card-header bg-primary-subtle"><h2 class="card-title text-primary-emphasis"><i class="bi bi-stars me-2"></i>' + finder.length + ' bilik kosong pada ' + A.fmtDate(date, true) + ', ' + esc(p.start) + ' – ' + esc(p.end) + '</h2></div><div class="card-body">' +
                    (finder.length ? '<div class="row g-3">' + finder.map(function (r) {
                        return '<div class="col-md-6 col-xl-4"><div class="free-room" style="--c:' + esc(r.color) + '"><div class="flex-grow-1 min-w-0"><div class="fw-semibold text-truncate">' + esc(r.name) + '</div><div class="small text-body-secondary"><i class="bi bi-geo-alt me-1"></i>' + esc(r.location) + ' · <i class="bi bi-people mx-1"></i>' + r.capacity + '</div></div>' +
                            (pastDay ? '' : '<a class="btn btn-sm btn-primary" href="' + A.link('book', { room_id: r.id, date: date, start: p.start, end: p.end }) + '">Tempah</a>') + '</div></div>';
                    }).join('') + '</div>' : A.empty('emoji-frown', 'Tiada bilik yang kosong untuk masa tersebut. Cuba masa atau tarikh lain.')) + '</div></div>';
            }
            h += '<div class="card"><div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"><div class="d-flex align-items-center gap-2">' +
                '<a class="btn btn-sm btn-light" href="' + nav(A.addDays(date, -1)) + '"><i class="bi bi-chevron-left"></i></a><a class="btn btn-sm btn-light" href="' + nav(today) + '">Hari ini</a>' +
                '<a class="btn btn-sm btn-light" href="' + nav(A.addDays(date, 1)) + '"><i class="bi bi-chevron-right"></i></a><h2 class="card-title ms-2">' + A.fmtDate(date, true) + '</h2></div>' +
                '<div class="d-flex gap-3 xsmall text-body-secondary"><span><span class="legend-box bg-free"></span>Kosong (klik untuk tempah)</span><span><span class="legend-box bg-busy"></span>Ditempah</span><span><span class="legend-box bg-pending"></span>Menunggu</span><span><span class="legend-box bg-closed"></span>Ditutup</span></div></div>' +
                '<div class="table-responsive avail-wrap"><table class="avail-grid"><thead><tr><th class="sticky-col">Bilik</th>' +
                S.periods.map(function (pr) {
                    return '<th class="' + (+pr.is_break ? 'is-break' : '') + (isToday && pr.start_time <= nowT && pr.end_time > nowT ? ' is-now' : '') + '"><div>' + esc(pr.label) + '</div><small>' + pr.start_time + '</small></th>';
                }).join('') + '</tr></thead><tbody>' +
                (rooms.length ? '' : '<tr><td colspan="' + (S.periods.length + 1) + '" class="text-center py-4 text-body-secondary">Tiada bilik aktif.</td></tr>') +
                rooms.map(function (r) {
                    var row = '<tr><th class="sticky-col">' + A.dot(r.color) + esc(r.name) + '<div class="xsmall text-body-secondary fw-normal">' + esc(r.code) + ' · ' + r.capacity + ' orang</div></th>';
                    if (d.closures[r.id]) return row + '<td colspan="' + S.periods.length + '" class="cell-closed"><i class="bi bi-lock me-1"></i>Ditutup: ' + esc(d.closures[r.id]) + '</td></tr>';
                    return row + S.periods.map(function (pr) {
                        var hit = (byRoom[r.id] || []).filter(function (b) { return b.start < pr.end_time && b.end > pr.start_time; })[0];
                        var past = pastDay || (isToday && pr.end_time <= nowT);
                        if (hit) return '<td class="cell-busy' + (hit.status === 'pending' ? ' pending' : '') + '" style="--c:' + esc(r.color) + '" data-bs-toggle="tooltip" data-bs-html="true" data-bs-title="' +
                            esc('<strong>' + esc(hit.purpose) + '</strong><br>' + esc(hit.user) + '<br>' + hit.start + ' – ' + hit.end + (hit.status === 'pending' ? '<br><em>Menunggu kelulusan</em>' : '')) + '"><a href="#/booking?id=' + hit.id + '">' + esc(A.initials(hit.user)) + '</a></td>';
                        if (+pr.is_break) return '<td class="cell-break"></td>';
                        if (past) return '<td class="cell-past"></td>';
                        return '<td class="cell-free"><a href="' + A.link('book', { room_id: r.id, date: date, start: pr.start_time, end: pr.end_time }) + '" title="Tempah ' + esc(r.name) + ' ' + pr.start_time + '–' + pr.end_time + '"><i class="bi bi-plus"></i></a></td>';
                    }).join('') + '</tr>';
                }).join('') + '</tbody></table></div></div>';
            ctx.view.innerHTML = h;
            $$('[data-bs-toggle="tooltip"]', ctx.view).forEach(function (el) { new bootstrap.Tooltip(el, { container: 'body' }); });
            $('#finder').onsubmit = function (e) { e.preventDefault(); A.go('availability', A.formData(this)); };
        });
    } });

    /* ==================================================================
     * Calendar (FullCalendar)
     * ================================================================== */
    A.route('calendar', { title: 'Jadual Tempahan', render: function (ctx) {
        return A.loadScript(A.vendor.fullcalendar).then(function () {
            return A.loadScript(A.vendor.fullcalendarLocale);
        }).then(function () {
            if (!ctx.alive()) return;
            var p = ctx.params;
            var views = { month: 'dayGridMonth', week: 'timeGridWeek', day: 'timeGridDay', list: 'listWeek' };
            var view = views[p.view] || 'timeGridWeek';
            ctx.view.innerHTML = A.pageTitle('Jadual Tempahan', 'Paparan jadual tempahan bilik khas mengikut hari, minggu atau bulan.',
                '<button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button><a href="#/book" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tempahan Baharu</a>') +
                '<div class="card mb-3 no-print"><div class="card-body py-3"><div class="row g-2 align-items-center"><div class="col-md-5 col-lg-4"><div class="input-group"><span class="input-group-text"><i class="bi bi-door-open"></i></span>' +
                '<select id="calRoom" class="form-select"><option value="">Semua bilik khas</option>' + S.rooms.map(function (r) { return '<option value="' + r.id + '"' + (String(p.room_id) === String(r.id) ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></div></div>' +
                '<div class="col-auto"><div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" id="calMine"><label class="form-check-label" for="calMine">Tempahan saya sahaja</label></div></div>' +
                '<div class="col d-none d-lg-flex flex-wrap gap-2 justify-content-end room-legend">' + S.rooms.filter(function (r) { return r.status !== 'inactive'; }).map(function (r) { return '<span class="xsmall">' + A.dot(r.color) + esc(r.code) + '</span>'; }).join('') +
                '<span class="xsmall"><span class="legend-box bg-pending"></span>Menunggu</span></div></div></div></div>' +
                '<div class="card"><div class="card-body"><div id="calendar"></div></div></div>' +
                '<div class="modal fade" id="eventModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-header border-0 pb-0"><div><div class="small text-body-secondary" data-ev="ref"></div><h5 class="modal-title fw-bold" data-ev="purpose"></h5></div><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
                '<div class="modal-body"><dl class="row mb-0 small detail-list"><dt class="col-4">Bilik</dt><dd class="col-8" data-ev="room"></dd><dt class="col-4">Tarikh</dt><dd class="col-8" data-ev="date"></dd><dt class="col-4">Masa</dt><dd class="col-8" data-ev="time"></dd>' +
                '<dt class="col-4">Ditempah oleh</dt><dd class="col-8" data-ev="user"></dd><dt class="col-4">Kelas / Subjek</dt><dd class="col-8" data-ev="class"></dd><dt class="col-4">Status</dt><dd class="col-8" data-ev="status"></dd></dl></div>' +
                '<div class="modal-footer border-0"><a href="#" class="btn btn-primary" data-ev="url">Lihat butiran penuh</a></div></div></div></div>';
            var roomSel = $('#calRoom'), mine = $('#calMine'), modal = $('#eventModal');
            var cal = new FullCalendar.Calendar($('#calendar'), {
                locale: 'ms', initialView: window.innerWidth < 768 && view === 'timeGridWeek' ? 'listWeek' : view, initialDate: p.date || undefined,
                firstDay: 1, height: 'auto', nowIndicator: true, slotMinTime: (S.settings.open_time || '07:00') + ':00', slotMaxTime: (S.settings.close_time || '18:00') + ':00',
                slotDuration: '00:30:00', allDayText: 'Hari', dayMaxEvents: 4, selectable: true, selectMirror: true, eventDisplay: 'block',
                headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
                buttonText: { today: 'Hari ini', month: 'Bulan', week: 'Minggu', day: 'Hari', list: 'Senarai' },
                noEventsContent: 'Tiada tempahan dalam tempoh ini', moreLinkContent: function (a) { return '+' + a.num + ' lagi'; },
                slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false }, eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
                views: { timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } }, timeGridDay: { dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' } } },
                events: function (info, ok, fail) {
                    A.api('events', { start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10), room_id: roomSel.value, mine: mine.checked }).then(ok).catch(function (e) { A.showError(e); fail(e); });
                },
                eventDidMount: function (arg) {
                    var x = arg.event.extendedProps;
                    if (!x.closure) arg.el.title = x.room + '\n' + x.time + ' · ' + x.user + '\n' + x.purpose + (x.status === 'pending' ? '\n(Menunggu kelulusan)' : '');
                },
                eventClick: function (arg) {
                    var x = arg.event.extendedProps;
                    if (x.closure) return;
                    arg.jsEvent.preventDefault();
                    var set = function (k, v) { $('[data-ev="' + k + '"]', modal).textContent = v || '-'; };
                    set('ref', x.ref); set('purpose', x.purpose); set('room', x.room); set('time', x.time); set('user', x.user);
                    set('date', A.fmtDate(arg.event.startStr.slice(0, 10), true)); set('class', [x['class'], x.subject].filter(Boolean).join(' · '));
                    $('[data-ev="status"]', modal).innerHTML = A.statusBadge(x.status);
                    $('[data-ev="url"]', modal).href = '#/booking?id=' + arg.event.id;
                    $('[data-ev="url"]', modal).onclick = function () { bootstrap.Modal.getInstance(modal).hide(); };
                    bootstrap.Modal.getOrCreateInstance(modal).show();
                },
                selectAllow: function (info) { return info.startStr.slice(0, 10) >= A.todayIso(); },
                select: function (info) {
                    var q = { date: info.startStr.slice(0, 10), room_id: roomSel.value };
                    if (!info.allDay) { q.start = info.startStr.slice(11, 16); q.end = info.endStr.slice(11, 16); }
                    A.go('book', q);
                },
            });
            cal.render();
            roomSel.onchange = mine.onchange = function () { cal.refetchEvents(); };
        });
    } });

    /* ==================================================================
     * My bookings
     * ================================================================== */
    A.route('my-bookings', { title: 'Tempahan Saya', render: function (ctx) {
        var tab = ctx.params.tab || 'upcoming', q = ctx.params.q || '';
        return A.api('myBookings', { tab: tab, q: q }).then(function (d) {
            if (!ctx.alive()) return;
            var tabs = { upcoming: 'Akan Datang', past: 'Selesai', closed: 'Dibatal / Ditolak', all: 'Semua' };
            ctx.view.innerHTML = A.pageTitle('Tempahan Saya', 'Urus semua tempahan bilik khas anda.', '<a href="#/book" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tempahan Baharu</a>') +
                '<div class="card"><div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"><ul class="nav nav-pills nav-pills-soft">' +
                Object.keys(tabs).map(function (k) { return '<li class="nav-item"><a class="nav-link' + (tab === k ? ' active' : '') + '" href="' + A.link('my-bookings', { tab: k }) + '">' + tabs[k] + ' <span class="badge rounded-pill">' + d.counts[k] + '</span></a></li>'; }).join('') +
                '</ul><form id="mbSearch"><div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="' + esc(q) + '" placeholder="Cari tempahan…"></div></form></div>' +
                (d.rows.length ? '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Tarikh &amp; Masa</th><th>Bilik</th><th>Tujuan</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead><tbody>' +
                    d.rows.map(function (b) {
                        return '<tr><td class="text-nowrap"><div class="fw-semibold">' + A.fmtDate(b.date, true, true) + '</div><div class="small text-body-secondary">' + b.start_time + ' – ' + b.end_time + '</div></td>' +
                            '<td>' + A.dot(b.room_color) + esc(b.room_name) + '<div class="xsmall text-body-secondary">' + esc(b.room_location) + '</div></td>' +
                            '<td><div>' + esc(b.purpose) + '</div><div class="xsmall text-body-secondary">' + esc(b.ref_no) + (b.class_name ? ' · ' + esc(b.class_name) : '') + (b.series_id ? ' · <i class="bi bi-arrow-repeat"></i> berulang' : '') + '</div></td>' +
                            '<td>' + A.statusBadge(b.status) + '</td><td class="text-end text-nowrap"><a href="#/booking?id=' + b.id + '" class="btn btn-sm btn-light" title="Butiran"><i class="bi bi-eye"></i></a>' +
                            (b.can_modify ? ' <a href="#/book?id=' + b.id + '" class="btn btn-sm btn-light" title="Pinda"><i class="bi bi-pencil"></i></a> <button class="btn btn-sm btn-light text-danger" data-cancel="' + b.id + '" data-label="' + esc(b.room_name + ' pada ' + A.fmtDate(b.date, false, true)) + '" title="Batal"><i class="bi bi-x-lg"></i></button>' : '') +
                            '</td></tr>';
                    }).join('') + '</tbody></table></div><div class="card-footer small text-body-secondary">' + d.rows.length + ' rekod</div>'
                    : A.empty('inbox', 'Tiada tempahan dalam senarai ini.', '<a href="#/book" class="btn btn-primary btn-sm">Buat tempahan</a>')) + '</div>';
            $('#mbSearch').onsubmit = function (e) { e.preventDefault(); A.go('my-bookings', { tab: tab, q: this.q.value }); };
            $$('[data-cancel]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.confirm('Batalkan tempahan ' + btn.dataset.label + '?').then(function (ok) {
                        if (!ok) return;
                        A.api('booking.setStatus', { id: +btn.dataset.cancel, status: 'cancelled' }).then(function (r) {
                            if (r.errors.length) A.toast(r.errors.join(' '), 'danger'); else A.toast('Tempahan dibatalkan.');
                            A.reload();
                        }).catch(A.showError);
                    });
                };
            });
        });
    } });

    /* ==================================================================
     * Booking detail
     * ================================================================== */
    A.route('booking', { title: 'Butiran Tempahan', nav: 'my-bookings', render: function (ctx) {
        return A.api('booking.get', { id: ctx.params.id }).then(function (b) {
            if (!ctx.alive()) return;
            var admin = S.user.role === 'admin';
            var h = '<div class="page-head no-print"><div><a href="javascript:history.back()" class="small"><i class="bi bi-arrow-left me-1"></i>Kembali</a><h1 class="page-title mt-1">Butiran Tempahan</h1></div>' +
                '<div class="page-actions"><button class="btn btn-light" id="icsBtn"><i class="bi bi-calendar-plus me-1"></i>Tambah ke kalendar</button><button onclick="window.print()" class="btn btn-light"><i class="bi bi-printer me-1"></i>Cetak slip</button></div></div>';
            if (ctx.params.new) {
                h += '<div class="success-banner mb-4 no-print"><div class="success-icon"><i class="bi bi-check-lg"></i></div><div><h2 class="h5 fw-bold mb-1">' + (b.status === 'pending' ? 'Permohonan tempahan dihantar!' : 'Tempahan berjaya disahkan!') + '</h2>' +
                    '<p class="mb-0 text-body-secondary">No. rujukan anda ialah <strong>' + esc(b.ref_no) + '</strong>. ' + (b.status === 'pending' ? 'Anda akan dimaklumkan selepas pentadbir membuat keputusan.' : 'Bilik telah dikhaskan untuk anda.') + '</p></div></div>';
            }
            var field = function (label, value, sub, cls) {
                return '<div class="' + (cls || 'col-sm-6') + '"><div class="detail-label">' + label + '</div><div class="detail-value">' + value + '</div>' + (sub ? '<div class="small text-body-secondary">' + sub + '</div>' : '') + '</div>';
            };
            h += '<div class="row g-4"><div class="col-lg-8"><div class="card booking-slip"><div class="slip-head" style="--c:' + esc(b.room_color) + '"><div><div class="small opacity-75">No. Rujukan</div><div class="fs-4 fw-bold font-monospace">' + esc(b.ref_no) + '</div></div>' +
                '<div class="text-end">' + A.statusBadge(b.status) + '<div class="small opacity-75 mt-1 print-only">' + esc(S.settings.school_name) + '</div></div></div><div class="card-body p-4"><div class="row g-4 mb-2">' +
                field('Bilik', A.dot(b.room_color) + esc(b.room_name) + ' <span class="text-body-secondary">(' + esc(b.room_code) + ')</span>', '<i class="bi bi-geo-alt me-1"></i>' + esc(b.room_location)) +
                field('Tarikh &amp; Masa', A.fmtDate(b.date, true), '<i class="bi bi-clock me-1"></i>' + b.start_time + ' – ' + b.end_time + ' (' + A.duration(b.start_time, b.end_time) + ')') +
                field('Tujuan / Aktiviti', esc(b.purpose)) + field('Kelas', esc(b.class_name || '-'), '', 'col-sm-3 col-6') + field('Subjek', esc(b.subject || '-'), '', 'col-sm-3 col-6') +
                field('Ditempah oleh', esc(b.user_name), esc([b.user_department, b.user_phone].filter(Boolean).join(' · '))) +
                field('Bil. peserta', b.attendees ? b.attendees + ' orang' : '-', '', 'col-sm-3 col-6') + field('Dibuat pada', '<span class="small">' + A.fmtDateTime(b.created_at) + '</span>', '', 'col-sm-3 col-6') +
                (b.notes ? '<div class="col-12"><div class="detail-label">Catatan</div><div class="detail-value fw-normal" style="white-space:pre-line">' + esc(b.notes) + '</div></div>' : '') +
                (b.admin_remark || b.reviewer_name ? '<div class="col-12"><div class="remark-box"><div class="detail-label mb-1"><i class="bi bi-chat-square-text me-1"></i>Maklum balas pentadbir</div>' + (b.admin_remark ? '<div>' + esc(b.admin_remark) + '</div>' : '') +
                    (b.reviewer_name ? '<div class="xsmall text-body-secondary mt-1">— ' + esc(b.reviewer_name) + ', ' + A.fmtDateTime(b.reviewed_at) + '</div>' : '') + '</div></div>' : '') +
                '</div></div></div>';
            if (b.series.length) {
                h += '<div class="card mt-4 no-print"><div class="card-header"><h2 class="card-title"><i class="bi bi-arrow-repeat me-2"></i>Siri Tempahan Berulang (' + b.series.length + ' minggu)</h2></div><div class="card-body d-flex flex-wrap gap-2">' +
                    b.series.map(function (s) {
                        var st = A.STATUS[s.status];
                        return '<a href="#/booking?id=' + s.id + '" class="series-chip border-' + st[1] + '-subtle' + (s.id === b.id ? ' current' : '') + '" title="' + st[0] + '"><span class="dot bg-' + st[1] + '"></span>' + A.fmtDate(s.date, false, true) + '</a>';
                    }).join('') + '</div></div>';
            }
            h += '</div><div class="col-lg-4 no-print">';
            if (admin && ['pending', 'approved', 'rejected'].indexOf(b.status) !== -1) {
                h += '<div class="card mb-4"><div class="card-header"><h2 class="card-title"><i class="bi bi-shield-check me-2"></i>Tindakan Pentadbir</h2></div><div class="card-body">' +
                    '<label class="form-label small fw-semibold">Catatan kepada pemohon (pilihan)</label><textarea id="remark" class="form-control mb-3" rows="2" placeholder="cth. Sila pastikan bilik dikemas selepas digunakan"></textarea>' +
                    (b.active_series > 1 ? '<select id="scope" class="form-select form-select-sm mb-3"><option value="one">Tempahan ini sahaja</option><option value="series">Semua tempahan aktif dalam siri (' + b.active_series + ')</option></select>' : '') +
                    '<div class="d-grid gap-2">' + (b.status !== 'approved' ? '<button class="btn btn-success" data-status="approved"><i class="bi bi-check-lg me-1"></i>Luluskan</button>' : '') +
                    (b.status !== 'rejected' ? '<button class="btn btn-outline-danger" data-status="rejected"><i class="bi bi-x-lg me-1"></i>Tolak</button>' : '') + '</div></div></div>';
            }
            if (b.can_modify) {
                h += '<div class="card mb-4"><div class="card-header"><h2 class="card-title"><i class="bi bi-gear me-2"></i>Urus Tempahan</h2></div><div class="card-body d-grid gap-2">' +
                    '<a href="#/book?id=' + b.id + '" class="btn btn-light"><i class="bi bi-pencil me-1"></i>Pinda tempahan</a>' +
                    '<button class="btn btn-outline-danger" data-cancel="one"><i class="bi bi-x-circle me-1"></i>Batalkan tempahan ini</button>' +
                    (b.active_series > 1 ? '<button class="btn btn-outline-danger" data-cancel="series"><i class="bi bi-calendar-x me-1"></i>Batalkan seluruh siri (' + b.active_series + ')</button>' : '') + '</div></div>';
            }
            h += '<div class="card"><div class="card-header"><h2 class="card-title"><i class="bi bi-clock-history me-2"></i>Sejarah</h2></div><div class="card-body"><ul class="mini-timeline">' +
                '<li><strong>Dibuat</strong><span>' + A.fmtDateTime(b.created_at) + '</span></li>' + (b.updated_at && b.updated_at !== b.created_at ? '<li><strong>Kemas kini terakhir</strong><span>' + A.fmtDateTime(b.updated_at) + '</span></li>' : '') +
                (b.reviewed_at ? '<li><strong>Disemak oleh ' + esc(b.reviewer_name) + '</strong><span>' + A.fmtDateTime(b.reviewed_at) + '</span></li>' : '') +
                '<li><strong>Status semasa</strong><span>' + A.statusBadge(b.status) + '</span></li></ul></div></div></div></div>';
            ctx.view.innerHTML = h;

            var setStatus = function (status, scope, remark, btn) {
                A.busy(btn, true);
                A.api('booking.setStatus', { id: b.id, status: status, scope: scope, remark: remark }).then(function (r) {
                    var verb = { approved: 'diluluskan', rejected: 'ditolak', cancelled: 'dibatalkan' }[status];
                    if (r.done) A.toast(r.done > 1 ? r.done + ' tempahan telah ' + verb + '.' : 'Tempahan ' + b.ref_no + ' telah ' + verb + '.');
                    if (r.errors.length) A.toast(r.errors.join(' '), 'danger');
                    A.reload();
                }).catch(function (e) { A.busy(btn, false); A.showError(e); });
            };
            $$('[data-status]', ctx.view).forEach(function (btn) {
                btn.onclick = function () { setStatus(btn.dataset.status, ($('#scope') || {}).value || 'one', $('#remark').value.trim(), btn); };
            });
            $$('[data-cancel]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    var series = btn.dataset.cancel === 'series';
                    A.confirm(series ? 'Batalkan SEMUA ' + b.active_series + ' tempahan akan datang dalam siri ini?' : 'Batalkan tempahan ini? Slot akan dibuka semula kepada guru lain.')
                        .then(function (ok) { if (ok) setStatus('cancelled', series ? 'series' : 'one', '', btn); });
                };
            });
            $('#icsBtn').onclick = function () {
                var st = function (t) { return b.date.replace(/-/g, '') + 'T' + t.replace(':', '') + '00'; };
                var e = function (s) { return String(s || '').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n'); };
                var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tempahan Bilik//MS', 'BEGIN:VEVENT', 'UID:' + b.ref_no + '@tempahanbilik',
                    'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART;TZID=Asia/Kuala_Lumpur:' + st(b.start_time), 'DTEND;TZID=Asia/Kuala_Lumpur:' + st(b.end_time),
                    'SUMMARY:' + e(b.room_name + ' – ' + b.purpose), 'LOCATION:' + e(b.room_location), 'DESCRIPTION:' + e('No. rujukan: ' + b.ref_no), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
                var a = document.createElement('a');
                a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
                a.download = 'tempahan-' + b.ref_no + '.ics';
                document.body.appendChild(a); a.click(); a.remove();
            };
        });
    } });

    /* ==================================================================
     * Rooms gallery
     * ================================================================== */
    A.route('rooms', { title: 'Senarai Bilik Khas', render: function (ctx) {
        return A.api('availability', { date: A.todayIso() }).then(function (d) {
            if (!ctx.alive()) return;
            var nowT = A.toTime(A.nowMin());
            var rooms = S.rooms.filter(function (r) { return r.status !== 'inactive'; });
            var cats = rooms.map(function (r) { return r.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
            ctx.view.innerHTML = A.pageTitle('Senarai Bilik Khas', rooms.length + ' bilik khas di ' + esc(S.settings.school_name) + '.') +
                '<div class="d-flex flex-wrap gap-2 mb-4 filter-chips" id="roomFilter"><button class="btn btn-sm btn-primary" data-filter="">Semua</button>' +
                cats.map(function (c) { return '<button class="btn btn-sm btn-light" data-filter="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') +
                '<div class="ms-auto input-icon" style="min-width:220px"><i class="bi bi-search"></i><input class="form-control form-control-sm" id="roomSearch" placeholder="Cari bilik…"></div></div>' +
                '<div class="row g-4" id="roomGrid">' + rooms.map(function (r) {
                    var list = d.bookings.filter(function (b) { return b.room_id === r.id; });
                    var busyNow = list.some(function (b) { return b.start <= nowT && b.end > nowT; });
                    var closed = d.closures[r.id];
                    var badge = r.status !== 'active' || closed ? '<span class="badge text-bg-dark"><i class="bi bi-lock me-1"></i>' + (closed ? 'Ditutup hari ini' : 'Penyelenggaraan') + '</span>'
                        : busyNow ? '<span class="badge text-bg-danger">Sedang digunakan</span>' : '<span class="badge text-bg-success">Kosong sekarang</span>';
                    return '<div class="col-md-6 col-xl-4" data-category="' + esc(r.category) + '" data-search="' + esc([r.name, r.code, r.location, r.facilities].join(' ').toLowerCase()) + '"><div class="room-card h-100">' +
                        '<div class="room-card-banner" style="--c:' + esc(r.color) + '"><span class="room-code">' + esc(r.code) + '</span><i class="bi bi-door-open"></i><span class="room-live">' + badge + '</span></div>' +
                        '<div class="p-4 d-flex flex-column h-100"><div class="d-flex justify-content-between align-items-start gap-2 mb-1"><h3 class="h5 fw-bold mb-0">' + esc(r.name) + '</h3>' +
                        (A.roomNeedsApproval(r) ? '<span class="badge badge-soft-warning" title="Perlu kelulusan pentadbir"><i class="bi bi-shield-lock"></i></span>' : '') + '</div>' +
                        '<div class="small text-body-secondary mb-3">' + esc(r.category) + ' · <i class="bi bi-geo-alt"></i> ' + esc(r.location) + '</div>' +
                        '<div class="d-flex gap-3 small mb-3"><span><i class="bi bi-people me-1 text-primary"></i>' + r.capacity + ' orang</span><span><i class="bi bi-calendar-check me-1 text-primary"></i>' + list.length + ' tempahan hari ini</span></div>' +
                        '<div class="d-flex flex-wrap gap-1 mb-3">' + String(r.facilities || '').split(',').map(function (f) { return f.trim(); }).filter(Boolean).map(function (f) { return '<span class="facility-tag">' + esc(f) + '</span>'; }).join('') + '</div>' +
                        (r.description ? '<p class="small text-body-secondary">' + esc(r.description) + '</p>' : '') + (r.pic_name ? '<div class="xsmall text-body-secondary mb-3"><i class="bi bi-person-badge me-1"></i>Penyelaras: ' + esc(r.pic_name) + '</div>' : '') +
                        '<div class="mt-auto d-flex gap-2">' + (r.status === 'active' ? '<a href="' + A.link('book', { room_id: r.id }) + '" class="btn btn-primary flex-grow-1"><i class="bi bi-plus-lg me-1"></i>Tempah</a>' : '') +
                        '<a href="' + A.link('calendar', { room_id: r.id }) + '" class="btn btn-light flex-grow-1"><i class="bi bi-calendar3 me-1"></i>Jadual</a></div></div></div></div>';
                }).join('') + '</div><div id="roomEmpty" hidden>' + A.empty('search', 'Tiada bilik sepadan dengan carian.') + '</div>';
            var cat = '', term = '';
            var apply = function () {
                var shown = 0;
                $$('#roomGrid > [data-category]').forEach(function (c) {
                    var ok = (!cat || c.dataset.category === cat) && (!term || c.dataset.search.indexOf(term) !== -1);
                    c.hidden = !ok; if (ok) shown++;
                });
                $('#roomEmpty').hidden = shown > 0;
            };
            $$('#roomFilter [data-filter]').forEach(function (b) {
                b.onclick = function () {
                    cat = b.dataset.filter;
                    $$('#roomFilter [data-filter]').forEach(function (x) { x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-light'); });
                    apply();
                };
            });
            $('#roomSearch').oninput = function () { term = this.value.trim().toLowerCase(); apply(); };
        });
    } });

    /* ==================================================================
     * Notifications & profile
     * ================================================================== */
    A.route('notifications', { title: 'Notifikasi', render: function (ctx) {
        return A.api('notifications', { limit: 100 }).then(function (rows) {
            if (!ctx.alive()) return;
            ctx.view.innerHTML = A.pageTitle('Notifikasi', 'Makluman berkaitan tempahan anda.', '<button class="btn btn-light" id="readAll"><i class="bi bi-check2-all me-1"></i>Tanda semua dibaca</button><button class="btn btn-light text-danger" id="clearRead"><i class="bi bi-trash me-1"></i>Padam yang dibaca</button>') +
                '<div class="card">' + (rows.length ? '<div class="list-group list-group-flush">' + rows.map(function (n) {
                    var icon = /Ditolak/.test(n.title) ? 'x-circle text-danger' : /Diluluskan|diaktifkan/.test(n.title) ? 'check-circle text-success' : 'bell text-primary';
                    return '<a href="' + esc(n.link || '#/notifications') + '" class="list-group-item list-group-item-action d-flex gap-3 py-3' + (n.is_read ? '' : ' notif-unread') + '"><div class="notif-icon"><i class="bi bi-' + icon + '"></i></div>' +
                        '<div class="flex-grow-1"><div class="d-flex justify-content-between gap-2"><strong>' + esc(n.title) + '</strong><span class="xsmall text-body-secondary text-nowrap">' + A.timeAgo(n.created_at) + '</span></div><div class="small text-body-secondary">' + esc(n.message) + '</div></div></a>';
                }).join('') + '</div>' : A.empty('bell-slash', 'Tiada notifikasi.')) + '</div>';
            $('#readAll').onclick = function () { A.api('notifications.read', {}).then(function () { A.toast('Semua notifikasi ditanda sebagai dibaca.'); A.reload(); }).catch(A.showError); };
            $('#clearRead').onclick = function () { A.api('notifications.clear', {}).then(function (n) { A.toast(n + ' notifikasi dipadam.'); A.reload(); }).catch(A.showError); };
        });
    } });

    A.route('profile', { title: 'Profil Saya', render: function (ctx) {
        var u = S.user;
        ctx.view.innerHTML = A.pageTitle('Profil Saya', 'Urus maklumat akaun dan kata laluan anda.') +
            '<div class="row g-4"><div class="col-lg-4"><div class="card text-center"><div class="card-body p-4">' +
            '<div class="avatar avatar-xl mx-auto mb-3">' + esc(A.initials(u.name)) + '</div>' +
            '<h2 class="h5 fw-bold mb-0">' + esc(u.name) + '</h2><div class="text-body-secondary small mb-2">' + esc(u.department || '') + '</div><span class="badge badge-soft-primary">' + (u.role === 'admin' ? 'Pentadbir' : 'Guru') + '</span>' +
            '<div class="xsmall text-body-tertiary mt-3">Log masuk terakhir: ' + A.fmtDateTime(u.last_login_at) + '</div></div></div></div>' +
            '<div class="col-lg-8"><div class="card mb-4"><div class="card-header"><h2 class="card-title">Maklumat Peribadi</h2></div><div class="card-body"><form id="profileForm"><div class="row g-3">' +
            '<div class="col-md-6"><label class="form-label fw-semibold">Nama penuh</label><input class="form-control" name="name" value="' + esc(u.name) + '" required></div>' +
            '<div class="col-md-6"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" value="' + esc(u.department) + '"></div>' +
            '<div class="col-md-6"><label class="form-label fw-semibold">E-mel <span class="fw-normal text-body-secondary">(untuk notifikasi)</span></label><input type="email" class="form-control" name="email" value="' + esc(u.email) + '"></div>' +
            '<div class="col-md-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone" value="' + esc(u.phone) + '"></div></div>' +
            '<button class="btn btn-primary mt-3">Simpan</button></form></div></div>' +
            '<div class="card"><div class="card-header"><h2 class="card-title">Tukar Kata Laluan</h2></div><div class="card-body">' +
            '<p class="small text-body-secondary">Secara lalai, kata laluan anda ialah No. Kad Pengenalan. Anda boleh menukarnya kepada kata laluan lain (sekurang-kurangnya 6 aksara).</p>' +
            '<form id="pwForm" autocomplete="off"><div class="row g-3">' +
            '<div class="col-md-4"><label class="form-label fw-semibold">Kata laluan semasa</label><input type="password" class="form-control" name="current" required></div>' +
            '<div class="col-md-4"><label class="form-label fw-semibold">Kata laluan baharu</label><input type="password" class="form-control" name="password" minlength="6" required></div>' +
            '<div class="col-md-4"><label class="form-label fw-semibold">Sahkan kata laluan</label><input type="password" class="form-control" name="confirm" minlength="6" required></div></div>' +
            '<button class="btn btn-primary mt-3">Tukar Kata Laluan</button></form></div></div></div></div>';
        $('#profileForm').onsubmit = function (e) {
            e.preventDefault();
            var btn = $('button', this);
            A.busy(btn, true);
            A.api('profile.update', A.formData(this)).then(function (nu) {
                Object.assign(S.user, nu);
                A.toast('Profil berjaya dikemas kini.');
                A.busy(btn, false);
            }).catch(function (err) { A.busy(btn, false); A.showError(err); });
        };
        $('#pwForm').onsubmit = function (e) {
            e.preventDefault();
            var d = A.formData(this), form = this, btn = $('button', this);
            if (d.password !== d.confirm) { A.toast('Pengesahan kata laluan tidak sepadan.', 'warning'); return; }
            A.busy(btn, true);
            A.api('password.change', d).then(function () {
                A.toast('Kata laluan berjaya ditukar.');
                form.reset();
                A.busy(btn, false);
            }).catch(function (err) { A.busy(btn, false); A.showError(err); });
        };
    } });
})(window.App);
