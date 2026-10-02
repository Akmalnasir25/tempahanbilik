/* Sistem Tempahan Bilik Khas — SPA core: auth, API, router, layout, helpers */
window.App = (function () {
    'use strict';

    var S = { user: null, settings: {}, rooms: [], periods: [], meta: {}, teachers: [], token: '', today: '', routes: {}, routeSeq: 0 };

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
    /** The school logo uploaded by an admin, or the logo bundled with the system. */
    var DEFAULT_LOGO = '/assets/img/logo.png';
    var DEFAULT_LOGO_ICON = '/assets/img/logo-icon.png';
    var brandLogo = function (cls) {
        var logo = S.settings.logo;
        if (!logo && !DEFAULT_LOGO) return '<span class="brand-logo ' + (cls || '') + '"><i class="bi bi-buildings"></i></span>';
        return '<span class="brand-logo has-img ' + (logo ? '' : 'is-default ') + (cls || '') + '">' +
            '<img src="' + esc(logo || DEFAULT_LOGO) + '" alt="Logo ' + esc(logo ? 'sekolah' : (S.settings.system_name || 'sistem')) + '"></span>';
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
     * API client — google.script.run when served from Apps Script,
     * otherwise fetch() to the Web App URL (e.g. from Firebase Hosting)
     * ------------------------------------------------------------------ */
    /* ------------------------------------------------------------------
     * Which school is this? Everyone uses one address (booking.akmalsys.com);
     * the KPM school code is typed once and remembered on the device.
     * ------------------------------------------------------------------ */
    var CFG = window.APP_CONFIG || {};
    var IN_GAS = !!(window.google && google.script && google.script.run);
    var SCHOOL_KEY = 'tb-school';
    function normCode(v) { return String(v || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, ''); }
    function savedSchool() {
        try { return JSON.parse(localStorage.getItem(SCHOOL_KEY) || 'null') || null; } catch (e) { return null; }
    }
    function detectSchool() {
        // Older links (/<kod> or ?s=<kod>) still work once, then the address is tidied up.
        var legacy = IN_GAS ? CFG.school : (new URLSearchParams(location.search).get('s') ||
            (location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0] || ''));
        legacy = normCode(legacy);
        if (legacy && !/^(index\.html|platform|display\.html)$/.test(legacy)) {
            if (!IN_GAS) history.replaceState(null, '', '/' + location.hash);
            return legacy;
        }
        var saved = savedSchool();
        return saved && saved.code ? normCode(saved.code) : '';
    }
    function isPlatformPage() {
        return IN_GAS ? !!CFG.platform : /^\/platform\/?$/.test(location.pathname);
    }
    function homeLink() {
        return IN_GAS ? CFG.gasUrl : '/';
    }
    /** Navigate the whole window (the Apps Script app runs inside an iframe). */
    function goTop(url) {
        if (IN_GAS) window.open(url, '_top'); else location.href = url;
    }
    /** Forget the school on this device and go back to the code box. */
    function switchSchool() {
        try { localStorage.removeItem(SCHOOL_KEY); } catch (e) { /* ignore */ }
        S.school = '';
        S.user = null;
        S.teachers = [];
        document.getElementById('shell').hidden = true;
        showLanding();
    }
    S.school = detectSchool();

    function tokenKey() { return 'tb-token:' + S.school; }
    function getToken() {
        try { return localStorage.getItem(tokenKey()) || sessionStorage.getItem(tokenKey()) || S.token || ''; } catch (e) { return S.token || ''; }
    }
    function setToken(token, remember) {
        S.token = token || '';
        try {
            localStorage.removeItem(tokenKey());
            sessionStorage.removeItem(tokenKey());
            if (token) (remember ? localStorage : sessionStorage).setItem(tokenKey(), token);
        } catch (e) { /* storage blocked: keep token in memory only */ }
    }

    function transport(payload) {
        var gsr = window.google && google.script && google.script.run;
        if (gsr) {
            return new Promise(function (resolve, reject) {
                gsr.withSuccessHandler(function (s) { resolve(JSON.parse(s)); })
                    .withFailureHandler(function (e) { reject(new Error('Ralat pelayan: ' + (e && e.message || e))); })
                    .api(JSON.stringify(payload));
            });
        }
        return fetch(window.APP_CONFIG.gasUrl, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow',
        }).then(function (r) {
            if (!r.ok) throw new Error('Pelayan tidak dapat dihubungi (' + r.status + ').');
            return r.json();
        }, function () { throw new Error('Tidak dapat menghubungi pelayan. Semak sambungan Internet anda.'); });
    }

    function api(action, data, opts) {
        opts = opts || {};
        var payload = { action: action, data: data || {} };
        if (opts.platform) {
            payload.token = opts.token || undefined;
        } else {
            payload.school = S.school;
            payload.token = opts.public ? undefined : getToken() || undefined;
        }
        return transport(payload).then(function (j) {
            if (j.meta) setMeta(j.meta);
            if (!j.ok) {
                var e = new Error(j.error || 'Ralat');
                e.code = j.code; e.info = j.info;
                if (j.code === 'AUTH' && !opts.public && !opts.platform && S.user) {
                    setToken('');
                    S.user = null;
                    toast(j.error, 'warning');
                    showLogin();
                }
                throw e;
            }
            return j.data;
        });
    }

    /* ------------------------------------------------------------------
     * Auth screens — pilih nama, log masuk dengan No. KP
     * ------------------------------------------------------------------ */
    function authLayout(inner) {
        var s = S.settings;
        return '<div class="auth-wrap"><section class="auth-hero"><div class="auth-hero-inner">' +
            '<div class="d-flex align-items-center gap-3 mb-5">' + brandLogo('lg') + '<div>' +
            '<div class="fw-bold fs-5">' + esc(s.system_name || 'Sistem Tempahan Bilik Khas') + '</div><div class="opacity-75 small">' + esc(s.school_name || '') + '</div></div></div>' +
            '<h1 class="display-6 fw-bold mb-3">Tempah bilik khas sekolah dengan mudah, pantas &amp; tanpa pertembungan.</h1>' +
            '<p class="lead opacity-75 mb-5">Pilih nama anda, log masuk, semak kekosongan secara langsung dan pantau jadual mingguan atau bulanan di satu tempat.</p>' +
            '<div class="row g-3 auth-features">' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-person-check"></i><div><strong>Log masuk mudah</strong><span>Pilih nama &amp; masukkan No. KP</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-lightning-charge"></i><div><strong>Semakan masa nyata</strong><span>Tempahan bertindih disekat secara automatik</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-calendar-week"></i><div><strong>Jadual interaktif</strong><span>Paparan harian, mingguan &amp; bulanan</span></div></div></div>' +
            '<div class="col-sm-6"><div class="feat"><i class="bi bi-arrow-repeat"></i><div><strong>Tempahan berulang</strong><span>Tempah slot yang sama setiap minggu</span></div></div></div>' +
            '</div></div></section><section class="auth-panel"><div class="auth-card">' +
            '<div class="d-lg-none text-center mb-4">' + brandLogo('lg mx-auto mb-2') + '<div class="fw-bold">' + esc(s.system_name || '') + '</div><div class="small text-body-secondary">' + esc(s.school_name || '') + '</div></div>' +
            inner + '<p class="auth-credit">Design by: Akmal Nasir</p></div></section></div>';
    }

    function showAuth(html) {
        $('#boot').hidden = true;
        $('#shell').hidden = true;
        var a = $('#auth');
        a.hidden = false;
        a.innerHTML = authLayout(html);
        return a;
    }

    function showMessage(icon, title, text, extra) {
        showAuth('<div class="text-center"><div class="confirm-icon mb-3" style="background:rgba(59,130,246,.1);color:#1d4ed8"><i class="bi bi-' + icon + '"></i></div>' +
            '<h2 class="h4 fw-bold">' + esc(title) + '</h2><p class="text-body-secondary">' + text + '</p>' + (extra || '') + '</div>');
    }

    var icInput = function (name, label, autofocus) {
        return '<div class="mb-3"><label class="form-label fw-semibold">' + label + '</label><div class="input-icon"><i class="bi bi-person-vcard"></i>' +
            '<input class="form-control form-control-lg" name="' + name + '" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="cth. 900101101234" required' + (autofocus ? ' autofocus' : '') + '>' +
            '<button type="button" class="btn-reveal" data-reveal aria-label="Papar"><i class="bi bi-eye"></i></button></div></div>';
    };

    function showLogin() {
        var teachers = S.teachers || [];
        var a = showAuth(
            '<h2 class="h3 fw-bold mb-1">Selamat datang 👋</h2><p class="text-body-secondary mb-4">Pilih nama anda untuk log masuk.</p>' +
            '<div id="loginAlert"></div>' +
            '<form id="loginForm" autocomplete="off">' +
            '<div class="mb-3"><label class="form-label fw-semibold">Nama guru</label>' +
            '<div class="input-icon mb-2"><i class="bi bi-search"></i><input class="form-control" id="nameFilter" placeholder="Taip untuk cari nama…"></div>' +
            '<select class="form-select form-select-lg" id="userSelect" required><option value="">— Pilih nama anda —</option>' +
            teachers.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + (t.department ? ' (' + esc(t.department) + ')' : '') + '</option>'; }).join('') +
            '</select></div><div id="loginStep"></div></form>' +
            (S.settings.allow_registration === '1' ? '<p class="text-center text-body-secondary mt-4 mb-0 small">Nama anda tiada dalam senarai? <a href="#" id="showRegister" class="fw-semibold">Daftar di sini</a></p>' : '') +
            '<p class="text-center xsmall text-body-tertiary mt-3 mb-0">Lupa kata laluan? Hubungi pentadbir sistem untuk menetapkan semula.</p>' +
            '<p class="text-center xsmall mt-2 mb-0"><a href="#" id="switchSchool" class="text-body-secondary"><i class="bi bi-arrow-left-right me-1"></i>Bukan ' + esc(S.settings.school_name || 'sekolah ini') + '? Tukar sekolah</a></p>');
        $('#switchSchool', a).onclick = function (e) {
            e.preventDefault();
            switchSchool();
        };
        var sel = $('#userSelect', a), step = $('#loginStep', a);
        try { var last = localStorage.getItem('tb-last-user'); if (last && teachers.some(function (t) { return String(t.id) === last; })) sel.value = last; } catch (e) { /* ignore */ }

        $('#nameFilter', a).oninput = function () {
            var q = this.value.trim().toLowerCase(), first = null;
            Array.prototype.forEach.call(sel.options, function (o, i) {
                if (!i) return;
                var show = !q || o.text.toLowerCase().indexOf(q) !== -1;
                o.hidden = !show;
                if (show && !first) first = o;
            });
            if (q && first) { sel.value = first.value; renderStep(); }
        };
        sel.onchange = renderStep;

        function renderStep() {
            var t = teachers.filter(function (x) { return String(x.id) === sel.value; })[0];
            $('#loginAlert', a).innerHTML = '';
            if (!t) { step.innerHTML = ''; return; }
            if (t.pending) {
                step.innerHTML = '<div class="auth-note mb-3"><i class="bi bi-hourglass-split me-1 text-warning"></i><strong>Menunggu pengesahan.</strong> No. KP anda telah didaftarkan. ' +
                    'Anda boleh log masuk selepas pentadbir sekolah mengesahkan akaun anda.</div>' +
                    '<div class="small text-body-secondary">Bukan anda yang mendaftar? Maklumkan kepada pentadbir sekolah segera.</div>';
                return;
            }
            if (t.activated) {
                step.innerHTML = icInput('password', 'No. Kad Pengenalan / kata laluan', true) +
                    '<div class="form-check mb-4"><input class="form-check-input" type="checkbox" id="remember" checked><label class="form-check-label small" for="remember">Ingat saya pada peranti ini</label></div>' +
                    '<button class="btn btn-primary btn-lg w-100 fw-semibold">Log Masuk <i class="bi bi-arrow-right ms-1"></i></button>';
                $('[name=password]', step).removeAttribute('inputmode');
                $('[name=password]', step).type = 'password';
            } else {
                step.innerHTML = '<div class="auth-note mb-3"><i class="bi bi-stars me-1 text-primary"></i><strong>Log masuk kali pertama.</strong> Daftarkan No. Kad Pengenalan anda (12 digit) — ia akan menjadi kata laluan anda.</div>' +
                    icInput('ic', 'No. Kad Pengenalan', true) + icInput('ic_confirm', 'Sahkan No. Kad Pengenalan') +
                    '<div class="form-check mb-4"><input class="form-check-input" type="checkbox" id="remember" checked><label class="form-check-label small" for="remember">Ingat saya pada peranti ini</label></div>' +
                    '<button class="btn btn-primary btn-lg w-100 fw-semibold">Daftar No. KP <i class="bi bi-arrow-right ms-1"></i></button>' +
                    '<div class="xsmall text-body-secondary mt-2 text-center">Pentadbir sekolah akan mengesahkan akaun anda sebelum anda boleh log masuk.</div>';
                $$('[name=ic], [name=ic_confirm]', step).forEach(function (i) { i.type = 'password'; });
            }
            $$('[data-reveal]', step).forEach(function (b) {
                b.onclick = function () {
                    var inp = b.parentNode.querySelector('input');
                    var show = inp.type === 'password';
                    inp.type = show ? 'text' : 'password';
                    b.innerHTML = '<i class="bi bi-eye' + (show ? '-slash' : '') + '"></i>';
                };
            });
            var f = step.querySelector('input');
            if (f) setTimeout(function () { f.focus(); }, 50);
        }

        $('#loginForm', a).onsubmit = function (e) {
            e.preventDefault();
            var t = teachers.filter(function (x) { return String(x.id) === sel.value; })[0];
            if (!t || t.pending) return;
            var btn = $('button.btn-primary', step), remember = $('#remember', step).checked;
            var req = t.activated
                ? api('login', { user_id: t.id, password: $('[name=password]', step).value, remember: remember }, { public: true })
                : api('activate', { user_id: t.id, ic: $('[name=ic]', step).value, ic_confirm: $('[name=ic_confirm]', step).value, remember: remember }, { public: true });
            busy(btn, true);
            req.then(function (r) {
                try { localStorage.setItem('tb-last-user', String(t.id)); } catch (err) { /* ignore */ }
                if (r.status === 'pending') {
                    t.pending = true;
                    showMessage('hourglass-split', 'No. KP berjaya didaftarkan', 'Akaun anda kini menunggu pengesahan pentadbir sekolah. Selepas disahkan, log masuk dengan nama dan No. KP anda.',
                        '<button class="btn btn-primary mt-2" id="backLogin3">Kembali ke log masuk</button>');
                    $('#backLogin3').onclick = showLogin;
                    return;
                }
                setToken(r.token, remember);
                startSession();
            }).catch(function (err) {
                busy(btn, false);
                if (err.code === 'NOT_ACTIVATED') { t.activated = false; renderStep(); }
                if (err.code === 'PENDING') { t.pending = true; renderStep(); }
                $('#loginAlert', a).innerHTML = '<div class="alert alert-danger py-2 small"><i class="bi bi-exclamation-circle me-1"></i>' + esc(err.message) + '</div>';
            });
        };
        var reg = $('#showRegister', a);
        if (reg) reg.onclick = function (e) { e.preventDefault(); showRegister(); };
        renderStep();
    }

    function showRegister() {
        var a = showAuth('<h2 class="h3 fw-bold mb-1">Daftar akaun guru</h2>' +
            '<p class="text-body-secondary mb-4">Isi maklumat di bawah. Pentadbir akan mengesahkan akaun anda sebelum anda boleh log masuk.</p><div id="regAlert"></div>' +
            '<form id="regForm" autocomplete="off"><div class="mb-3"><label class="form-label fw-semibold">Nama penuh <span class="text-danger">*</span></label><input class="form-control" name="name" required></div>' +
            icInput('ic', 'No. Kad Pengenalan (akan menjadi kata laluan) <span class="text-danger">*</span>') +
            '<div class="row g-3 mb-4"><div class="col-sm-6"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" placeholder="cth. Sains"></div>' +
            '<div class="col-sm-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone"></div>' +
            '<div class="col-12"><label class="form-label fw-semibold">E-mel <span class="text-body-secondary fw-normal">(pilihan, untuk notifikasi)</span></label><input type="email" class="form-control" name="email"></div></div>' +
            '<button class="btn btn-primary btn-lg w-100 fw-semibold">Hantar pendaftaran</button></form>' +
            '<button class="btn btn-link w-100 mt-2" id="backLogin">Kembali ke log masuk</button>');
        $('[name=ic]', a).type = 'password';
        $('[data-reveal]', a).onclick = function () { var i = $('[name=ic]', a); i.type = i.type === 'password' ? 'text' : 'password'; };
        $('#backLogin', a).onclick = showLogin;
        $('#regForm', a).onsubmit = function (e) {
            e.preventDefault();
            var btn = $('button.btn-primary', this);
            busy(btn, true);
            api('register', formData(this), { public: true }).then(function () {
                showMessage('hourglass-split', 'Pendaftaran dihantar', 'Akaun anda akan muncul dalam senarai nama selepas disahkan oleh pentadbir. Selepas itu, log masuk dengan No. KP yang anda daftarkan.',
                    '<button class="btn btn-primary mt-2" id="backLogin2">Kembali ke log masuk</button>');
                $('#backLogin2').onclick = showLogin;
            }).catch(function (err) {
                busy(btn, false);
                $('#regAlert', a).innerHTML = '<div class="alert alert-danger py-2 small">' + esc(err.message) + '</div>';
            });
        };
    }

    function logout() {
        api('logout', {}).catch(function () { /* ignore */ }).then(function () {
            setToken('');
            S.user = null;
            history.replaceState(null, '', location.pathname + location.search);
            return loadConfig();
        }).then(showLogin, showLogin);
    }

    /* ------------------------------------------------------------------
     * Session bootstrap
     * ------------------------------------------------------------------ */
    function loadConfig() {
        return api('config', {}, { public: true }).then(function (c) {
            S.teachers = c.teachers;
            S.settings = Object.assign(S.settings, c);
            applySettings();
            try { localStorage.setItem(SCHOOL_KEY, JSON.stringify({ code: S.school, name: c.school_name })); } catch (e) { /* ignore */ }
        });
    }

    /* ------------------------------------------------------------------
     * Landing page: ask for the KPM school code. The list of schools is
     * never shown; the teacher list only appears after a valid code.
     * ------------------------------------------------------------------ */
    function showLanding(errorMsg) {
        S.settings.system_name = S.settings.system_name || CFG.platformName || 'Sistem Tempahan Bilik Khas';
        var a = showAuth('<h2 class="h3 fw-bold mb-1">Selamat datang 👋</h2><p class="text-body-secondary mb-4">Masukkan kod sekolah anda untuk log masuk.</p>' +
            '<div id="codeAlert">' + (errorMsg ? '<div class="alert alert-danger py-2 small"><i class="bi bi-exclamation-circle me-1"></i>' + esc(errorMsg) + '</div>' : '') + '</div>' +
            '<form id="codeForm" autocomplete="off"><label class="form-label fw-semibold" for="schoolCode">Kod sekolah</label>' +
            '<div class="input-icon mb-3"><i class="bi bi-building"></i><input class="form-control form-control-lg text-uppercase" id="schoolCode" required placeholder="cth. PEA1234" autocapitalize="characters" spellcheck="false"></div>' +
            '<button class="btn btn-primary btn-lg w-100 fw-semibold">Teruskan <i class="bi bi-arrow-right ms-1"></i></button></form>' +
            '<p class="text-center xsmall text-body-tertiary mt-4 mb-0">Gunakan kod sekolah KPM anda. Sekolah anda akan diingati pada peranti ini.</p>');
        $('#codeForm', a).onsubmit = function (e) {
            e.preventDefault();
            var code = normCode($('#schoolCode', a).value);
            if (!code) return;
            var btn = $('button', this);
            busy(btn, true);
            S.school = code;
            openSchool().catch(function (err) {
                busy(btn, false);
                S.school = '';
                $('#codeAlert', a).innerHTML = '<div class="alert alert-danger py-2 small"><i class="bi bi-exclamation-circle me-1"></i>' + esc(err.message) + '</div>';
            });
        };
        setTimeout(function () { var i = $('#schoolCode', a); if (i) i.focus(); }, 50);
    }

    function startSession() {
        return api('session').then(function (d) {
            S.settings = Object.assign(d.settings || {}, { logo: S.settings.logo || '' });
            applySettings();
            S.user = d.user;
            S.rooms = d.rooms;
            S.periods = d.periods;
            S.today = d.today;
            showShell();
        }).catch(function (err) {
            if (err.code === 'AUTH') { setToken(''); return loadConfig().then(showLogin); }
            showMessage('wifi-off', 'Tidak dapat memuatkan sistem', esc(err.message), '<button class="btn btn-primary mt-2" onclick="location.reload()">Cuba lagi</button>');
        });
    }

    function applySettings() {
        $$('[data-setting]').forEach(function (el) { el.textContent = S.settings[el.dataset.setting] || ''; });
        document.title = S.settings.system_name || 'Tempahan Bilik Khas';
        var side = $('#sidebarLogo');
        if (side) side.outerHTML = brandLogo().replace('<span class="brand-logo', '<span id="sidebarLogo" class="brand-logo');
        $$('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(function (el) {
            el.href = S.settings.logo || DEFAULT_LOGO_ICON;
        });
    }

    function setLogo(logo) {
        S.settings.logo = logo || '';
        applySettings();
    }

    function refreshSession() {
        return api('session').then(function (d) {
            S.settings = Object.assign(d.settings, { logo: S.settings.logo || '' }); S.rooms = d.rooms; S.periods = d.periods; S.user = d.user;
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
        $('#displayLink').href = displayUrl();
        renderNav();
        if (!S.routerBound) { window.addEventListener('hashchange', route); S.routerBound = true; }
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
        if (!S.user) return;
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

    var VENDOR = (window.APP_CONFIG || {}).cdn ? {
        chart: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js',
        fullcalendar: 'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js',
        fullcalendarLocale: 'https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/locales/ms.global.min.js',
    } : {
        chart: '/assets/vendor/chartjs/chart.umd.min.js',
        fullcalendar: '/assets/vendor/fullcalendar/index.global.min.js',
        fullcalendarLocale: '/assets/vendor/fullcalendar/locale-ms.global.min.js',
    };

    function displayUrl() {
        return IN_GAS ? CFG.gasUrl + '?page=display&s=' + encodeURIComponent(S.school) : '/display.html';
    }

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
        if (!IN_GAS && (!CFG.gasUrl || /ISI_/.test(CFG.gasUrl))) {
            showMessage('gear', 'Konfigurasi belum lengkap', 'Sila isi <code>config.js</code> dengan URL Web App Google Apps Script. Rujuk <code>firebase-gas/README.md</code>.');
            return;
        }
        if (isPlatformPage()) {
            window.Platform.start();
            return;
        }
        if (!S.school) {
            showLanding();
            return;
        }
        openSchool().catch(function (err) {
            if (err.code === 'SCHOOL_NOT_FOUND') {
                try { localStorage.removeItem(SCHOOL_KEY); } catch (e) { /* ignore */ }
                S.school = '';
                return showLanding(err.message);
            }
            if (err.code === 'SCHOOL_SUSPENDED') {
                return showMessage('pause-circle', 'Akaun digantung', esc(err.message), '<a href="#" class="btn btn-light mt-2" onclick="event.preventDefault();App.switchSchool()">Pilih sekolah lain</a>');
            }
            showMessage('wifi-off', 'Tidak dapat menghubungi pelayan', esc(err.message), '<button class="btn btn-primary mt-2" onclick="location.reload()">Cuba lagi</button>');
        });
    }

    /** Load the current school; rejects with SCHOOL_NOT_FOUND / SCHOOL_SUSPENDED. */
    var wired = false;
    function openSchool() {
        return loadConfig().then(function () {
            if (!wired) { wireGlobal(); wired = true; }
            return getToken() ? startSession() : showLogin();
        });
    }

    return {
        S: S, $: $, $$: $$, esc: esc, pad: pad, toMin: toMin, toTime: toTime, isoDate: isoDate, todayIso: todayIso, nowMin: nowMin, addDays: addDays,
        DAYS: DAYS, MONTHS: MONTHS, MONTHS_SHORT: MONTHS_SHORT, fmtDate: fmtDate, fmtDateTime: fmtDateTime, dayName: dayName, duration: duration,
        timeAgo: timeAgo, initials: initials, debounce: debounce, STATUS: STATUS, ROOM_STATUS: ROOM_STATUS, APPROVAL_MODES: APPROVAL_MODES,
        statusBadge: statusBadge, roomStatusBadge: roomStatusBadge, roomNeedsApproval: roomNeedsApproval, room: room, dot: dot, empty: empty,
        pageTitle: pageTitle, brandLogo: brandLogo, setLogo: setLogo, link: link, go: go, formData: formData, busy: busy, csvDownload: csvDownload, pager: pager,
        toast: toast, confirm: confirmBox, showError: showError, api: api, route: addRoute, reload: route, refreshSession: refreshSession,
        charts: charts, loadScript: loadScript, vendor: VENDOR, displayUrl: displayUrl, start: start,
        showAuth: showAuth, goTop: goTop, homeLink: homeLink, switchSchool: switchSchool, IN_GAS: IN_GAS, CFG: CFG,
    };
})();
