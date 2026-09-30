/* Sistem Tempahan Bilik Khas — platform owner (Super Admin) panel */
window.Platform = (function (A) {
    'use strict';
    var $ = A.$, $$ = A.$$, esc = A.esc;
    var P = { token: '', me: null };
    var KEY = 'tb-platform-token';

    try { P.token = sessionStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
    function setToken(t) {
        P.token = t || '';
        try { if (t) sessionStorage.setItem(KEY, t); else sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    }
    function call(action, data) {
        return A.api(action, data, { platform: true, token: P.token }).catch(function (err) {
            if (err.code === 'AUTH') { setToken(''); showLogin(); }
            throw err;
        });
    }

    function root() {
        $('#boot').hidden = true;
        $('#shell').hidden = true;
        var el = $('#auth');
        el.hidden = false;
        return el;
    }

    function frame(title, active, body) {
        var nav = function (hash, icon, label) {
            return '<li class="nav-item"><a class="nav-link' + (active === hash ? ' active fw-semibold' : '') + '" href="#/' + hash + '"><i class="bi bi-' + icon + ' me-1"></i>' + label + '</a></li>';
        };
        root().innerHTML = '<nav class="navbar navbar-expand-md navbar-dark platform-nav"><div class="container-xl">' +
            '<a class="navbar-brand d-flex align-items-center gap-2" href="#/"><span class="brand-logo"><i class="bi bi-buildings"></i></span>' +
            '<span class="lh-sm"><strong class="d-block">' + esc(P.me ? P.me.platform_name : 'Platform') + '</strong><small class="opacity-75">Panel Super Admin</small></span></a>' +
            (P.me ? '<button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#pnav"><span class="navbar-toggler-icon"></span></button>' +
                '<div class="collapse navbar-collapse" id="pnav"><ul class="navbar-nav ms-auto align-items-md-center gap-md-2">' +
                nav('', 'building', 'Sekolah') + nav('audit', 'shield-check', 'Log Audit') + nav('account', 'person-gear', esc(P.me.name)) +
                '<li class="nav-item"><button class="btn btn-sm btn-outline-light" id="pLogout"><i class="bi bi-box-arrow-right me-1"></i>Log keluar</button></li></ul></div>' : '') +
            '</div></nav><main class="container-xl py-4" id="pView">' + body + '</main>';
        document.title = title + ' · Super Admin';
        var lo = $('#pLogout');
        if (lo) lo.onclick = function () { call('platform.logout', {}).catch(function () {}).then(function () { setToken(''); P.me = null; showLogin(); }); };
    }

    function loading() {
        var v = $('#pView');
        if (v) v.innerHTML = '<div class="view-loading"><span class="spinner-border spinner-border-sm"></span> Memuatkan…</div>';
    }

    /* ---------- Login / first-run setup ---------- */
    function showLogin() {
        A.api('platform.status', {}, { platform: true }).then(function (st) {
            P.me = null;
            var setup = !st.has_admins;
            frame(setup ? 'Persediaan' : 'Log Masuk', '', '<div class="mx-auto" style="max-width:480px"><div class="card"><div class="card-body p-4">' +
                (setup ? '<h1 class="h4 fw-bold mb-1">Persediaan pertama platform</h1><p class="text-body-secondary">Cipta akaun <strong>Super Admin</strong> anda. Akaun ini digunakan untuk mendaftar dan mengurus sekolah.</p>' +
                    '<div class="alert alert-warning small"><i class="bi bi-exclamation-triangle me-1"></i>Halaman ini hanya muncul sekali. Lengkapkan sekarang.</div>'
                    : '<h1 class="h4 fw-bold mb-1">Log masuk Super Admin</h1><p class="text-body-secondary small">Untuk pemilik platform sahaja. Guru dan admin sekolah log masuk melalui pautan sekolah masing-masing.</p>') +
                '<div id="pErr"></div><form id="pAuth">' +
                (setup ? '<div class="mb-3"><label class="form-label fw-semibold">Nama</label><input class="form-control" name="name" required></div>' : '') +
                '<div class="mb-3"><label class="form-label fw-semibold">E-mel</label><input type="email" class="form-control" name="email" required autocomplete="username"></div>' +
                '<div class="mb-4"><label class="form-label fw-semibold">Kata laluan</label><input type="password" class="form-control" name="password" required ' + (setup ? 'minlength="10" autocomplete="new-password"' : 'autocomplete="current-password"') + '></div>' +
                '<button class="btn btn-primary w-100">' + (setup ? 'Cipta akaun Super Admin' : 'Log Masuk') + '</button></form></div></div></div>');
            $('#pAuth').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                call(setup ? 'platform.setup' : 'platform.login', A.formData(this)).then(function (r) {
                    setToken(r.token);
                    boot();
                }).catch(function (err) {
                    A.busy(btn, false);
                    $('#pErr').innerHTML = '<div class="alert alert-danger py-2 small">' + esc(err.message) + '</div>';
                });
            };
        }).catch(function (err) {
            root().innerHTML = A.empty('wifi-off', err.message);
        });
    }

    /* ---------- Router ---------- */
    function route() {
        if (!P.me) return;
        var h = location.hash.replace(/^#\/?/, '');
        var page = h.split('?')[0];
        var params = new URLSearchParams(h.split('?')[1] || '');
        if (page === 'new') return pageNew();
        if (page === 'school') return pageSchool(params.get('id'));
        if (page === 'audit') return pageAudit();
        if (page === 'account') return pageAccount();
        return pageSchools(params.get('fresh') === '1');
    }

    function boot() {
        call('platform.me', {}).then(function (me) {
            P.me = me;
            if (!P.bound) { window.addEventListener('hashchange', route); P.bound = true; }
            route();
        }).catch(function () { showLogin(); });
    }

    /* ---------- Schools list ---------- */
    function pageSchools(fresh) {
        frame('Sekolah', '', '');
        loading();
        call('platform.schools', { fresh: fresh }).then(function (rows) {
            var t = { schools: rows.length, active: 0, users: 0, month: 0 };
            rows.forEach(function (r) { if (r.status === 'active') t.active++; t.users += r.stats.users; t.month += r.stats.month; });
            var created = P.created;
            P.created = null;
            $('#pView').innerHTML = (created ? credentialsCard(created) : '') +
                '<div class="page-head"><div><h1 class="page-title">Sekolah</h1><p class="page-subtitle">Setiap sekolah mempunyai Google Sheet, admin, guru dan bilik khas sendiri.</p></div>' +
                '<div class="page-actions"><a href="#/?fresh=1" class="btn btn-light"><i class="bi bi-arrow-clockwise me-1"></i>Muat semula</a><a href="#/new" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tambah Sekolah</a></div></div>' +
                '<div class="row g-3 mb-4">' + [['Jumlah Sekolah', t.schools, 'building', 'primary'], ['Sekolah Aktif', t.active, 'check-circle', 'success'], ['Pengguna Aktif', t.users, 'people', 'info'], ['Tempahan Bulan Ini', t.month, 'calendar-check', 'warning']].map(function (x) {
                    return '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon bg-' + x[3] + '-subtle text-' + x[3] + '-emphasis"><i class="bi bi-' + x[2] + '"></i></div><div><div class="stat-value">' + x[1] + '</div><div class="stat-label">' + x[0] + '</div></div></div></div>';
                }).join('') + '</div>' +
                '<div class="card">' + (rows.length ? '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Sekolah</th><th>Pautan</th><th class="text-center">Pengguna</th><th class="text-center">Bilik</th><th class="text-center">Tempahan (bulan ini)</th><th>Log masuk terakhir</th><th>Status</th><th></th></tr></thead><tbody>' +
                    rows.map(function (r) {
                        var st = r.stats;
                        return '<tr><td><strong>' + esc(r.name) + '</strong><div class="xsmall text-body-secondary">' + esc(r.school_code || '-') + (st.error ? ' · <span class="text-danger">' + esc(st.error) + '</span>' : '') + '</div></td>' +
                            '<td><a href="' + esc(r.url) + '" target="_blank" class="school-link">/' + esc(r.slug) + ' <i class="bi bi-box-arrow-up-right"></i></a></td>' +
                            '<td class="text-center">' + st.users + (st.pending_users ? ' <span class="badge badge-soft-warning">+' + st.pending_users + '</span>' : '') + '</td><td class="text-center">' + st.rooms + '</td>' +
                            '<td class="text-center">' + st.bookings + ' <span class="text-body-secondary">(' + st.month + ')</span></td>' +
                            '<td class="small">' + (st.last_login ? A.fmtDateTime(st.last_login) : '<span class="text-body-tertiary">Belum ada</span>') + '</td>' +
                            '<td>' + (r.status === 'active' ? '<span class="badge badge-soft-success">Aktif</span>' : '<span class="badge badge-soft-danger">Digantung</span>') + '</td>' +
                            '<td class="text-end"><a href="#/school?id=' + r.id + '" class="btn btn-sm btn-light">Urus <i class="bi bi-chevron-right"></i></a></td></tr>';
                    }).join('') + '</tbody></table></div>' : A.empty('building-add', 'Belum ada sekolah.', '<a href="#/new" class="btn btn-primary btn-sm">Tambah sekolah pertama</a>')) + '</div>';
        }).catch(function (err) { $('#pView').innerHTML = A.empty('exclamation-octagon', err.message); });
    }

    function credentialsCard(c) {
        return '<div class="card border-success-subtle mb-4"><div class="card-body"><h2 class="h5 fw-bold text-success"><i class="bi bi-check-circle me-1"></i>' + esc(c.name) + ' berjaya dicipta</h2>' +
            '<p class="mb-2">Hantar maklumat ini kepada admin sekolah. Kata laluan tidak akan dipaparkan lagi.</p>' +
            '<div class="bg-body-tertiary rounded p-3 font-monospace small user-select-all" style="white-space:pre-line">Pautan sistem: ' + esc(c.url) + '\nKod sekolah: ' + esc(c.slug) +
            (c.admin_password ? '\nNama admin (pilih di halaman log masuk): ' + esc(c.admin_name) + '\nKata laluan sementara: ' + esc(c.admin_password) : '\nGoogle Sheet sedia ada digunakan (akaun admin sedia ada kekal).') +
            '</div><div class="small text-body-secondary mt-2">Data sekolah: <a href="' + esc(c.sheet_url) + '" target="_blank">Google Sheet sekolah</a> (dalam Google Drive anda).</div></div></div>';
    }

    /* ---------- New school ---------- */
    function pageNew() {
        frame('Tambah Sekolah', '', '<a href="#/" class="small"><i class="bi bi-arrow-left me-1"></i>Kembali</a><h1 class="page-title mt-1 mb-4">Tambah Sekolah</h1><div id="pErr"></div>' +
            '<form id="newSchool" class="row g-4" autocomplete="off"><div class="col-lg-6"><div class="card h-100"><div class="card-header"><h2 class="card-title"><i class="bi bi-building me-2"></i>Maklumat Sekolah</h2></div><div class="card-body">' +
            '<div class="mb-3"><label class="form-label fw-semibold">Nama sekolah <span class="text-danger">*</span></label><input class="form-control" name="name" required placeholder="cth. SMK Taman Contoh"></div>' +
            '<div class="mb-3"><label class="form-label fw-semibold">Kod pautan <span class="text-danger">*</span></label><div class="input-group"><span class="input-group-text small">' + esc(A.schoolLink('').replace(/\/?$/, '/').replace(/\?s=\/$/, '?s=')) + '</span>' +
            '<input class="form-control text-lowercase" name="slug" id="slug" required pattern="[a-z0-9][a-z0-9\\-]{1,28}[a-z0-9]" placeholder="smkabc"></div>' +
            '<div class="form-text">Guru akan buka sistem melalui pautan ini. Huruf kecil, nombor dan sengkang sahaja. <strong>Tidak boleh ditukar kemudian.</strong></div></div>' +
            '<div class="mb-3"><label class="form-label fw-semibold">Kod sekolah KPM</label><input class="form-control" name="school_code" placeholder="cth. ABC1234"></div>' +
            '<div class="row g-3"><div class="col-md-6"><label class="form-label fw-semibold">Pegawai dihubungi</label><input class="form-control" name="contact_name"></div>' +
            '<div class="col-md-6"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="contact_phone"></div>' +
            '<div class="col-12"><label class="form-label fw-semibold">Catatan dalaman</label><textarea class="form-control" name="notes" rows="2" placeholder="cth. Langganan tamat Disember 2027"></textarea></div></div></div></div></div>' +
            '<div class="col-lg-6"><div class="card h-100"><div class="card-header"><h2 class="card-title"><i class="bi bi-person-badge me-2"></i>Admin Sekolah</h2></div><div class="card-body">' +
            '<p class="small text-body-secondary">Admin sekolah log masuk dengan memilih namanya di halaman log masuk sekolah, kemudian mendaftar guru dan mengurus bilik khas.</p>' +
            '<div id="adminFields"><div class="mb-3"><label class="form-label fw-semibold">Nama admin <span class="text-danger">*</span></label><input class="form-control" name="admin_name" placeholder="cth. Pn. Siti (Penyelaras ICT)"></div>' +
            '<div class="mb-3"><label class="form-label fw-semibold">Kata laluan sementara</label><input class="form-control font-monospace" name="admin_password" placeholder="Kosongkan untuk jana automatik" minlength="8"></div></div>' +
            '<details class="mt-3"><summary class="small fw-semibold">Guna Google Sheet sedia ada (pilihan)</summary><div class="mt-2"><input class="form-control form-control-sm" name="adopt_sheet" id="adopt" placeholder="Pautan Google Sheet versi satu-sekolah">' +
            '<div class="form-text">Jika sekolah ini sudah menggunakan versi GAS satu-sekolah, tampal pautan Google Sheet-nya. Data (guru, bilik, tempahan) akan terus digunakan.</div></div></details>' +
            '</div></div></div><div class="col-12"><button class="btn btn-primary btn-lg px-5"><i class="bi bi-check2-circle me-1"></i>Cipta Sekolah</button>' +
            '<span class="small text-body-secondary ms-3">Mencipta Google Sheet baharu mengambil masa beberapa saat.</span></div></form>');
        var slug = $('#slug');
        slug.oninput = function () { slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, ''); };
        $('#adopt').oninput = function () { $('#adminFields').style.opacity = this.value ? '.4' : '1'; };
        $('#newSchool').onsubmit = function (e) {
            e.preventDefault();
            var btn = $('button.btn-lg', this);
            A.busy(btn, true);
            call('platform.school.create', A.formData(this)).then(function (r) {
                P.created = r;
                location.hash = '#/?fresh=1';
            }).catch(function (err) {
                A.busy(btn, false);
                $('#pErr').innerHTML = '<div class="alert alert-danger">' + esc(err.message) + '</div>';
                window.scrollTo(0, 0);
            });
        };
    }

    /* ---------- One school ---------- */
    function pageSchool(id) {
        frame('Sekolah', '', '');
        loading();
        call('platform.school.get', { id: id }).then(function (s) {
            var st = s.stats, active = s.status === 'active';
            var creds = P.creds;
            P.creds = null;
            $('#pView').innerHTML = '<a href="#/" class="small"><i class="bi bi-arrow-left me-1"></i>Semua sekolah</a>' +
                '<div class="page-head mt-1"><div><h1 class="page-title">' + esc(s.name) + ' ' + (active ? '<span class="badge badge-soft-success fs-6 align-middle">Aktif</span>' : '<span class="badge badge-soft-danger fs-6 align-middle">Digantung</span>') + '</h1>' +
                '<p class="page-subtitle"><a href="' + esc(s.url) + '" target="_blank" class="school-link">' + esc(s.url) + ' <i class="bi bi-box-arrow-up-right"></i></a></p></div>' +
                '<div class="page-actions"><a href="' + esc(s.sheet_url) + '" target="_blank" class="btn btn-light"><i class="bi bi-file-earmark-spreadsheet me-1"></i>Buka Google Sheet</a>' +
                '<button class="btn ' + (active ? 'btn-outline-danger' : 'btn-success') + '" id="toggleStatus"><i class="bi bi-' + (active ? 'pause' : 'play') + '-circle me-1"></i>' + (active ? 'Gantung' : 'Aktifkan') + '</button></div></div>' +
                (creds ? '<div class="alert alert-info">Kata laluan sementara untuk <strong>' + esc(creds.name) + '</strong>: <code class="fs-6 user-select-all px-2 py-1 bg-body rounded">' + esc(creds.password) + '</code><div class="small mt-1">Hantar kepada admin sekolah. Ia tidak akan dipaparkan lagi.</div></div>' : '') +
                (st.error ? '<div class="alert alert-danger">' + esc(st.error) + '</div>' : '') +
                '<div class="row g-3 mb-4">' + [['Pengguna aktif', st.users, 'people', 'primary'], ['Bilik khas', st.rooms, 'door-open', 'info'], ['Jumlah tempahan', st.bookings, 'calendar-check', 'success'], ['Tempahan bulan ini', st.month, 'graph-up', 'warning']].map(function (x) {
                    return '<div class="col-6 col-lg-3"><div class="stat-card"><div class="stat-icon bg-' + x[3] + '-subtle text-' + x[3] + '-emphasis"><i class="bi bi-' + x[2] + '"></i></div><div><div class="stat-value">' + x[1] + '</div><div class="stat-label">' + x[0] + '</div></div></div></div>';
                }).join('') + '</div>' +
                '<div class="row g-4"><div class="col-lg-7"><div class="card mb-4"><div class="card-header"><h2 class="card-title">Maklumat Sekolah</h2></div><div class="card-body"><form id="editSchool"><div class="row g-3">' +
                '<div class="col-md-8"><label class="form-label fw-semibold">Nama sekolah</label><input class="form-control" name="name" value="' + esc(s.name) + '" required></div>' +
                '<div class="col-md-4"><label class="form-label fw-semibold">Kod sekolah KPM</label><input class="form-control" name="school_code" value="' + esc(s.school_code) + '"></div>' +
                '<div class="col-md-6"><label class="form-label fw-semibold">Pegawai dihubungi</label><input class="form-control" name="contact_name" value="' + esc(s.contact_name) + '"></div>' +
                '<div class="col-md-6"><label class="form-label fw-semibold">Telefon</label><input class="form-control" name="contact_phone" value="' + esc(s.contact_phone) + '"></div>' +
                '<div class="col-12"><label class="form-label fw-semibold">Catatan dalaman</label><textarea class="form-control" name="notes" rows="2">' + esc(s.notes) + '</textarea></div></div>' +
                '<div class="form-text">Kod pautan <code>' + esc(s.slug) + '</code> tidak boleh ditukar.</div><button class="btn btn-primary mt-3">Simpan</button></form></div></div>' +
                '<div class="card border-danger-subtle"><div class="card-header"><h2 class="card-title text-danger"><i class="bi bi-trash me-2"></i>Padam Sekolah</h2></div><div class="card-body">' +
                '<p class="small">Sekolah dikeluarkan dari platform dan pautannya berhenti berfungsi. Google Sheet-nya <strong>tidak dipadam</strong>; ia dinamakan semula "[DIPADAM] …" dalam Drive anda supaya boleh dipulihkan.</p>' +
                '<form id="delSchool" class="d-flex flex-wrap gap-2"><input class="form-control" style="max-width:260px" name="confirm_slug" placeholder="Taip ' + esc(s.slug) + ' untuk sahkan" required autocomplete="off"><button class="btn btn-danger">Padam sekolah</button></form></div></div></div>' +
                '<div class="col-lg-5"><div class="card"><div class="card-header"><h2 class="card-title"><i class="bi bi-person-badge me-2"></i>Admin Sekolah</h2></div><ul class="list-group list-group-flush">' +
                (st.admins.length ? st.admins.map(function (a) {
                    return '<li class="list-group-item d-flex align-items-center gap-2"><span class="avatar avatar-sm">' + esc(A.initials(a.name)) + '</span><div class="flex-grow-1 min-w-0"><div class="fw-semibold small text-truncate">' + esc(a.name) + '</div>' +
                        '<div class="xsmall text-body-secondary">' + (a.last_login_at ? 'log masuk ' + A.fmtDateTime(a.last_login_at) : 'belum log masuk') + '</div></div>' +
                        '<button class="btn btn-sm btn-light" data-reset="' + a.id + '" data-name="' + esc(a.name) + '" title="Set semula kata laluan"><i class="bi bi-key"></i></button></li>';
                }).join('') : '<li class="list-group-item small text-body-secondary">Tiada admin.</li>') +
                '</ul><div class="card-body border-top"><form id="addAdmin" class="d-flex gap-2"><input class="form-control form-control-sm" name="name" placeholder="Nama admin baharu" required><button class="btn btn-sm btn-primary text-nowrap">Tambah</button></form></div></div></div></div>';

            $('#toggleStatus').onclick = function () {
                var btn = this;
                A.confirm(active ? 'Gantung sekolah ini? Semua guru dan admin sekolah tidak dapat log masuk.' : 'Aktifkan semula sekolah ini?', { btnClass: active ? 'btn-danger' : 'btn-success' }).then(function (ok) {
                    if (!ok) return;
                    A.busy(btn, true);
                    call('platform.school.setStatus', { id: s.id, status: active ? 'suspended' : 'active' }).then(function () {
                        A.toast(active ? 'Sekolah digantung.' : 'Sekolah diaktifkan semula.');
                        pageSchool(id);
                    }).catch(function (err) { A.busy(btn, false); A.showError(err); });
                });
            };
            $('#editSchool').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                call('platform.school.update', Object.assign(A.formData(this), { id: s.id })).then(function () { A.toast('Maklumat sekolah disimpan.'); pageSchool(id); })
                    .catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $('#delSchool').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                call('platform.school.delete', { id: s.id, confirm_slug: this.confirm_slug.value.trim() }).then(function () {
                    A.toast('Sekolah ' + s.name + ' dipadam.');
                    location.hash = '#/?fresh=1';
                }).catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $$('[data-reset]').forEach(function (b) {
                b.onclick = function () {
                    A.confirm('Jana kata laluan sementara baharu untuk ' + b.dataset.name + '?', { btnClass: 'btn-primary' }).then(function (ok) {
                        if (!ok) return;
                        call('platform.school.resetAdmin', { id: s.id, user_id: +b.dataset.reset }).then(function (r) { P.creds = r; pageSchool(id); }).catch(A.showError);
                    });
                };
            });
            $('#addAdmin').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                call('platform.school.resetAdmin', { id: s.id, name: this.name.value.trim() }).then(function (r) { P.creds = r; pageSchool(id); })
                    .catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
        }).catch(function (err) { $('#pView').innerHTML = A.empty('exclamation-octagon', err.message, '<a href="#/" class="btn btn-sm btn-light">Kembali</a>'); });
    }

    /* ---------- Audit & account ---------- */
    function pageAudit() {
        frame('Log Audit', 'audit', '');
        loading();
        call('platform.audit', {}).then(function (rows) {
            $('#pView').innerHTML = '<h1 class="page-title mb-4">Log Audit Platform</h1><div class="card"><div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Masa</th><th>Super Admin</th><th>Aktiviti</th><th>Butiran</th></tr></thead><tbody>' +
                rows.map(function (l) {
                    return '<tr><td class="small text-nowrap">' + A.fmtDateTime(l.created_at) + '</td><td class="small">' + esc(l.admin_email || '-') + '</td><td class="small font-monospace">' + esc(l.action) + '</td><td class="small">' + esc(l.details) + '</td></tr>';
                }).join('') + '</tbody></table></div></div>';
        }).catch(function (err) { $('#pView').innerHTML = A.empty('exclamation-octagon', err.message); });
    }

    function pageAccount() {
        frame('Akaun', 'account', '');
        loading();
        call('platform.account.list', {}).then(function (admins) {
            $('#pView').innerHTML = '<h1 class="page-title mb-4">Akaun Super Admin</h1><div class="row g-4"><div class="col-lg-6"><div class="card"><div class="card-header"><h2 class="card-title">Tukar Kata Laluan</h2></div><div class="card-body">' +
                '<form id="pwForm"><div class="mb-3"><label class="form-label fw-semibold">Kata laluan semasa</label><input type="password" class="form-control" name="current" required autocomplete="current-password"></div>' +
                '<div class="mb-3"><label class="form-label fw-semibold">Kata laluan baharu (min. 10 aksara)</label><input type="password" class="form-control" name="password" minlength="10" required autocomplete="new-password"></div>' +
                '<button class="btn btn-primary">Tukar</button></form></div></div></div>' +
                '<div class="col-lg-6"><div class="card"><div class="card-header"><h2 class="card-title">Super Admin</h2></div><ul class="list-group list-group-flush" id="adminList">' +
                admins.map(function (a) { return '<li class="list-group-item small"><strong>' + esc(a.name) + '</strong> · ' + esc(a.email) + '</li>'; }).join('') +
                '</ul><div class="card-body border-top"><form id="addSa" class="row g-2"><div class="col-12 small fw-semibold">Tambah Super Admin</div>' +
                '<div class="col-sm-6"><input class="form-control form-control-sm" name="name" placeholder="Nama" required></div><div class="col-sm-6"><input type="email" class="form-control form-control-sm" name="email" placeholder="E-mel" required></div>' +
                '<div class="col-sm-8"><input type="password" class="form-control form-control-sm" name="password" placeholder="Kata laluan (min. 10 aksara)" minlength="10" required autocomplete="new-password"></div>' +
                '<div class="col-sm-4"><button class="btn btn-sm btn-primary w-100">Tambah</button></div></form></div></div></div></div>';
            $('#pwForm').onsubmit = function (e) {
                e.preventDefault();
                var f = this, btn = $('button', f);
                A.busy(btn, true);
                call('platform.account.password', A.formData(f)).then(function () { A.toast('Kata laluan ditukar.'); f.reset(); A.busy(btn, false); })
                    .catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $('#addSa').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                call('platform.account.add', A.formData(this)).then(function () { A.toast('Super Admin ditambah.'); pageAccount(); })
                    .catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
        }).catch(function (err) { $('#pView').innerHTML = A.empty('exclamation-octagon', err.message); });
    }

    return {
        start: function () {
            if (P.token) boot(); else showLogin();
        },
    };
})(window.App);
