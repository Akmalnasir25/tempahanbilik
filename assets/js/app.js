/* Sistem Tempahan Bilik Khas — client-side behaviour */
(function () {
    'use strict';

    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var toMin = function (t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
    var toTime = function (m) { return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var isoDate = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    var MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
    var fmtDate = function (iso, withDay) {
        var d = new Date(iso + 'T00:00:00');
        if (isNaN(d)) return '';
        return (withDay ? DAYS[d.getDay()] + ', ' : '') + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    };
    var debounce = function (fn, ms) {
        var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
    };
    var api = function (params) {
        params = Object.assign({ s: document.body.dataset.school || '' }, params);
        return fetch('api.php?' + new URLSearchParams(params).toString(), { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
            .then(function (r) {
                if (r.status === 401) { window.location.reload(); }
                return r.json();
            });
    };

    var TB = window.TB = {};

    /* ---------- Theme ---------- */
    function applyThemeIcon() {
        var btn = $('#themeToggle');
        if (!btn) return;
        var dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        btn.innerHTML = '<i class="bi bi-' + (dark ? 'sun' : 'moon-stars') + '"></i>';
    }

    document.addEventListener('DOMContentLoaded', function () {
        applyThemeIcon();
        var tt = $('#themeToggle');
        if (tt) tt.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('tb-theme', next); } catch (e) { /* storage unavailable */ }
            applyThemeIcon();
            document.dispatchEvent(new CustomEvent('tb:theme'));
        });

        /* Mobile sidebar */
        $$('[data-toggle-sidebar]').forEach(function (el) {
            el.addEventListener('click', function () { document.body.classList.toggle('sidebar-open'); });
        });

        /* Password reveal */
        $$('[data-reveal]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var input = $(btn.getAttribute('data-reveal'));
                var show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                btn.innerHTML = '<i class="bi bi-eye' + (show ? '-slash' : '') + '"></i>';
            });
        });

        /* Tooltips */
        if (window.bootstrap) {
            $$('[data-bs-toggle="tooltip"]').forEach(function (el) { new bootstrap.Tooltip(el, { container: 'body' }); });
        }

        /* Confirm dialogs for destructive forms */
        var modalEl = $('#confirmModal');
        var pendingForm = null;
        document.addEventListener('submit', function (ev) {
            var form = ev.target;
            if (!form.matches || !form.matches('form[data-confirm]') || form.dataset.confirmed === '1') return;
            ev.preventDefault();
            if (!modalEl || !window.bootstrap) {
                if (window.confirm(form.getAttribute('data-confirm'))) { form.dataset.confirmed = '1'; form.submit(); }
                return;
            }
            pendingForm = form;
            $('[data-confirm-text]', modalEl).textContent = form.getAttribute('data-confirm');
            bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }, true);
        if (modalEl) {
            $('[data-confirm-ok]', modalEl).addEventListener('click', function () {
                if (pendingForm) { pendingForm.dataset.confirmed = '1'; pendingForm.submit(); }
            });
        }

        /* Mark notifications read when bell dropdown opens */
        var bell = $('#notifBtn');
        if (bell) bell.addEventListener('shown.bs.dropdown', function () {
            var dot = $('.notif-dot', bell);
            if (!dot) return;
            fetch('api.php?action=notifications-read&s=' + encodeURIComponent(document.body.dataset.school || ''), {
                method: 'POST', credentials: 'same-origin',
                headers: { 'X-CSRF-Token': document.body.dataset.csrf, Accept: 'application/json' }
            }).then(function () { dot.remove(); });
        });
    });

    /* ---------- Charts ---------- */
    function chartDefaults() {
        if (!window.Chart) return false;
        var dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
        Chart.defaults.color = dark ? '#94a3b8' : '#64748b';
        Chart.defaults.borderColor = dark ? 'rgba(148,163,184,.12)' : 'rgba(15,23,42,.06)';
        Chart.defaults.plugins.legend.display = false;
        Chart.defaults.maintainAspectRatio = false;
        return true;
    }
    function sizeCanvas(id) {
        var c = document.getElementById(id);
        if (!c) return null;
        c.parentNode.style.position = 'relative';
        c.parentNode.style.height = (c.getAttribute('height') || 240) + 'px';
        return c;
    }
    TB.charts = {
        line: function (id, labels, data, label) {
            var c = sizeCanvas(id); if (!c || !chartDefaults()) return;
            var ctx = c.getContext('2d');
            var g = ctx.createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, 'rgba(59,130,246,.35)'); g.addColorStop(1, 'rgba(59,130,246,0)');
            new Chart(c, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: label, data: data, borderColor: '#3b82f6', backgroundColor: g, fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
            });
        },
        bar: function (id, labels, data, colors, titles) {
            var c = sizeCanvas(id); if (!c || !chartDefaults()) return;
            new Chart(c, {
                type: 'bar',
                data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || '#3b82f6', borderRadius: 6, maxBarThickness: 36 }] },
                options: {
                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
                    plugins: { tooltip: { callbacks: { title: function (items) { return titles ? titles[items[0].dataIndex] : items[0].label; } } } }
                }
            });
        },
        doughnut: function (id, labels, data, colors) {
            var c = sizeCanvas(id); if (!c || !chartDefaults()) return;
            new Chart(c, {
                type: 'doughnut',
                data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
                options: { cutout: '68%', plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } }
            });
        }
    };

    /* ---------- Booking form ---------- */
    TB.bookingForm = function (cfg) {
        var form = $('#bookingForm');
        var room = $('#room_id'), date = $('#date'), start = $('#start_time'), end = $('#end_time');
        var chips = $$('.period-chip');
        var repeat = $('#repeat'), repeatWeeks = $('#repeat_weeks');
        var result = $('#checkResult'), submit = $('#submitBtn');
        var exclude = form.dataset.exclude || '';
        var rooms = {}; cfg.rooms.forEach(function (r) { rooms[r.id] = r; });
        var dayBookings = [], dayClosed = null, dayOpen = '07:00', dayClose = '18:00';
        var anchor = null;

        function roomInfo() {
            var r = rooms[room.value];
            $('#roomInfo').hidden = !r;
            if (!r) return;
            $('#roomBanner').style.setProperty('--c', r.color);
            $('#riName').textContent = r.name;
            $('#riLocation').innerHTML = '<i class="bi bi-geo-alt me-1"></i>' + esc(r.location || '-') + ' · ' + esc(r.code);
            $('#riCapacity').textContent = r.capacity;
            $('#riPic').innerHTML = r.pic ? '<i class="bi bi-person-badge me-1"></i>' + esc(r.pic) : '';
            $('#riFacilities').innerHTML = (r.facilities || '').split(',').map(function (f) { return f.trim(); }).filter(Boolean)
                .map(function (f) { return '<span class="facility-tag">' + esc(f) + '</span>'; }).join('');
            $('#riApproval').hidden = !r.approval;
            capacityHint();
        }
        function capacityHint() {
            var r = rooms[room.value], n = +$('#attendees').value, hint = $('#capacityHint');
            if (!r || !n) { hint.textContent = ''; hint.className = 'form-text'; return; }
            var over = r.capacity > 0 && n > r.capacity;
            hint.textContent = over ? 'Melebihi kapasiti (' + r.capacity + ')' : 'Kapasiti: ' + r.capacity;
            hint.className = 'form-text ' + (over ? 'text-danger fw-semibold' : '');
        }

        function isToday() { return date.value === isoDate(new Date()); }
        function nowMin() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

        function paintChips() {
            var s = start.value, e = end.value;
            chips.forEach(function (c) {
                var cs = c.dataset.start, ce = c.dataset.end;
                var busy = dayClosed || dayBookings.some(function (b) { return b.start < ce && b.end > cs; });
                var past = !date.value || date.value < isoDate(new Date()) || (isToday() && toMin(ce) <= nowMin());
                c.classList.toggle('busy', !!busy);
                c.classList.toggle('past', past);
                c.classList.toggle('selected', !!(s && e && cs >= s && ce <= e));
                c.classList.toggle('anchor', c === anchor);
                c.title = busy ? 'Telah ditempah' : '';
            });
        }

        function paintDuration() {
            var box = $('#durationBox span');
            if (start.value && end.value && end.value > start.value) {
                var m = toMin(end.value) - toMin(start.value);
                box.textContent = (Math.floor(m / 60) ? Math.floor(m / 60) + ' jam ' : '') + (m % 60 ? (m % 60) + ' minit' : '');
            } else {
                box.textContent = '—';
            }
        }

        function paintTimeline() {
            var el = $('#dayTimeline');
            $('#dayTitle').textContent = date.value ? fmtDate(date.value, true) : '';
            if (!room.value || !date.value) {
                el.innerHTML = '<div class="empty-state py-4"><i class="bi bi-door-closed"></i><p>Pilih bilik dan tarikh untuk melihat jadual.</p></div>';
                return;
            }
            if (dayClosed) {
                el.innerHTML = '<div class="dt-closed"><i class="bi bi-lock fs-4 d-block mb-1"></i>Bilik ditutup pada tarikh ini:<br><strong>' + esc(dayClosed) + '</strong></div>';
                return;
            }
            var from = Math.floor(toMin(dayOpen) / 60) * 60, to = Math.ceil(toMin(dayClose) / 60) * 60;
            var PX = 42; // px per hour
            var html = '<div class="dt-grid" style="height:' + ((to - from) / 60 * PX) + 'px">';
            for (var m = from; m < to; m += 60) {
                html += '<div class="dt-hour" style="height:' + PX + 'px"><span>' + toTime(m) + '</span></div>';
            }
            var y = function (t) { return (toMin(t) - from) / 60 * PX; };
            dayBookings.forEach(function (b) {
                html += '<div class="dt-block ' + (b.status === 'pending' ? 'pending' : '') + '" style="top:' + y(b.start) + 'px;height:' + Math.max(16, y(b.end) - y(b.start)) + 'px" title="' +
                    esc(b.purpose + ' — ' + b.user) + '"><strong>' + esc(b.start) + '–' + esc(b.end) + '</strong> ' + esc(b.purpose) + ' <span class="opacity-75">· ' + esc(b.user) + '</span></div>';
            });
            if (start.value && end.value && end.value > start.value) {
                var clash = dayBookings.some(function (b) { return b.start < end.value && b.end > start.value; });
                html += '<div class="dt-block mine-sel' + (clash ? ' clash' : '') + '" style="top:' + y(start.value) + 'px;height:' + Math.max(16, y(end.value) - y(start.value)) + 'px"><strong>' +
                    (clash ? 'Bertembung!' : 'Pilihan anda') + '</strong> ' + esc(start.value) + '–' + esc(end.value) + '</div>';
            }
            if (isToday() && nowMin() >= from && nowMin() <= to) {
                html += '<div class="dt-now" style="top:' + ((nowMin() - from) / 60 * PX) + 'px"></div>';
            }
            el.innerHTML = html + '</div>';
        }

        function loadDay() {
            $('#dateLabel').textContent = date.value ? fmtDate(date.value, true) : '';
            if (!room.value || !date.value) { dayBookings = []; dayClosed = null; paintAll(); return; }
            api({ action: 'availability', date: date.value, room_id: room.value, exclude: exclude }).then(function (res) {
                if (res.error) return;
                dayBookings = res.bookings || [];
                dayClosed = (res.closures || {})[room.value] || null;
                dayOpen = res.open || dayOpen; dayClose = res.close || dayClose;
                paintAll();
            });
            check();
        }

        var seq = 0;
        var check = debounce(function () {
            if (!room.value || !date.value || !start.value || !end.value) { result.hidden = true; submit.disabled = false; return; }
            var weeks = repeat && repeat.checked ? repeatWeeks.value : 1;
            var my = ++seq;
            result.hidden = false;
            result.className = 'check-result mt-3 loading';
            result.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Menyemak kekosongan…';
            api({ action: 'check', room_id: room.value, date: date.value, start: start.value, end: end.value, repeat_weeks: weeks, exclude: exclude })
                .then(function (res) {
                    if (my !== seq) return;
                    if (res.ok) {
                        result.className = 'check-result mt-3 ok';
                        result.innerHTML = '<i class="bi bi-check-circle-fill fs-5"></i><div><strong>Slot tersedia!</strong> ' +
                            (weeks > 1 ? 'Kesemua ' + weeks + ' minggu kosong. ' : '') +
                            (res.approval ? 'Tempahan akan menunggu kelulusan pentadbir.' : 'Tempahan akan disahkan serta-merta.') + '</div>';
                        submit.disabled = false;
                    } else {
                        result.className = 'check-result mt-3 bad';
                        result.innerHTML = '<i class="bi bi-x-octagon-fill fs-5"></i><div><strong>Tidak boleh ditempah:</strong><ul>' +
                            (res.errors || []).slice(0, 8).map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
                        submit.disabled = true;
                    }
                })
                .catch(function () { result.hidden = true; submit.disabled = false; });
        }, 250);

        function paintAll() { paintChips(); paintDuration(); paintTimeline(); }

        chips.forEach(function (c, idx) {
            c.addEventListener('click', function () {
                if (c.classList.contains('past')) return;
                if (anchor && anchor !== c) {
                    var a = chips.indexOf(anchor);
                    var lo = Math.min(a, idx), hi = Math.max(a, idx);
                    start.value = chips[lo].dataset.start;
                    end.value = chips[hi].dataset.end;
                    anchor = null;
                } else {
                    start.value = c.dataset.start;
                    end.value = c.dataset.end;
                    anchor = c;
                }
                paintAll(); check();
            });
        });

        [start, end].forEach(function (i) { i.addEventListener('change', function () { anchor = null; paintAll(); check(); }); });
        room.addEventListener('change', function () { roomInfo(); loadDay(); });
        date.addEventListener('change', loadDay);
        $('#attendees').addEventListener('input', capacityHint);

        if (repeat) {
            var box = repeat.closest('.repeat-box');
            var summary = function () {
                box.classList.toggle('on', repeat.checked);
                var n = +repeatWeeks.value || 0;
                if (repeat.checked && date.value && n > 1) {
                    var last = new Date(date.value + 'T00:00:00'); last.setDate(last.getDate() + (n - 1) * 7);
                    $('#repeatSummary').textContent = 'Setiap ' + DAYS[new Date(date.value + 'T00:00:00').getDay()] + ', ' + n + ' kali — hingga ' + fmtDate(isoDate(last));
                } else {
                    $('#repeatSummary').textContent = '';
                }
            };
            repeat.addEventListener('change', function () { summary(); check(); });
            repeatWeeks.addEventListener('input', function () {
                if (+repeatWeeks.value > cfg.maxWeeks) repeatWeeks.value = cfg.maxWeeks;
                summary(); check();
            });
            date.addEventListener('change', summary);
            summary();
        }

        form.addEventListener('submit', function () { submit.disabled = true; submit.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Menghantar…'; });

        roomInfo();
        loadDay();
        paintAll();
    };

    /* ---------- Calendar ---------- */
    TB.calendar = function (cfg) {
        var el = $('#calendar');
        if (!el || !window.FullCalendar) return;
        var roomSel = $('#calRoom'), mine = $('#calMine');
        var modal = $('#eventModal');
        var today = cfg.today;

        var cal = new FullCalendar.Calendar(el, {
            locale: 'ms',
            initialView: window.innerWidth < 768 && cfg.view === 'timeGridWeek' ? 'listWeek' : cfg.view,
            initialDate: cfg.date || undefined,
            firstDay: 1,
            height: 'auto',
            weekends: cfg.weekends,
            nowIndicator: true,
            slotMinTime: cfg.slotMin,
            slotMaxTime: cfg.slotMax,
            slotDuration: '00:30:00',
            allDaySlot: true,
            allDayText: 'Hari',
            dayMaxEvents: 4,
            selectable: true,
            selectMirror: true,
            eventDisplay: 'block',
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' },
            buttonText: { today: 'Hari ini', month: 'Bulan', week: 'Minggu', day: 'Hari', list: 'Senarai' },
            noEventsContent: 'Tiada tempahan dalam tempoh ini',
            moreLinkContent: function (arg) { return '+' + arg.num + ' lagi'; },
            slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            views: {
                timeGridWeek: { dayHeaderFormat: { weekday: 'short', day: 'numeric' } },
                timeGridDay: { dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' } }
            },
            events: function (info, success, failure) {
                api({ action: 'events', start: info.startStr.slice(0, 10), end: info.endStr.slice(0, 10), room_id: roomSel.value, mine: mine.checked ? 1 : 0 })
                    .then(success).catch(failure);
            },
            eventDidMount: function (arg) {
                var p = arg.event.extendedProps;
                if (p.closure) return;
                arg.el.title = p.room + '\n' + p.time + ' · ' + p.user + '\n' + p.purpose + (p.status === 'pending' ? '\n(Menunggu kelulusan)' : '');
            },
            eventClick: function (arg) {
                var p = arg.event.extendedProps;
                if (p.closure) return;
                arg.jsEvent.preventDefault();
                var set = function (k, v) { $('[data-ev="' + k + '"]', modal).textContent = v || '-'; };
                set('ref', p.ref); set('purpose', p.purpose); set('room', p.room); set('time', p.time); set('user', p.user);
                set('date', fmtDate(arg.event.startStr.slice(0, 10), true));
                set('class', [p['class'], p.subject].filter(Boolean).join(' · '));
                $('[data-ev="status"]', modal).innerHTML = '<span class="badge badge-soft-' + ({ approved: 'success', pending: 'warning' }[p.status] || 'secondary') + '">' + esc(p.statusLabel) + '</span>';
                $('[data-ev="url"]', modal).href = p.url;
                bootstrap.Modal.getOrCreateInstance(modal).show();
            },
            selectAllow: function (info) { return info.startStr.slice(0, 10) >= today; },
            select: function (info) {
                var params = new URLSearchParams({ s: document.body.dataset.school || '', p: 'book', date: info.startStr.slice(0, 10) });
                if (roomSel.value) params.set('room_id', roomSel.value);
                if (!info.allDay) {
                    params.set('start', info.startStr.slice(11, 16));
                    params.set('end', info.endStr.slice(11, 16));
                }
                window.location.href = 'index.php?' + params.toString();
            }
        });
        cal.render();

        var sync = function () {
            var u = new URL(window.location.href);
            roomSel.value ? u.searchParams.set('room_id', roomSel.value) : u.searchParams.delete('room_id');
            history.replaceState(null, '', u);
            cal.refetchEvents();
        };
        roomSel.addEventListener('change', sync);
        mine.addEventListener('change', sync);
    };

    /* ---------- Rooms filter ---------- */
    TB.roomFilter = function () {
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
            b.addEventListener('click', function () {
                cat = b.dataset.filter;
                $$('#roomFilter [data-filter]').forEach(function (x) { x.className = 'btn btn-sm ' + (x === b ? 'btn-primary' : 'btn-light'); });
                apply();
            });
        });
        $('#roomSearch').addEventListener('input', function (e) { term = e.target.value.trim().toLowerCase(); apply(); });
    };

    /* ---------- School logo upload (admin settings) ---------- */
    // Shrinks the image in the browser so even large phone photos upload quickly.
    function resizeLogo(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onerror = function () { reject(new Error('Fail tidak dapat dibaca.')); };
            reader.onload = function () {
                var img = new Image();
                img.onerror = function () { reject(new Error('Imej tidak sah atau tidak disokong.')); };
                img.onload = function () {
                    var encode = function (max) {
                        var w = img.naturalWidth || max, h = img.naturalHeight || max;
                        var scale = Math.min(1, max / Math.max(w, h));
                        var c = document.createElement('canvas');
                        c.width = Math.max(1, Math.round(w * scale));
                        c.height = Math.max(1, Math.round(h * scale));
                        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                        var png = c.toDataURL('image/png');
                        if (png.length <= 150000) return png;
                        var webp = c.toDataURL('image/webp', 0.9);
                        return /^data:image\/webp/.test(webp) && webp.length < png.length ? webp : png;
                    };
                    var sizes = [256, 192, 128, 96];
                    for (var i = 0; i < sizes.length; i++) {
                        var out = encode(sizes[i]);
                        if (out.length <= 350000) return resolve(out);
                    }
                    reject(new Error('Imej terlalu kompleks. Cuba logo yang lebih ringkas.'));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    TB.logoUpload = function () {
        var form = $('#logoForm'), file = $('#logoFile'), btn = $('#logoPick');
        if (!form) return;
        btn.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
            var f = file.files[0];
            if (!f) return;
            if (!/^image\//.test(f.type)) { alert('Sila pilih fail imej.'); return; }
            if (f.size > 5 * 1024 * 1024) { alert('Fail terlalu besar (maksimum 5 MB).'); return; }
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Memuat naik…';
            resizeLogo(f).then(function (dataUrl) {
                $('#logoData').value = dataUrl;
                $('#logoPreview').innerHTML = '<span class="brand-logo has-img xl"><img src="' + dataUrl + '" alt=""></span>';
                file.value = ''; // send the shrunk copy only
                form.submit();
            }, function (err) {
                // Let the server try (it can resize with GD) if the browser could not.
                if (f.type === 'image/svg+xml') {
                    btn.disabled = false;
                    btn.textContent = 'Muat naik logo';
                    alert(err.message);
                    return;
                }
                form.submit();
            });
        });
    };

    /* ---------- Bulk select (admin bookings) ---------- */
    TB.bulkSelect = function () {
        var all = $('#checkAll'), count = $('#selCount');
        var boxes = $$('.row-check');
        var update = function () {
            var n = boxes.filter(function (b) { return b.checked; }).length;
            count.textContent = n;
            $$('[data-bulk]').forEach(function (b) { b.disabled = n === 0; });
        };
        if (all) all.addEventListener('change', function () { boxes.forEach(function (b) { b.checked = all.checked; }); update(); });
        boxes.forEach(function (b) { b.addEventListener('change', update); });
        update();
    };
})();
