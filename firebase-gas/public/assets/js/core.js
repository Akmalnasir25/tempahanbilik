/* Sistem Tempahan Bilik Khas — SPA core: auth, API, router, layout, helpers */
window.App = (function () {
    'use strict';

    var S = { user: null, settings: {}, rooms: [], periods: [], meta: {}, fbUser: null, today: '', routes: {}, routeSeq: 0 };

    /* ------------------------------------------------------------------
     * Generic helpers
     * ------------------------------------------------------------------ */
    var $ = function (sel, root) { return (root || document).querySelector(sel); };
    var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
    var esc = function (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    };
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var toMin = function (t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); };
    var toTime = function (m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
    var isoDate = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var todayIso = function () { return isoDate(new Date()); };
    var nowMin = function () { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
    var addDays = function (iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
    var DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
    var MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
    var MONTHS_SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
    var fmtDate = function (iso, withDay, short) {
        if (!iso) return '-';
        var d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
        if (isNaN(d)) return esc(iso);
        return (withDay ? DAYS[d.getDay()] + ', ' : '') + d.getDate() + ' ' + (short ? MONTHS_SHORT : MONTHS)[d.getMonth()] + ' ' + d.getFullYear();
    };
    var fmtDateTime = function (s) { return s ? fmtDate(s, false, true) + ', ' + String(s).slice(11, 16) : '-'; };
    var dayName = function (iso) { return DAYS[new Date(iso + 'T00:00:00').getDay()]; };
    var duration = function (a, b) {
        var m = toMin(b) - toMin(a), h = Math.floor(m / 60);
        return ((h ? h + ' jam ' : '') + (m % 60 ? (m % 60) + ' minit' : '')).trim();
    };
    var timeAgo = function (s) {
        var diff = (Date.now() - new Date(String(s).replace(' ', 'T')).getTime()) / 1000;
        if (diff < 60) return 'baru sahaja';
        if (diff < 3600) return Math.floor(diff / 60) + ' minit lalu';
        if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
        if (diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
        return fmtDate(s, false, true);
    };
    var initials = function (name) {
        var n = String(name || '').replace(/^(cikgu|puan|pn\.?|en\.?|encik|tuan|dr\.?|hj\.?|hjh\.?)\s+/i, '').trim();
        return n.split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0).toUpperCase(); }).join('') || '?';
    };
    var debounce = function (fn, ms) {
        var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
    };

    var STATUS = {
        pending: ['Menunggu', 'warning', 'hourglass-split'],
        approved: ['Diluluskan', 'success', 'check-circle-fill'],
        rejected: ['Ditolak', 'danger', 'x-circle-fill'],
        cancelled: ['Dibatalkan', 'secondary', 'slash-circle'],
    };
    var ROOM_STATUS = { active: ['Aktif', 'success'], maintenance: ['Penyelenggaraan', 'warning'], inactive: ['Tidak Aktif', 'secondary'] };
    var APPROVAL_MODES = {
        auto: ['Lulus automatik', 'Tempahan terus diluluskan jika tiada pertindihan.', 'lightning-charge'],
        manual: ['Semua perlu kelulusan', 'Setiap tempahan guru menunggu kelulusan pentadbir.', 'person-check'],
        room: ['Ikut tetapan bilik', 'Hanya bilik yang ditanda "Perlu kelulusan" memerlukan kelulusan pentadbir.', 'door-open'],
    };
    var statusBadge = function (s) {
        var x = STATUS[s] || [s, 'secondary', 'circle'];
        return '<span class="badge badge-soft-' + x[1] + '"><i class="bi bi-' + x[2] + ' me-1"></i>' + esc(x[0]) + '</span>';
    };
    var roomStatusBadge = function (s) {
        var x = ROOM_STATUS[s] || [s, 'secondary'];
        return '<span class="badge badge-soft-' + x[1] + '">' + esc(x[0]) + '</span>';
    };
    var roomNeedsApproval = function (room) {
        var mode = S.settings.approval_mode || 'auto';
        return mode === 'manual' || (mode === 'room' && !!Number(room.requires_approval));
    };
    var room = function (id) { return S.rooms.filter(function (r) { return r.id === Number(id); })[0] || null; };
    var dot = function (color) { return '<span class="room-dot" style="--c:' + esc(color) + '"></span>'; };
    var empty = function (icon, text, extra) {
        return '<div class="empty-state py-5"><i class="bi bi-' + icon + '"></i><p>' + esc(text) + '</p>' + (extra || '') + '</div>';
    };
    var pageTitle = function (title, subtitle, actions) {
        return '<div class="page-head"><div><h1 class="page-title">' + esc(title) + '</h1>' + (subtitle ? '<p class="page-subtitle">' + subtitle + '</p>' : '') +
            '</div>' + (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
    };
    var link = function (page, params) {
        var q = params ? Object.keys(params).filter(function (k) { return params[k] !== '' && params[k] != null; })
            .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&') : '';
        return '#/' + page + (q ? '?' + q : '');
    };
    var go = function (page, params) { location.hash = link(page, params); };
    var formData = function (form) {
        var o = {};
        $$('input, select, textarea', form).forEach(function (el) {
            if (!el.name) return;
            if (el.type === 'checkbox') o[el.name] = el.checked;
            else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
            else o[el.name] = el.value.trim();
        });
        return o;
    };
    var busy = function (btn, on) {
        if (!btn) return;
        if (on) { btn.dataset.html = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Memproses…'; }
        else { btn.disabled = false; if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
    };
    var csvDownload = function (filename, header, rows) {
        var cell = function (v) {
            v = v == null ? '' : String(v);
            if (/^[=+\-@]/.test(v)) v = "'" + v;
            return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        var csv = '﻿' + [header].concat(rows).map(function (r) { return r.map(cell).join(','); }).join('\r\n');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
    };
    var pager = function (page, pages, onGo) {
        if (pages <= 1) return '';
        var nums = [1, page - 2, page - 1, page, page + 1, page + 2, pages].filter(function (n, i, a) { return n >= 1 && n <= pages && a.indexOf(n) === i; }).sort(function (a, b) { return a - b; });
        var html = '<nav><ul class="pagination pagination-sm mb-0">', prev = 0;
        nums.forEach(function (n) {
            if (prev && n > prev + 1) html += '<li class="page-item disabled"><span class="page-link">…</span></li>';
            html += '<li class="page-item' + (n === page ? ' active' : '') + '"><a class="page-link" href="#" data-page="' + n + '">' + n + '</a></li>';
            prev = n;
        });
        setTimeout(function () {
            $$('[data-page]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); onGo(+a.dataset.page); }; });
        });
        return html + '</ul></nav>';
    };

    /* ------------------------------------------------------------------
     * Toasts & dialogs
     * ------------------------------------------------------------------ */
    function toast(msg, type) {
        var el = document.createElement('div');
        type = type || 'success';
        var icon = { success: 'check-circle-fill text-success', danger: 'exclamation-octagon-fill text-danger', warning: 'exclamation-triangle-fill text-warning', info: 'info-circle-fill text-primary' }[type];
        el.className = 'tb-toast ' + type;
        el.innerHTML = '<i class="bi bi-' + icon + ' mt-1"></i><div>' + esc(msg) + '</div>';
        $('#toasts').appendChild(el);
        setTimeout(function () { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(function () { el.remove(); }, 300); }, type === 'danger' ? 7000 : 4000);
    }

    function confirmBox(text, opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            var m = $('#confirmModal');
            $('[data-confirm-text]', m).textContent = text;
            var input = $('[data-confirm-input]', m);
            input.hidden = !opts.input;
            input.value = '';
            var ok = $('[data-confirm-ok]', m);
            ok.className = 'btn px-4 ' + (opts.btnClass || 'btn-danger');
            ok.textContent = opts.okText || 'Ya, teruskan';
            var modal = bootstrap.Modal.getOrCreateInstance(m);
            var answered = false;
            ok.onclick = function () { answered = true; modal.hide(); resolve(opts.input ? { remark: input.value.trim() } : true); };
            m.addEventListener('hidden.bs.modal', function h() { m.removeEventListener('hidden.bs.modal', h); if (!answered) resolve(false); });
            modal.show();
        });
    }

    function showError(err) {
        var list = err && err.info && err.info.errors;
        toast(list && list.length ? list.join(' ') : (err && err.message) || 'Ralat tidak diketahui.', 'danger');
    }

    /* ------------------------------------------------------------------
     * API client (Google Apps Script web app)
     * ------------------------------------------------------------------ */
    function api(action, data, opts) {
        opts = opts || {};
        var tokenP = opts.public || !S.fbUser ? Promise.resolve('') : S.fbUser.getIdToken(!!opts.forceToken);
        return tokenP.then(function (token) {
            return fetch(window.APP_CONFIG.gasUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: action, data: data || {}, token: token || undefined }),
                redirect: 'follow',
            });
        }).then(function (r) {
            if (!r.ok) throw new Error('Pelayan tidak dapat dihubungi (' + r.status + ').');
            return r.json();
        }, function () {
            throw new Error('Tidak dapat menghubungi pelayan. Semak sambungan Internet anda.');
        }).then(function (j) {
            if (!j.ok && j.code === 'AUTH' && !opts.forceToken && S.fbUser) {
                return api(action, data, Object.assign({}, opts, { forceToken: true }));
            }
            if (j.meta) setMeta(j.meta);
            if (!j.ok) {
                var e = new Error(j.error || 'Ralat');
                e.code = j.code; e.info = j.info;
                throw e;
            }
            return j.data;
        });
    }

    /* ------------------------------------------------------------------
     * Auth screens
     * ------------------------------------------------------------------ */
    var GOOGLE_SVG = '<svg viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

    function authLayout(inner) {
        var s = S.settings;
        return '<div class="auth-wrap"><section class="auth-hero"><div class="auth-hero-inner">' +
            '<div class="d-flex align-items-center gap-3 mb-5"><span class="brand-logo lg"><i class="bi bi-buildings"></i></span><div>' +
            '<div class="fw-bold fs-5">' + esc(s.system_name || 'Sistem Tempahan Bilik Khas') + '</div><div class="opacity-75 small">' + esc(s.school_name || '') + '</div></div></div>' +
            '<h1 class="display-6 fw-bold mb-3">Tempah bilik khas sekolah dengan mudah, pantas &amp; tanpa pertembungan.</h1>' +
            '<p class="lead opacity-75 mb-5">Log masuk dengan akaun DELIMa anda. Semak kekosongan secara langsung dan pantau jadual mingguan atau bulanan di satu tempat.</p>' +
            '<div class="row g-3 auth-features">' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-google"></i><div><strong>Log masuk DELIMa</strong><span>Tiada kata laluan baharu untuk diingat</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-lightning-charge"></i><div><strong>Semakan masa nyata</strong><span>Tempahan bertindih disekat secara automatik</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-calendar-week"></i><div><strong>Jadual interaktif</strong><span>Paparan harian, mingguan &amp; bulanan</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-arrow-repeat"></i><div><strong>Tempahan berulang</strong><span>Tempah slot yang sama setiap minggu</span></div></div></div>' +
            '</div></div></section><section class="auth-panel"><div class="auth-card">' +
            '<div class="d-lg-none text-center mb-4"><span class="brand-logo lg mx-auto mb-2"><i class="bi bi-buildings"></i></span><div class="fw-bold">' + esc(s.system_name || '') + '</div></div>' +
            inner + '</div></section></div>';
    }

    function showAuth(html) {
        $('#boot').hidden = true;
        $('#shell').hidden = true;
        var a = $('#auth');
        a.hidden = false;
        a.innerHTML = authLayout(html);
        $$('[data-logout]', a).forEach(function (b) { b.onclick = logout; });
        return a;
    }

    function showLogin(errorMsg) {
        var domain = S.settings.email_domain;
        var a = showAuth(
            '<h2 class="h3 fw-bold mb-1">Selamat datang 👋</h2>' +
            '<p class="text-body-secondary mb-4">Log masuk menggunakan akaun Google ' + (domain ? '<strong>@' + esc(domain) + '</strong> (DELIMa)' : 'anda') + '.</p>' +
            (errorMsg ? '<div class="alert alert-danger py-2 small">' + esc(errorMsg) + '</div>' : '') +
            '<button class="btn-google" id="googleBtn">' + GOOGLE_SVG + '<span>Log masuk dengan Google</span></button>' +
            '<div class="auth-note mt-4"><i class="bi bi-info-circle me-1 text-primary"></i>Hanya guru yang telah didaftarkan oleh pentadbir boleh menggunakan sistem ini.' +
            (S.settings.allow_registration === '1' ? ' Jika belum berdaftar, anda boleh memohon akses selepas log masuk.' : '') + '</div>');
        $('#googleBtn', a).onclick = function () {
            var btn = this;
            busy(btn, true);
            var provider = new firebase.auth.GoogleAuthProvider();
            var params = { prompt: 'select_account' };
            if (domain) params.hd = domain;
            provider.setCustomParameters(params);
            firebase.auth().signInWithPopup(provider).catch(function (err) {
                busy(btn, false);
                if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment')) {
                    return firebase.auth().signInWithRedirect(provider);
                }
                if (err && err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                    toast('Log masuk gagal: ' + (err.message || err.code), 'danger');
                }
            });
        };
    }

    function showMessage(icon, title, text, extra) {
        showAuth('<div class="text-center"><div class="confirm-icon mb-3" style="background:rgba(59,130,246,.1);color:#1d4ed8"><i class="bi bi-' + icon + '"></i></div>' +
            '<h2 class="h4 fw-bold">' + esc(title) + '</h2><p class="text-body-secondary">' + text + '</p>' + (extra || '') +
            '<button class="btn btn-light mt-3" data-logout><i class="bi bi-box-arrow-left me-1"></i>Log masuk dengan akaun lain</button></div>');
    }

    function showRegister(user) {
        if (S.settings.allow_registration !== '1') {
            return showMessage('person-x', 'Akaun belum didaftarkan', 'E-mel <strong>' + esc(user.email) + '</strong> belum didaftarkan dalam sistem. Sila hubungi pentadbir sistem untuk didaftarkan.');
        }
        var a = showAuth('<h2 class="h3 fw-bold mb-1">Mohon akses</h2>' +
            '<p class="text-body-secondary mb-4">E-mel <strong>' + esc(user.email) + '</strong> belum didaftarkan. Isi maklumat di bawah; pentadbir akan mengesahkan akaun anda.</p>' +
            '<form id="regForm"><div class="mb-3"><label class="form-label fw-semibold">Nama penuh <span class="text-danger">*</span></label><input class="form-control" name="name" required value="' + esc(user.name || '') + '"></div>' +
            '<div class="row g-3 mb-4"><div class="col-sm-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone" placeholder="012-3456789"></div>' +
            '<div class="col-sm-6"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" placeholder="cth. Sains"></div></div>' +
            '<button class="btn btn-primary btn-lg w-100 fw-semibold">Hantar permohonan</button></form>' +
            '<button class="btn btn-link w-100 mt-2" data-logout>Guna akaun lain</button>');
        $('#regForm', a).onsubmit = function (e) {
            e.preventDefault();
            var btn = $('button', this);
            busy(btn, true);
            api('requestAccess', formData(this)).then(function () { showPending(user.email); }).catch(function (err) { busy(btn, false); showError(err); });
        };
    }

    function showPending(email) {
        showMessage('hourglass-split', 'Menunggu pengesahan', 'Permohonan untuk <strong>' + esc(email) + '</strong> telah dihantar. Anda boleh log masuk selepas pentadbir mengesahkan akaun anda.',
            '<button class="btn btn-primary mt-2 me-2" onclick="location.reload()"><i class="bi bi-arrow-clockwise me-1"></i>Semak semula</button>');
    }

    function logout() {
        firebase.auth().signOut().then(function () { location.hash = ''; location.reload(); });
    }

    /* ------------------------------------------------------------------
     * Session bootstrap
     * ------------------------------------------------------------------ */
    function startSession() {
        return api('session').then(function (d) {
            S.settings = d.settings || S.settings;
            applySettings();
            if (d.user.status === 'unregistered') return showRegister(d.user);
            if (d.user.status === 'pending') return showPending(d.user.email);
            S.user = d.user;
            S.rooms = d.rooms;
            S.periods = d.periods;
            S.today = d.today;
            showShell();
        }).catch(function (err) {
            if (err.code === 'DOMAIN' || err.code === 'INACTIVE') return showMessage('shield-exclamation', 'Akses ditolak', esc(err.message));
            if (err.code === 'AUTH') return firebase.auth().signOut().then(function () { showLogin(err.message); });
            showMessage('wifi-off', 'Tidak dapat memuatkan sistem', esc(err.message), '<button class="btn btn-primary mt-2 me-2" onclick="location.reload()">Cuba lagi</button>');
        });
    }

    function applySettings() {
        $$('[data-setting]').forEach(function (el) { el.textContent = S.settings[el.dataset.setting] || ''; });
        document.title = S.settings.system_name || 'Tempahan Bilik Khas';
    }

    function refreshSession() {
        return api('session').then(function (d) {
            S.settings = d.settings; S.rooms = d.rooms; S.periods = d.periods; S.user = d.user;
            applySettings();
            renderNav();
        });
    }

    /* ------------------------------------------------------------------
     * Shell (sidebar / topbar)
     * ------------------------------------------------------------------ */
    function navItems() {
        var items = [
            { section: 'Utama' },
            ['dashboard', 'Papan Pemuka', 'grid-1x2'], ['book', 'Tempah Bilik', 'plus-square'], ['availability', 'Semak Kekosongan', 'search'],
            ['calendar', 'Jadual Tempahan', 'calendar3'], ['my-bookings', 'Tempahan Saya', 'journal-bookmark'], ['rooms', 'Senarai Bilik Khas', 'door-open'],
        ];
        if (S.user.role === 'admin') {
            items = items.concat([{ section: 'Pentadbiran' },
                ['admin/bookings', 'Rekod Tempahan', 'clipboard-data'], ['admin/rooms', 'Urus Bilik Khas', 'building-gear'],
                ['admin/users', 'Daftar & Urus Guru', 'people'], ['admin/closures', 'Penutupan & Cuti', 'calendar-x'],
                ['admin/periods', 'Waktu Persekolahan', 'clock'], ['admin/reports', 'Laporan & Analitik', 'bar-chart-line'],
                ['admin/settings', 'Tetapan Sistem', 'gear'], ['admin/audit', 'Log Audit', 'shield-check']]);
        }
        return items;
    }

    function renderNav(active) {
        active = active || S.active;
        var html = '';
        navItems().forEach(function (it) {
            if (it.section) { html += '<div class="nav-section">' + esc(it.section) + '</div>'; return; }
            var badge = '';
            if (it[0] === 'admin/bookings' && S.meta.pending) badge = '<span class="nav-badge">' + S.meta.pending + '</span>';
            if (it[0] === 'admin/users' && S.meta.pendingUsers) badge = '<span class="nav-badge">' + S.meta.pendingUsers + '</span>';
            html += '<a href="#/' + it[0] + '" class="nav-link' + (active === it[0] ? ' active' : '') + '"><i class="bi bi-' + it[2] + '"></i><span>' + esc(it[1]) + '</span>' + badge + '</a>';
        });
        $('#sideNav').innerHTML = html;
    }

    function setMeta(meta) {
        S.meta = meta || {};
        var d = $('#notifDot');
        if (d) {
            d.hidden = !S.meta.unread;
            d.textContent = S.meta.unread > 9 ? '9+' : (S.meta.unread || '');
        }
        if (S.user) renderNav();
    }

    function showShell() {
        $('#boot').hidden = true;
        $('#auth').hidden = true;
        $('#shell').hidden = false;
        var u = S.user;
        $('#userChip').innerHTML = (u.photo ? '<img class="user-photo" src="' + esc(u.photo) + '" alt="" referrerpolicy="no-referrer">' : '<span class="avatar">' + esc(initials(u.name)) + '</span>') +
            '<span class="d-none d-md-inline text-start lh-sm"><span class="d-block fw-semibold small">' + esc(u.name) + '</span><span class="d-block xsmall text-body-secondary">' +
            (u.role === 'admin' ? 'Pentadbir' : 'Guru') + '</span></span><i class="bi bi-chevron-down small d-none d-md-inline"></i>';
        $('#todayLabel').textContent = fmtDate(todayIso(), true);
        $('#year').textContent = new Date().getFullYear();
        $$('[data-logout]').forEach(function (b) { b.onclick = logout; });
        renderNav();
        window.addEventListener('hashchange', route);
        route();
    }

    function loadNotifMenu() {
        var list = $('#notifList');
        list.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>';
        api('notifications', { limit: 6 }).then(function (rows) {
            list.innerHTML = rows.length ? rows.map(function (n) {
                return '<a href="' + esc(n.link || '#/notifications') + '" class="notif-item' + (n.is_read ? '' : ' unread') + '"><div class="fw-semibold small">' + esc(n.title) +
                    '</div><div class="small text-body-secondary text-truncate">' + esc(n.message) + '</div><div class="xsmall text-body-tertiary">' + timeAgo(n.created_at) + '</div></a>';
            }).join('') : '<div class="text-center text-body-secondary small py-4"><i class="bi bi-bell-slash fs-4 d-block mb-1"></i>Tiada notifikasi</div>';
            if (rows.some(function (n) { return !n.is_read; })) api('notifications.read', {});
        }).catch(showError);
    }

    /* ------------------------------------------------------------------
     * Router
     * ------------------------------------------------------------------ */
    function parseHash() {
        var h = location.hash.replace(/^#\/?/, '');
        var parts = h.split('?');
        var params = {};
        (parts[1] || '').split('&').forEach(function (kv) {
            if (!kv) return;
            var p = kv.split('=');
            params[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
        });
        return { page: parts[0] || 'dashboard', params: params };
    }

    function route() {
        var r = parseHash();
        var def = S.routes[r.page];
        if (!def) { go('dashboard'); return; }
        if (def.admin && S.user.role !== 'admin') { toast('Anda tidak mempunyai kebenaran untuk halaman tersebut.', 'warning'); go('dashboard'); return; }
        S.active = def.nav || r.page;
        renderNav();
        document.body.classList.remove('sidebar-open');
        var view = $('#view');
        var seq = ++S.routeSeq;
        view.innerHTML = '<div class="view-loading"><span class="spinner-border spinner-border-sm"></span> Memuatkan…</div>';
        window.scrollTo(0, 0);
        document.title = def.title + ' · ' + (S.settings.system_name || '');
        var ctx = { params: r.params, view: view, alive: function () { return seq === S.routeSeq; } };
        Promise.resolve().then(function () { return def.render(ctx); }).catch(function (err) {
            if (!ctx.alive()) return;
            view.innerHTML = empty('exclamation-octagon', err.message || 'Ralat memuatkan halaman.', '<button class="btn btn-sm btn-primary" onclick="App.reload()">Cuba lagi</button>');
        });
    }

    function addRoute(name, def) { S.routes[name] = def; }

    /* ------------------------------------------------------------------
     * Charts
     * ------------------------------------------------------------------ */
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
    function canvas(id) {
        var c = document.getElementById(id);
        if (!c) return null;
        c.parentNode.style.position = 'relative';
        c.parentNode.style.height = (c.getAttribute('height') || 240) + 'px';
        return c;
    }
    var charts = {
        line: function (id, labels, data) {
            var c = canvas(id); if (!c || !chartDefaults()) return;
            var g = c.getContext('2d').createLinearGradient(0, 0, 0, 220);
            g.addColorStop(0, 'rgba(59,130,246,.35)'); g.addColorStop(1, 'rgba(59,130,246,0)');
            new Chart(c, { type: 'line', data: { labels: labels, datasets: [{ data: data, borderColor: '#3b82f6', backgroundColor: g, fill: true, tension: .35, pointRadius: 4, pointBackgroundColor: '#fff', pointBorderWidth: 2 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } } });
        },
        bar: function (id, labels, data, colors, titles) {
            var c = canvas(id); if (!c || !chartDefaults()) return;
            new Chart(c, { type: 'bar', data: { labels: labels, datasets: [{ data: data, backgroundColor: colors || '#3b82f6', borderRadius: 6, maxBarThickness: 36 }] },
                options: { scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } },
                    plugins: { tooltip: { callbacks: { title: function (it) { return titles ? titles[it[0].dataIndex] : it[0].label; } } } } } });
        },
        doughnut: function (id, labels, data, colors) {
            var c = canvas(id); if (!c || !chartDefaults()) return;
            new Chart(c, { type: 'doughnut', data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
                options: { cutout: '68%', plugins: { legend: { display: true, position: 'bottom', labels: { usePointStyle: true, padding: 16 } } } } });
        },
    };

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            if (document.querySelector('script[src="' + src + '"]')) return resolve();
            var s = document.createElement('script');
            s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error('Gagal memuatkan ' + src)); };
            document.head.appendChild(s);
        });
    }

    /* ------------------------------------------------------------------
     * Global UI wiring & start
     * ------------------------------------------------------------------ */
    function wireGlobal() {
        var themeIcon = function () {
            var dark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
            $('#themeToggle').innerHTML = '<i class="bi bi-' + (dark ? 'sun' : 'moon-stars') + '"></i>';
        };
        themeIcon();
        $('#themeToggle').onclick = function () {
            var next = document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('tb-theme', next); } catch (e) { /* ignore */ }
            themeIcon();
        };
        $$('[data-toggle-sidebar]').forEach(function (el) { el.onclick = function () { document.body.classList.toggle('sidebar-open'); }; });
        $('#notifBtn').addEventListener('show.bs.dropdown', loadNotifMenu);
    }

    function start() {
        var cfg = window.APP_CONFIG || {};
        if (!cfg.gasUrl || /ISI_/.test(cfg.gasUrl) || /ISI_/.test((cfg.firebase || {}).apiKey || '')) {
            $('#boot').hidden = true;
            showMessage('gear', 'Konfigurasi belum lengkap', 'Sila isi <code>config.js</code> dengan konfigurasi Firebase dan URL Web App Google Apps Script. Rujuk <code>firebase-gas/README.md</code>.');
            return;
        }
        wireGlobal();
        firebase.initializeApp(cfg.firebase);
        // Public settings for the login page (school name, e-mail domain)
        var cfgP = api('config', {}, { public: true }).then(function (c) { S.settings = Object.assign(S.settings, c); applySettings(); }).catch(function () { /* offline: login still works */ });
        firebase.auth().onAuthStateChanged(function (u) {
            S.fbUser = u;
            cfgP.then(function () {
                if (!u) return showLogin();
                return startSession();
            });
        });
    }

    return {
        S: S, $: $, $$: $$, esc: esc, pad: pad, toMin: toMin, toTime: toTime, isoDate: isoDate, todayIso: todayIso, nowMin: nowMin, addDays: addDays,
        DAYS: DAYS, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, fmtDate: fmtDate, fmtDateTime: fmtDateTime, dayName: dayName, duration: duration,
        timeAgo: timeAgo, initials: initials, debounce: debounce, STATUS: STATUS, ROOM_STATUS: ROOM_STATUS, APPROVAL_MODES: APPROVAL_MODES,
        statusBadge: statusBadge, roomStatusBadge: roomStatusBadge, roomNeedsApproval: roomNeedsApproval, room: room, dot: dot, empty: empty,
        pageTitle: pageTitle, link: link, go: go, formData: formData, busy: busy, csvDownload: csvDownload, pager: pager,
        toast: toast, confirm: confirmBox, showError: showError, api: api, route: addRoute, reload: route, refreshSession: refreshSession,
        charts: charts, loadScript: loadScript, start: start,
    };
})();
