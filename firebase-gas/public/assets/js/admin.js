/* Sistem Tempahan Bilik Khas — admin pages */
(function (A) {
    'use strict';
    var $ = A.$, $$ = A.$$, esc = A.esc, S = A.S;

    function opt(value, label, selected) {
        return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
    }

    /* ==================================================================
     * Booking records
     * ================================================================== */
    A.route('admin/bookings', { title: 'Rekod Tempahan', admin: true, render: function (ctx) {
        var f = ctx.params;
        return Promise.all([A.api('admin.bookings', f), A.api('admin.users.list')]).then(function (res) {
            if (!ctx.alive()) return;
            var d = res[0], users = res[1];
            var h = A.pageTitle('Rekod Tempahan', 'Semak, luluskan dan urus semua tempahan bilik khas.',
                '<button class="btn btn-light" id="exportCsv"><i class="bi bi-filetype-csv me-1"></i>Eksport CSV</button><button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button>') +
                '<div class="d-flex flex-wrap gap-2 mb-3 no-print"><a href="#/admin/bookings" class="btn btn-sm ' + (!f.status ? 'btn-primary' : 'btn-light') + '">Semua <span class="opacity-75">(' + d.counts.all + ')</span></a>' +
                Object.keys(A.STATUS).map(function (k) {
                    return '<a href="' + A.link('admin/bookings', { status: k }) + '" class="btn btn-sm ' + (f.status === k ? 'btn-' + A.STATUS[k][1] : 'btn-light') + '">' + A.STATUS[k][0] + ' <span class="opacity-75">(' + (d.counts[k] || 0) + ')</span></a>';
                }).join('') + '</div>' +
                '<div class="card mb-3 no-print"><div class="card-body"><form class="row g-2 align-items-end" id="filters">' +
                '<input type="hidden" name="status" value="' + esc(f.status || '') + '">' +
                '<div class="col-6 col-md-2"><label class="form-label small fw-semibold">Dari</label><input type="date" name="from" class="form-control form-control-sm" value="' + esc(f.from || '') + '"></div>' +
                '<div class="col-6 col-md-2"><label class="form-label small fw-semibold">Hingga</label><input type="date" name="to" class="form-control form-control-sm" value="' + esc(f.to || '') + '"></div>' +
                '<div class="col-md-2"><label class="form-label small fw-semibold">Bilik</label><select name="room_id" class="form-select form-select-sm"><option value="">Semua</option>' + S.rooms.map(function (r) { return opt(r.id, r.name, f.room_id); }).join('') + '</select></div>' +
                '<div class="col-md-2"><label class="form-label small fw-semibold">Guru</label><select name="user_id" class="form-select form-select-sm"><option value="">Semua</option>' + users.map(function (u) { return opt(u.id, u.name, f.user_id); }).join('') + '</select></div>' +
                '<div class="col-md-2"><label class="form-label small fw-semibold">Carian</label><input name="q" class="form-control form-control-sm" value="' + esc(f.q || '') + '" placeholder="No. rujukan, tujuan…"></div>' +
                '<div class="col-md-2 d-flex gap-1"><button class="btn btn-sm btn-primary flex-grow-1"><i class="bi bi-funnel me-1"></i>Tapis</button><a href="#/admin/bookings" class="btn btn-sm btn-light" title="Set semula"><i class="bi bi-arrow-counterclockwise"></i></a></div></form></div></div>' +
                '<div class="card"><div class="card-header d-flex flex-wrap gap-2 align-items-center no-print bulk-bar"><span class="small text-body-secondary"><span id="selCount">0</span> dipilih</span>' +
                '<input id="bulkRemark" class="form-control form-control-sm" style="max-width:260px" placeholder="Catatan (pilihan)">' +
                '<button data-bulk="approved" class="btn btn-sm btn-success"><i class="bi bi-check-lg me-1"></i>Luluskan</button><button data-bulk="rejected" class="btn btn-sm btn-outline-danger"><i class="bi bi-x-lg me-1"></i>Tolak</button>' +
                '<button data-bulk="cancelled" class="btn btn-sm btn-outline-secondary"><i class="bi bi-slash-circle me-1"></i>Batalkan</button><span class="ms-auto small text-body-secondary">' + d.total + ' rekod</span></div>' +
                '<div class="print-only p-3"><h2 class="h5 mb-0">Rekod Tempahan Bilik Khas – ' + esc(S.settings.school_name) + '</h2><div class="small">Dicetak pada ' + A.fmtDate(A.todayIso()) + '</div></div>' +
                (d.rows.length ? '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th class="no-print" style="width:36px"><input type="checkbox" class="form-check-input" id="checkAll"></th><th>Rujukan</th><th>Tarikh &amp; Masa</th><th>Bilik</th><th>Guru</th><th>Tujuan</th><th>Status</th><th class="no-print"></th></tr></thead><tbody>' +
                    d.rows.map(function (b) {
                        return '<tr><td class="no-print"><input type="checkbox" class="form-check-input row-check" value="' + b.id + '"></td><td class="font-monospace small">' + esc(b.ref_no) + '</td>' +
                            '<td class="text-nowrap"><div class="fw-semibold small">' + A.fmtDate(b.date, true, true) + '</div><div class="xsmall text-body-secondary">' + b.start_time + ' – ' + b.end_time + '</div></td>' +
                            '<td class="small">' + A.dot(b.room_color) + esc(b.room_name) + '</td><td class="small">' + esc(b.user_name) + '</td>' +
                            '<td class="small">' + esc(b.purpose) + (b.class_name ? '<div class="xsmall text-body-secondary">' + esc(b.class_name) + (b.subject ? ' · ' + esc(b.subject) : '') + '</div>' : '') + '</td>' +
                            '<td>' + A.statusBadge(b.status) + '</td><td class="text-end no-print"><a href="#/booking?id=' + b.id + '" class="btn btn-sm btn-light"><i class="bi bi-chevron-right"></i></a></td></tr>';
                    }).join('') + '</tbody></table></div><div class="card-footer no-print">' + A.pager(d.page, d.pages, function (n) { A.go('admin/bookings', Object.assign({}, f, { page: n })); }) + '</div>'
                    : A.empty('inbox', 'Tiada rekod tempahan ditemui.')) + '</div>';
            ctx.view.innerHTML = h;

            $('#filters').onsubmit = function (e) { e.preventDefault(); A.go('admin/bookings', A.formData(this)); };
            var boxes = $$('.row-check'), all = $('#checkAll');
            var update = function () {
                var n = boxes.filter(function (b) { return b.checked; }).length;
                $('#selCount').textContent = n;
                $$('[data-bulk]').forEach(function (b) { b.disabled = !n; });
            };
            if (all) all.onchange = function () { boxes.forEach(function (b) { b.checked = all.checked; }); update(); };
            boxes.forEach(function (b) { b.onchange = update; });
            update();
            $$('[data-bulk]').forEach(function (btn) {
                btn.onclick = function () {
                    var ids = boxes.filter(function (b) { return b.checked; }).map(function (b) { return +b.value; });
                    A.busy(btn, true);
                    A.api('booking.setStatus', { ids: ids, status: btn.dataset.bulk, remark: $('#bulkRemark').value.trim() }).then(function (r) {
                        if (r.done) A.toast(r.done + ' tempahan dikemas kini.');
                        if (r.errors.length) A.toast(r.errors.slice(0, 5).join(' '), 'warning');
                        A.reload();
                    }).catch(function (e) { A.busy(btn, false); A.showError(e); });
                };
            });
            $('#exportCsv').onclick = function () {
                var btn = this;
                A.busy(btn, true);
                A.api('admin.bookings', Object.assign({}, f, { all: true })).then(function (x) {
                    A.busy(btn, false);
                    A.csvDownload('rekod-tempahan-' + A.todayIso() + '.csv',
                        ['No. Rujukan', 'Tarikh', 'Hari', 'Mula', 'Tamat', 'Bilik', 'Guru', 'Panitia/Unit', 'Tujuan', 'Kelas', 'Subjek', 'Peserta', 'Status', 'Catatan', 'Catatan Pentadbir', 'Dibuat'],
                        x.rows.map(function (b) {
                            return [b.ref_no, b.date, A.dayName(b.date), b.start_time, b.end_time, b.room_name, b.user_name, b.user_department, b.purpose, b.class_name, b.subject, b.attendees, A.STATUS[b.status][0], b.notes, b.admin_remark, b.created_at];
                        }));
                }).catch(function (e) { A.busy(btn, false); A.showError(e); });
            };
        });
    } });

    /* ==================================================================
     * Rooms
     * ================================================================== */
    A.route('admin/rooms', { title: 'Urus Bilik Khas', admin: true, render: function (ctx) {
        return A.refreshSession().then(function () {
            if (!ctx.alive()) return;
            var p = ctx.params;
            var form = p.edit ? A.room(p.edit) : p.new ? { id: 0, code: '', name: '', category: '', location: '', capacity: 30, facilities: '', description: '', pic_name: '', color: '#1d4ed8', status: 'active', requires_approval: 0 } : null;
            var cats = S.rooms.map(function (r) { return r.category; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; });
            var mode = S.settings.approval_mode || 'auto';
            var h = A.pageTitle('Urus Bilik Khas', 'Tambah, kemas kini dan tetapkan status bilik khas.', '<a href="#/admin/rooms?new=1" class="btn btn-primary"><i class="bi bi-plus-lg me-1"></i>Tambah Bilik</a>');
            if (form) {
                h += '<div class="card mb-4 border-primary-subtle"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title">' + (form.id ? 'Kemas Kini: ' + esc(form.name) : 'Tambah Bilik Khas Baharu') + '</h2><a href="#/admin/rooms" class="btn-close"></a></div><div class="card-body"><form id="roomForm"><input type="hidden" name="id" value="' + form.id + '"><div class="row g-3">' +
                    '<div class="col-md-2"><label class="form-label fw-semibold">Kod <span class="text-danger">*</span></label><input class="form-control text-uppercase" name="code" value="' + esc(form.code) + '" maxlength="10" required></div>' +
                    '<div class="col-md-5"><label class="form-label fw-semibold">Nama bilik <span class="text-danger">*</span></label><input class="form-control" name="name" value="' + esc(form.name) + '" required></div>' +
                    '<div class="col-md-3"><label class="form-label fw-semibold">Kategori</label><input class="form-control" name="category" value="' + esc(form.category) + '" list="catList" placeholder="cth. Makmal"><datalist id="catList">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div>' +
                    '<div class="col-md-2"><label class="form-label fw-semibold">Warna</label><input type="color" class="form-control form-control-color w-100" name="color" value="' + esc(form.color) + '"></div>' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">Lokasi</label><input class="form-control" name="location" value="' + esc(form.location) + '" placeholder="cth. Blok A, Aras 2"></div>' +
                    '<div class="col-md-2"><label class="form-label fw-semibold">Kapasiti</label><input type="number" class="form-control" name="capacity" value="' + (form.capacity || 0) + '" min="0"></div>' +
                    '<div class="col-md-3"><label class="form-label fw-semibold">Penyelaras / PIC</label><input class="form-control" name="pic_name" value="' + esc(form.pic_name) + '"></div>' +
                    '<div class="col-md-3"><label class="form-label fw-semibold">Status</label><select name="status" class="form-select">' + Object.keys(A.ROOM_STATUS).map(function (k) { return opt(k, A.ROOM_STATUS[k][0], form.status); }).join('') + '</select></div>' +
                    '<div class="col-md-6"><label class="form-label fw-semibold">Kemudahan</label><input class="form-control" name="facilities" value="' + esc(form.facilities) + '" placeholder="Pisahkan dengan koma: Projektor, Pendingin hawa, …"></div>' +
                    '<div class="col-md-6"><label class="form-label fw-semibold">Keterangan / Peraturan</label><input class="form-control" name="description" value="' + esc(form.description) + '"></div>' +
                    '<div class="col-12"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" role="switch" name="requires_approval" id="ra"' + (+form.requires_approval ? ' checked' : '') + '>' +
                    '<label class="form-check-label" for="ra"><strong>Perlu kelulusan pentadbir</strong> <span class="text-body-secondary small">— tempahan guru akan berstatus "Menunggu" sehingga diluluskan</span></label></div>' +
                    (mode !== 'room' ? '<div class="form-text"><i class="bi bi-info-circle me-1"></i>Mod kelulusan semasa ialah <strong>' + A.APPROVAL_MODES[mode][0] + '</strong>, jadi tetapan ini hanya berkuat kuasa jika mod ditukar kepada "Ikut tetapan bilik" di <a href="#/admin/settings">Tetapan Sistem</a>.</div>' : '') +
                    '</div></div><div class="mt-4 d-flex gap-2"><button class="btn btn-primary px-4"><i class="bi bi-save me-1"></i>Simpan</button><a href="#/admin/rooms" class="btn btn-light">Batal</a></div></form></div></div>';
            }
            h += '<div class="card"><div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Bilik</th><th>Kategori</th><th>Lokasi</th><th class="text-center">Kapasiti</th><th class="text-center">Kelulusan</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead><tbody>' +
                S.rooms.slice().sort(function (a, b) { return (a.category + a.name).localeCompare(b.category + b.name); }).map(function (r) {
                    return '<tr><td>' + A.dot(r.color) + '<strong>' + esc(r.name) + '</strong><div class="xsmall text-body-secondary font-monospace">' + esc(r.code) + '</div></td><td class="small">' + esc(r.category) + '</td><td class="small">' + esc(r.location) + '</td>' +
                        '<td class="text-center">' + r.capacity + '</td><td class="text-center">' + (A.roomNeedsApproval(r) ? '<i class="bi bi-shield-lock text-warning" title="Perlu kelulusan"></i>' : '<i class="bi bi-lightning-charge text-success" title="Automatik"></i>') + '</td>' +
                        '<td>' + A.roomStatusBadge(r.status) + '</td><td class="text-end text-nowrap"><a href="' + A.link('calendar', { room_id: r.id }) + '" class="btn btn-sm btn-light" title="Jadual"><i class="bi bi-calendar3"></i></a> ' +
                        '<a href="' + A.link('admin/rooms', { edit: r.id }) + '" class="btn btn-sm btn-light" title="Kemas kini"><i class="bi bi-pencil"></i></a> <button class="btn btn-sm btn-light text-danger" data-del="' + r.id + '" data-name="' + esc(r.name) + '" title="Padam"><i class="bi bi-trash"></i></button></td></tr>';
                }).join('') + '</tbody></table></div></div>';
            ctx.view.innerHTML = h;
            if (form) {
                $('#roomForm').onsubmit = function (e) {
                    e.preventDefault();
                    var btn = $('button', this);
                    A.busy(btn, true);
                    A.api('admin.rooms.save', A.formData(this)).then(function (r) {
                        A.toast('Bilik ' + r.name + ' disimpan.');
                        A.go('admin/rooms');
                    }).catch(function (err) { A.busy(btn, false); A.showError(err); });
                };
            }
            $$('[data-del]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.confirm('Padam bilik ' + btn.dataset.name + '?').then(function (ok) {
                        if (ok) A.api('admin.rooms.delete', { id: +btn.dataset.del }).then(function () { A.toast('Bilik dipadam.'); A.reload(); }).catch(A.showError);
                    });
                };
            });
        });
    } });

    /* ==================================================================
     * Users — admin registers teacher names
     * ================================================================== */
    A.route('admin/users', { title: 'Daftar & Urus Guru', admin: true, render: function (ctx) {
        return A.api('admin.users.list').then(function (users) {
            if (!ctx.alive()) return;
            var p = ctx.params, status = p.status || '', q = (p.q || '').toLowerCase();
            var form = p.edit ? users.filter(function (u) { return u.id === +p.edit; })[0] : p.new ? { id: 0, name: '', email: '', phone: '', department: '', role: 'guru' } : null;
            var counts = { '': users.length, active: 0, pending: 0, inactive: 0 };
            users.forEach(function (u) { counts[u.status]++; });
            var list = users.filter(function (u) { return (!status || u.status === status) && (!q || (u.name + ' ' + u.email + ' ' + u.department).toLowerCase().indexOf(q) !== -1); });
            var h = A.pageTitle('Daftar & Urus Guru', 'Daftarkan nama guru. Guru akan memilih nama mereka di halaman log masuk dan mendaftarkan No. KP sendiri sebagai kata laluan.',
                '<button class="btn btn-light" data-bs-toggle="collapse" data-bs-target="#importBox"><i class="bi bi-upload me-1"></i>Import Pukal</button><a href="#/admin/users?new=1" class="btn btn-primary"><i class="bi bi-person-plus me-1"></i>Daftar Guru</a>');
            h += '<div class="collapse mb-4" id="importBox"><div class="card"><div class="card-header"><h2 class="card-title">Import Pukal Guru</h2></div><div class="card-body"><form id="importForm">' +
                '<label class="form-label small">Satu guru setiap baris: <code>Nama, Panitia (pilihan), E-mel (pilihan)</code>. Anda juga boleh salin terus dari Excel / Google Sheets.</label>' +
                '<textarea name="text" class="form-control font-monospace" rows="6" placeholder="Siti Aminah binti Ali, Bahasa Melayu&#10;Lim Wei Ming, Matematik&#10;Rahman bin Yusof"></textarea>' +
                '<button class="btn btn-primary mt-3">Import</button></form></div></div></div>';
            if (form) {
                h += '<div class="card mb-4 border-primary-subtle"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title">' + (form.id ? 'Kemas Kini Maklumat Guru' : 'Daftar Guru Baharu') + '</h2><a href="#/admin/users" class="btn-close"></a></div><div class="card-body">' +
                    '<form id="userForm"><input type="hidden" name="id" value="' + form.id + '"><div class="row g-3">' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">Nama penuh <span class="text-danger">*</span></label><input class="form-control" name="name" value="' + esc(form.name) + '" required></div>' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">Panitia / Unit</label><input class="form-control" name="department" value="' + esc(form.department) + '"></div>' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">Peranan</label><select name="role" class="form-select">' + opt('guru', 'Guru', form.role) + opt('admin', 'Pentadbir', form.role) + '</select></div>' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">No. telefon</label><input class="form-control" name="phone" value="' + esc(form.phone) + '"></div>' +
                    '<div class="col-md-4"><label class="form-label fw-semibold">E-mel <span class="fw-normal text-body-secondary">(pilihan, untuk notifikasi)</span></label><input type="email" class="form-control" name="email" value="' + esc(form.email) + '"></div></div>' +
                    '<div class="form-text mt-2"><i class="bi bi-info-circle me-1"></i>Tiada kata laluan perlu ditetapkan. Kali pertama log masuk, guru memilih nama ini dan mendaftarkan No. Kad Pengenalan sendiri sebagai kata laluan.</div>' +
                    '<div class="mt-3 d-flex gap-2"><button class="btn btn-primary px-4">Simpan</button><a href="#/admin/users" class="btn btn-light">Batal</a></div></form></div></div>';
            }
            var tabs = { '': 'Semua', active: 'Aktif', pending: 'Menunggu Pengesahan', inactive: 'Tidak Aktif' };
            h += '<div class="card"><div class="card-header d-flex flex-wrap gap-2 justify-content-between align-items-center"><ul class="nav nav-pills nav-pills-soft">' +
                Object.keys(tabs).map(function (k) { return '<li class="nav-item"><a class="nav-link' + (status === k ? ' active' : '') + '" href="' + A.link('admin/users', { status: k }) + '">' + tabs[k] + ' <span class="badge rounded-pill">' + counts[k] + '</span></a></li>'; }).join('') +
                '</ul><form id="userSearch"><div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="' + esc(p.q || '') + '" placeholder="Cari nama / e-mel…"></div></form></div>' +
                (list.length ? '<div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr><th>Guru</th><th>Panitia / Unit</th><th>Peranan</th><th class="text-center">Tempahan</th><th>Kata laluan</th><th>Log masuk terakhir</th><th>Status</th><th class="text-end">Tindakan</th></tr></thead><tbody>' +
                    list.map(function (u) {
                        var me = u.id === S.user.id;
                        var st = { active: '<span class="badge badge-soft-success">Aktif</span>', pending: '<span class="badge badge-soft-warning">Menunggu</span>', inactive: '<span class="badge badge-soft-secondary">Tidak aktif</span>' }[u.status];
                        return '<tr><td><div class="d-flex align-items-center gap-2"><span class="avatar avatar-sm">' + esc(A.initials(u.name)) + '</span><div><div class="fw-semibold">' + esc(u.name) + (me ? ' <span class="xsmall text-body-secondary">(anda)</span>' : '') + '</div><div class="xsmall text-body-secondary">' + esc(u.email || '') + '</div></div></div></td>' +
                            '<td class="small">' + esc(u.department || '-') + '</td><td>' + (u.role === 'admin' ? '<span class="badge badge-soft-primary">Pentadbir</span>' : '<span class="badge badge-soft-secondary">Guru</span>') + '</td>' +
                            '<td class="text-center"><a href="' + A.link('admin/bookings', { user_id: u.id }) + '">' + u.bookings + '</a></td>' +
                            '<td>' + (u.activated ? '<span class="badge badge-soft-success"><i class="bi bi-key me-1"></i>Sudah daftar</span>' : '<span class="badge badge-soft-secondary">Belum daftar</span>') + '</td><td class="small">' + (u.last_login_at ? A.fmtDateTime(u.last_login_at) : '<span class="text-body-tertiary">Belum pernah</span>') + '</td><td>' + st + '</td>' +
                            '<td class="text-end text-nowrap">' + (u.status === 'pending' ? '<button class="btn btn-sm btn-success" data-status="active" data-id="' + u.id + '"><i class="bi bi-check-lg me-1"></i>Sahkan</button> ' : '') +
                            '<div class="dropdown d-inline"><button class="btn btn-sm btn-light" data-bs-toggle="dropdown"><i class="bi bi-three-dots"></i></button><ul class="dropdown-menu dropdown-menu-end shadow">' +
                            '<li><a class="dropdown-item" href="' + A.link('admin/users', { edit: u.id }) + '"><i class="bi bi-pencil me-2"></i>Kemas kini</a></li>' +
                            (u.activated && !me ? '<li><button class="dropdown-item" data-reset="' + u.id + '" data-name="' + esc(u.name) + '"><i class="bi bi-key me-2"></i>Set semula kata laluan</button></li>' : '') +
                            (me ? '' : (u.status === 'active' ? '<li><button class="dropdown-item" data-status="inactive" data-id="' + u.id + '"><i class="bi bi-person-slash me-2"></i>Nyahaktifkan</button></li>'
                                : u.status === 'inactive' ? '<li><button class="dropdown-item" data-status="active" data-id="' + u.id + '"><i class="bi bi-person-check me-2"></i>Aktifkan</button></li>' : '') +
                                (!u.bookings ? '<li><hr class="dropdown-divider"></li><li><button class="dropdown-item text-danger" data-delete="' + u.id + '" data-name="' + esc(u.name) + '"><i class="bi bi-trash me-2"></i>Padam</button></li>' : '')) +
                            '</ul></div></td></tr>';
                    }).join('') + '</tbody></table></div>' : A.empty('people', 'Tiada pengguna ditemui.')) + '</div>';
            ctx.view.innerHTML = h;

            if (form) {
                $('#userForm').onsubmit = function (e) {
                    e.preventDefault();
                    var btn = $('button', this);
                    A.busy(btn, true);
                    A.api('admin.users.save', A.formData(this)).then(function (u) {
                        A.toast((form.id ? 'Maklumat ' : 'Guru ') + u.name + (form.id ? ' dikemas kini.' : ' berjaya didaftarkan. Nama ini kini tersedia di halaman log masuk.'));
                        A.go('admin/users');
                    }).catch(function (err) { A.busy(btn, false); A.showError(err); });
                };
            }
            $('#importForm').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                A.api('admin.users.import', { text: this.text.value }).then(function (r) {
                    A.toast(r.created + ' guru didaftarkan.' + (r.skipped.length ? ' Dilangkau: ' + r.skipped.slice(0, 10).join(', ') : ''), r.created ? 'success' : 'warning');
                    A.reload();
                }).catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $('#userSearch').onsubmit = function (e) { e.preventDefault(); A.go('admin/users', { status: status, q: this.q.value }); };
            $$('[data-status]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.api('admin.users.setStatus', { id: +btn.dataset.id, status: btn.dataset.status }).then(function () { A.toast('Status akaun dikemas kini.'); A.reload(); }).catch(A.showError);
                };
            });
            $$('[data-reset]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.confirm('Set semula kata laluan ' + btn.dataset.name + '? Guru perlu mendaftarkan No. KP sebagai kata laluan semula pada log masuk seterusnya.', { btnClass: 'btn-primary' }).then(function (ok) {
                        if (ok) A.api('admin.users.resetPassword', { id: +btn.dataset.reset }).then(function () { A.toast('Kata laluan ' + btn.dataset.name + ' telah ditetapkan semula.'); A.reload(); }).catch(A.showError);
                    });
                };
            });
            $$('[data-delete]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.confirm('Padam akaun ' + btn.dataset.name + ' secara kekal?').then(function (ok) {
                        if (ok) A.api('admin.users.delete', { id: +btn.dataset.delete }).then(function () { A.toast('Akaun dipadam.'); A.reload(); }).catch(A.showError);
                    });
                };
            });
        });
    } });

    /* ==================================================================
     * Closures
     * ================================================================== */
    A.route('admin/closures', { title: 'Penutupan & Cuti', admin: true, render: function (ctx) {
        var past = ctx.params.past === '1';
        return A.api('admin.closures.list', { past: past }).then(function (rows) {
            if (!ctx.alive()) return;
            ctx.view.innerHTML = A.pageTitle('Penutupan & Cuti', 'Tutup bilik untuk cuti umum, cuti sekolah, peperiksaan atau penyelenggaraan. Tempahan tidak dibenarkan pada tarikh ditutup.') +
                '<div class="row g-4"><div class="col-lg-4"><div class="card"><div class="card-header"><h2 class="card-title"><i class="bi bi-calendar-x me-2"></i>Tambah Penutupan</h2></div><div class="card-body"><form id="closureForm">' +
                '<div class="mb-3"><label class="form-label fw-semibold">Bilik</label><select name="room_id" class="form-select"><option value="">Semua bilik (cuti / sekolah ditutup)</option>' + S.rooms.map(function (r) { return opt(r.id, r.name); }).join('') + '</select></div>' +
                '<div class="row g-2 mb-3"><div class="col"><label class="form-label fw-semibold">Dari</label><input type="date" name="start_date" class="form-control" required></div><div class="col"><label class="form-label fw-semibold">Hingga</label><input type="date" name="end_date" class="form-control"></div></div>' +
                '<div class="mb-3"><label class="form-label fw-semibold">Sebab</label><input name="reason" class="form-control" required list="reasonList" placeholder="cth. Cuti Hari Malaysia"><datalist id="reasonList"><option value="Cuti Umum"><option value="Cuti Sekolah"><option value="Penyelenggaraan"><option value="Peperiksaan SPM"><option value="Program Sekolah"></datalist></div>' +
                '<div class="form-check mb-3"><input class="form-check-input" type="checkbox" name="cancel_existing" id="ce"><label class="form-check-label small" for="ce">Batalkan tempahan sedia ada dalam tempoh ini &amp; maklumkan guru</label></div>' +
                '<button class="btn btn-primary w-100">Tambah</button></form></div></div></div>' +
                '<div class="col-lg-8"><div class="card"><div class="card-header d-flex justify-content-between align-items-center"><h2 class="card-title">' + (past ? 'Penutupan Lepas' : 'Penutupan Semasa & Akan Datang') + '</h2>' +
                '<a href="' + A.link('admin/closures', past ? {} : { past: 1 }) + '" class="btn btn-sm btn-light">' + (past ? 'Lihat akan datang' : 'Lihat lepas') + '</a></div>' +
                (rows.length ? '<div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Tarikh</th><th>Bilik</th><th>Sebab</th><th class="text-center">Tempahan terjejas</th><th></th></tr></thead><tbody>' +
                    rows.map(function (c) {
                        return '<tr><td class="small text-nowrap"><strong>' + A.fmtDate(c.start_date, false, true) + '</strong>' + (c.end_date !== c.start_date ? '<br>hingga ' + A.fmtDate(c.end_date, false, true) : '') + '</td>' +
                            '<td class="small">' + (c.room_name ? A.dot(c.room_color) + esc(c.room_name) : '<span class="badge badge-soft-danger">Semua bilik</span>') + '</td>' +
                            '<td class="small">' + esc(c.reason) + '<div class="xsmall text-body-secondary">oleh ' + esc(c.creator) + '</div></td>' +
                            '<td class="text-center">' + (c.affected ? '<span class="badge badge-soft-warning">' + c.affected + '</span>' : '<span class="text-body-tertiary">0</span>') + '</td>' +
                            '<td class="text-end"><button class="btn btn-sm btn-light text-danger" data-del="' + c.id + '"><i class="bi bi-trash"></i></button></td></tr>';
                    }).join('') + '</tbody></table></div>' : A.empty('calendar-check', 'Tiada penutupan direkodkan.')) + '</div></div></div>';
            $('#closureForm').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button', this);
                A.busy(btn, true);
                A.api('admin.closures.save', A.formData(this)).then(function (r) {
                    A.toast('Penutupan berjaya ditambah.' + (r.cancelled ? ' ' + r.cancelled + ' tempahan terlibat telah dibatalkan dan guru dimaklumkan.' : ''));
                    A.reload();
                }).catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $$('[data-del]', ctx.view).forEach(function (btn) {
                btn.onclick = function () {
                    A.confirm('Padam penutupan ini? Bilik akan dibuka semula untuk tempahan.').then(function (ok) {
                        if (ok) A.api('admin.closures.delete', { id: +btn.dataset.del }).then(function () { A.toast('Penutupan dipadam.'); A.reload(); }).catch(A.showError);
                    });
                };
            });
        });
    } });

    /* ==================================================================
     * School periods
     * ================================================================== */
    A.route('admin/periods', { title: 'Waktu Persekolahan', admin: true, render: function (ctx) {
        var row = function (pr) {
            return '<tr data-id="' + (pr.id || '') + '"><td><input class="form-control form-control-sm" data-f="label" value="' + esc(pr.label || '') + '" placeholder="' + (pr.id ? '' : '+ Tambah waktu baharu') + '"></td>' +
                '<td><input type="time" class="form-control form-control-sm" data-f="start_time" value="' + esc(pr.start_time || '') + '"></td><td><input type="time" class="form-control form-control-sm" data-f="end_time" value="' + esc(pr.end_time || '') + '"></td>' +
                '<td class="text-center"><input type="checkbox" class="form-check-input" data-f="is_break"' + (+pr.is_break ? ' checked' : '') + '></td>' +
                '<td class="text-end"><button type="button" class="btn btn-sm btn-light text-danger" data-remove><i class="bi bi-trash"></i></button></td></tr>';
        };
        ctx.view.innerHTML = A.pageTitle('Waktu Persekolahan', 'Waktu ini dipaparkan sebagai pilihan pantas semasa menempah dan sebagai lajur dalam paparan kekosongan.') +
            '<div class="card" style="max-width:820px"><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Label</th><th>Mula</th><th>Tamat</th><th class="text-center">Rehat</th><th></th></tr></thead><tbody id="periodRows">' +
            S.periods.map(row).join('') + row({}) + '</tbody></table></div><div class="card-footer d-flex gap-2"><button class="btn btn-light" id="addRow"><i class="bi bi-plus-lg me-1"></i>Tambah baris</button><button class="btn btn-primary" id="savePeriods"><i class="bi bi-save me-1"></i>Simpan Semua</button></div></div>';
        var tbody = $('#periodRows');
        var bindRemove = function () { $$('[data-remove]', tbody).forEach(function (b) { b.onclick = function () { b.closest('tr').remove(); }; }); };
        bindRemove();
        $('#addRow').onclick = function () { tbody.insertAdjacentHTML('beforeend', row({})); bindRemove(); };
        $('#savePeriods').onclick = function () {
            var btn = this;
            var periods = $$('tr', tbody).map(function (tr) {
                var g = function (f) { return $('[data-f="' + f + '"]', tr); };
                return { id: tr.dataset.id ? +tr.dataset.id : 0, label: g('label').value.trim(), start_time: g('start_time').value, end_time: g('end_time').value, is_break: g('is_break').checked };
            });
            A.busy(btn, true);
            A.api('admin.periods.save', { periods: periods }).then(function (r) {
                S.periods = r.periods;
                A.toast(r.invalid ? 'Disimpan, tetapi ' + r.invalid + ' baris tidak sah diabaikan.' : 'Waktu persekolahan dikemas kini.', r.invalid ? 'warning' : 'success');
                A.reload();
            }).catch(function (err) { A.busy(btn, false); A.showError(err); });
        };
    } });

    /* ==================================================================
     * Reports
     * ================================================================== */
    A.route('admin/reports', { title: 'Laporan & Analitik', admin: true, render: function (ctx) {
        var p = ctx.params;
        return Promise.all([A.api('admin.reports', { from: p.from, to: p.to }), A.loadScript(A.vendor.chart)]).then(function (res) {
            if (!ctx.alive()) return;
            var d = res[0], s = d.summary, t = A.todayIso();
            var monthStart = t.slice(0, 8) + '01';
            var lastDay = function (iso) { return A.addDays(A.addDays(iso.slice(0, 8) + '28', 4).slice(0, 8) + '01', -1); };
            var lm = A.addDays(monthStart, -1);
            var dow = new Date(t + 'T00:00:00').getDay();
            var mon = A.addDays(t, -((dow + 6) % 7));
            var presets = [['Bulan ini', monthStart, lastDay(t)], ['Bulan lepas', lm.slice(0, 8) + '01', lm], ['Minggu ini', mon, A.addDays(mon, 6)], ['Tahun ini', t.slice(0, 4) + '-01-01', t.slice(0, 4) + '-12-31']];
            var tiles = [['Jumlah Permohonan', s.total, 'clipboard-data', 'primary'], ['Diluluskan', s.approved, 'check-circle', 'success'], ['Jumlah Jam Digunakan', Math.round(s.minutes / 6) / 10, 'clock-history', 'info'],
                ['Guru Terlibat', s.teachers, 'people', 'warning'], ['Hari Persekolahan', d.schoolDays, 'calendar-week', 'secondary'], ['Kadar Penggunaan Purata', d.avgUtil + '%', 'speedometer2', 'danger']];
            ctx.view.innerHTML = A.pageTitle('Laporan & Analitik', 'Statistik penggunaan bilik khas bagi ' + A.fmtDate(d.from) + ' hingga ' + A.fmtDate(d.to) + '.',
                '<button class="btn btn-light" id="exportReport"><i class="bi bi-filetype-csv me-1"></i>Eksport CSV</button><button class="btn btn-light" onclick="window.print()"><i class="bi bi-printer me-1"></i>Cetak</button>') +
                '<div class="card mb-4 no-print"><div class="card-body d-flex flex-wrap gap-2 align-items-end"><form class="d-flex flex-wrap gap-2 align-items-end" id="rangeForm">' +
                '<div><label class="form-label small fw-semibold">Dari</label><input type="date" name="from" class="form-control form-control-sm" value="' + d.from + '"></div><div><label class="form-label small fw-semibold">Hingga</label><input type="date" name="to" class="form-control form-control-sm" value="' + d.to + '"></div>' +
                '<button class="btn btn-sm btn-primary">Jana Laporan</button></form><div class="ms-md-auto d-flex flex-wrap gap-1">' +
                presets.map(function (x) { return '<a href="' + A.link('admin/reports', { from: x[1], to: x[2] }) + '" class="btn btn-sm ' + (x[1] === d.from && x[2] === d.to ? 'btn-primary' : 'btn-light') + '">' + x[0] + '</a>'; }).join('') + '</div></div></div>' +
                '<div class="print-only mb-3"><h2 class="h4 mb-0">Laporan Penggunaan Bilik Khas</h2><div>' + esc(S.settings.school_name) + ' · ' + A.fmtDate(d.from) + ' – ' + A.fmtDate(d.to) + '</div></div>' +
                '<div class="row g-3 mb-4">' + tiles.map(function (x) {
                    return '<div class="col-6 col-md-4 col-xl-2"><div class="stat-card stat-card-sm"><div class="stat-icon bg-' + x[3] + '-subtle text-' + x[3] + '-emphasis"><i class="bi bi-' + x[2] + '"></i></div><div><div class="stat-value">' + x[1] + '</div><div class="stat-label">' + x[0] + '</div></div></div></div>';
                }).join('') + '</div>' +
                '<div class="row g-4 mb-4"><div class="col-lg-8"><div class="card h-100"><div class="card-header"><h2 class="card-title">Penggunaan Mengikut Bilik</h2></div><div class="table-responsive"><table class="table align-middle mb-0"><thead><tr><th>Bilik</th><th class="text-center">Tempahan</th><th class="text-center">Jam</th><th style="width:38%">Kadar penggunaan</th></tr></thead><tbody>' +
                d.perRoom.map(function (r) {
                    return '<tr><td>' + A.dot(r.color) + esc(r.name) + '</td><td class="text-center">' + r.n + '</td><td class="text-center">' + r.hours + '</td><td><div class="d-flex align-items-center gap-2"><div class="progress flex-grow-1" style="height:8px"><div class="progress-bar" style="width:' + Math.min(100, r.util) + '%;background:' + esc(r.color) + '"></div></div><span class="small fw-semibold" style="width:48px">' + r.util + '%</span></div></td></tr>';
                }).join('') + '</tbody></table></div><div class="card-footer xsmall text-body-secondary">Kadar penggunaan = jam diluluskan ÷ (hari persekolahan × waktu operasi ' + esc(S.settings.open_time) + '–' + esc(S.settings.close_time) + ').</div></div></div>' +
                '<div class="col-lg-4"><div class="card h-100"><div class="card-header"><h2 class="card-title">Status Permohonan</h2></div><div class="card-body"><canvas id="statusChart" height="260"></canvas></div></div></div></div>' +
                '<div class="row g-4"><div class="col-lg-4"><div class="card h-100"><div class="card-header"><h2 class="card-title">Mengikut Hari</h2></div><div class="card-body"><canvas id="dowChart" height="220"></canvas></div></div></div>' +
                '<div class="col-lg-4"><div class="card h-100"><div class="card-header"><h2 class="card-title">Waktu Paling Popular</h2></div><div class="card-body"><canvas id="hourChart" height="220"></canvas></div></div></div>' +
                '<div class="col-lg-4"><div class="card h-100"><div class="card-header"><h2 class="card-title">Pengguna Paling Aktif</h2></div><ul class="list-group list-group-flush">' +
                (d.top.length ? d.top.map(function (u, i) { return '<li class="list-group-item d-flex align-items-center gap-2"><span class="rank">' + (i + 1) + '</span><div class="flex-grow-1 min-w-0"><div class="small fw-semibold text-truncate">' + esc(u.name) + '</div><div class="xsmall text-body-secondary">' + esc(u.department || '-') + '</div></div><span class="small fw-semibold">' + u.n + '</span></li>'; }).join('')
                    : '<li class="list-group-item text-body-secondary small">Tiada data.</li>') + '</ul></div></div></div>';
            $('#rangeForm').onsubmit = function (e) { e.preventDefault(); A.go('admin/reports', A.formData(this)); };
            $('#exportReport').onclick = function () {
                A.csvDownload('laporan-penggunaan-' + d.from + '-' + d.to + '.csv', ['Kod', 'Bilik', 'Bil. Tempahan', 'Jumlah Jam', 'Kadar Penggunaan (%)'],
                    d.perRoom.map(function (r) { return [r.code, r.name, r.n, r.hours, r.util]; }));
            };
            A.charts.doughnut('statusChart', ['Diluluskan', 'Menunggu', 'Ditolak', 'Dibatalkan'], [s.approved, s.pending, s.rejected, s.cancelled], ['#16a34a', '#f59e0b', '#dc2626', '#94a3b8']);
            A.charts.bar('dowChart', A.DAYS, d.byDow);
            A.charts.bar('hourChart', d.byHour.labels, d.byHour.data);
        });
    } });

    /* ==================================================================
     * Settings
     * ================================================================== */
    A.route('admin/settings', { title: 'Tetapan Sistem', admin: true, render: function (ctx) {
        return Promise.all([A.refreshSession(), A.api('admin.bookings', { status: 'pending', from: A.todayIso() })]).then(function (res) {
            if (!ctx.alive()) return;
            var s = S.settings, pending = res[1].total;
            var input = function (name, label, attrs) { return '<div class="mb-3"><label class="form-label fw-semibold">' + label + '</label><input class="form-control" name="' + name + '" value="' + esc(s[name]) + '"' + (attrs || '') + '></div>'; };
            var num = function (name, label, unit) { return '<div class="col-6"><label class="form-label fw-semibold">' + label + '</label><div class="input-group"><input type="number" class="form-control" name="' + name + '" value="' + esc(s[name]) + '"><span class="input-group-text">' + unit + '</span></div></div>'; };
            var sw = function (name, label, help) {
                return '<div class="col-md-6 col-xl-3"><div class="form-check form-switch"><input class="form-check-input" type="checkbox" name="' + name + '" id="sw_' + name + '"' + (s[name] === '1' ? ' checked' : '') + '><label class="form-check-label fw-semibold" for="sw_' + name + '">' + label + '</label></div><div class="form-text">' + help + '</div></div>';
            };
            ctx.view.innerHTML = A.pageTitle('Tetapan Sistem', 'Konfigurasi maklumat sekolah dan peraturan tempahan.') + '<form id="settingsForm">' +
                '<div class="card mb-4"><div class="card-header"><h2 class="card-title"><i class="bi bi-shield-check me-2"></i>Mod Kelulusan Tempahan</h2></div><div class="card-body">' +
                '<p class="text-body-secondary small mb-3">Tempahan yang bertindih <strong>sentiasa disekat</strong> dalam semua mod. Tetapan ini hanya menentukan sama ada tempahan guru yang tidak bertindih perlu menunggu kelulusan pentadbir. Tempahan oleh pentadbir sentiasa diluluskan terus.</p><div class="row g-3">' +
                Object.keys(A.APPROVAL_MODES).map(function (k) {
                    var m = A.APPROVAL_MODES[k];
                    return '<div class="col-md-4"><label class="mode-option h-100"><input type="radio" name="approval_mode" value="' + k + '" class="form-check-input"' + ((s.approval_mode || 'auto') === k ? ' checked' : '') + '><span><strong><i class="bi bi-' + m[2] + ' me-1"></i>' + m[0] + '</strong><small>' + m[1] + (k === 'room' ? ' Tetapkan di <a href="#/admin/rooms">Urus Bilik Khas</a>.' : '') + '</small></span></label></div>';
                }).join('') + '</div>' +
                (pending ? '<div class="form-check mt-3"><input class="form-check-input" type="checkbox" name="approve_pending" id="approvePending"><label class="form-check-label small" for="approvePending">Luluskan juga <strong>' + pending + ' tempahan</strong> yang sedang menunggu, jika mod baharu tidak lagi memerlukan kelulusan untuk tempahan tersebut</label></div>' : '') +
                '</div></div><div class="row g-4"><div class="col-lg-6"><div class="card h-100"><div class="card-header"><h2 class="card-title"><i class="bi bi-building me-2"></i>Maklumat Sekolah</h2></div><div class="card-body">' +
                '<label class="form-label fw-semibold">Logo sekolah</label><div class="logo-upload mb-4"><div id="logoPreview">' + A.brandLogo('xl') + '</div><div class="flex-grow-1">' +
                '<input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" hidden>' +
                '<div class="d-flex flex-wrap gap-2 mb-2"><button type="button" class="btn btn-sm btn-primary" id="logoPick"><i class="bi bi-upload me-1"></i>' + (s.logo ? 'Tukar logo' : 'Muat naik logo') + '</button>' +
                (s.logo ? '<button type="button" class="btn btn-sm btn-light text-danger" id="logoRemove"><i class="bi bi-trash me-1"></i>Buang</button>' : '') + '</div>' +
                '<div class="form-text mt-0">' + (s.logo ? 'Logo sekolah anda sedang digunakan.' : 'Logo lalai sistem sedang digunakan. Muat naik logo sekolah untuk menggantikannya.') +
                ' PNG, JPG, WebP atau SVG. Logo akan dikecilkan secara automatik dan dipaparkan di sidebar, halaman log masuk, slip tempahan dan paparan TV. Latar lutsinar (PNG) paling cantik.</div></div></div>' +
                input('system_name', 'Nama sistem') + input('school_name', 'Nama sekolah') + input('school_code', 'Kod sekolah') + input('school_address', 'Alamat') +
                '</div></div></div><div class="col-lg-6"><div class="card h-100"><div class="card-header"><h2 class="card-title"><i class="bi bi-sliders me-2"></i>Peraturan Tempahan</h2></div><div class="card-body"><div class="row g-3">' +
                '<div class="col-6"><label class="form-label fw-semibold">Waktu buka</label><input type="time" class="form-control" name="open_time" value="' + esc(s.open_time) + '"></div>' +
                '<div class="col-6"><label class="form-label fw-semibold">Waktu tutup</label><input type="time" class="form-control" name="close_time" value="' + esc(s.close_time) + '"></div>' +
                num('max_advance_days', 'Tempah awal maksimum', 'hari') + num('max_duration_hours', 'Tempoh maksimum', 'jam') + num('max_recurring_weeks', 'Ulangan maksimum', 'minggu') + num('cancel_cutoff_hours', 'Had batal / pinda', 'jam sebelum') +
                '</div><div class="form-text">Had 0 = tiada had. Peraturan ini tidak dikenakan ke atas pentadbir.</div></div></div></div>' +
                '<div class="col-12"><div class="card"><div class="card-header"><h2 class="card-title"><i class="bi bi-link-45deg me-2"></i>URL Sistem</h2></div><div class="card-body">' +
                '<input class="form-control" name="app_url" value="' + esc(s.app_url) + '" placeholder="https://script.google.com/macros/s/…/exec atau https://nama-projek.web.app/"><div class="form-text">Digunakan untuk pautan dalam e-mel notifikasi.</div>' +
                '</div></div></div>' +
                '<div class="col-12"><div class="card"><div class="card-header"><h2 class="card-title"><i class="bi bi-toggles me-2"></i>Pilihan</h2></div><div class="card-body"><div class="row g-4">' +
                sw('allow_registration', 'Benarkan guru mendaftar sendiri', 'Guru yang namanya tiada dalam senarai boleh mendaftar; pentadbir perlu mengesahkannya.') +
                sw('email_notifications', 'Notifikasi e-mel', 'Hantar e-mel (melalui Gmail pemilik skrip) kepada guru yang ada e-mel apabila tempahan diluluskan, ditolak atau menunggu kelulusan.') +
                sw('allow_weekend', 'Tempahan hujung minggu', 'Benarkan guru menempah pada hari Sabtu &amp; Ahad.') +
                sw('public_display', 'Paparan skrin awam', 'Benarkan <a href="' + A.displayUrl() + '" target="_blank">paparan jadual hari ini</a> dibuka tanpa log masuk (TV di bilik guru / lobi).') +
                '</div></div></div></div></div><div class="mt-4"><button class="btn btn-primary btn-lg px-5"><i class="bi bi-save me-1"></i>Simpan Tetapan</button></div></form>';
            var saveLogo = function (logo, btn) {
                A.busy(btn, true);
                return A.api('admin.logo.save', { logo: logo }).then(function (r) {
                    A.setLogo(r.logo);
                    A.toast(r.logo ? 'Logo sekolah dikemas kini.' : 'Logo sekolah dibuang.');
                    A.reload();
                }).catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
            $('#logoPick').onclick = function () { $('#logoFile').click(); };
            $('#logoFile').onchange = function () {
                var file = this.files[0];
                if (!file) return;
                if (!/^image\//.test(file.type)) { A.toast('Sila pilih fail imej.', 'warning'); return; }
                if (file.size > 5 * 1024 * 1024) { A.toast('Fail terlalu besar (maksimum 5 MB).', 'warning'); return; }
                resizeLogo(file).then(function (dataUrl) {
                    $('#logoPreview').innerHTML = '<span class="brand-logo has-img xl"><img src="' + dataUrl + '" alt=""></span>';
                    return saveLogo(dataUrl, $('#logoPick'));
                }).catch(function (err) { A.showError(err); });
            };
            if ($('#logoRemove')) $('#logoRemove').onclick = function () {
                var btn = this;
                A.confirm('Buang logo sekolah? Logo lalai sistem akan dipaparkan semula.').then(function (ok) { if (ok) saveLogo('', btn); });
            };
            $('#settingsForm').onsubmit = function (e) {
                e.preventDefault();
                var btn = $('button.btn-lg', this);
                var data = A.formData(this);
                var approve = !!data.approve_pending;
                delete data.approve_pending;
                A.busy(btn, true);
                A.api('admin.settings.save', { settings: data, approve_pending: approve }).then(function (r) {
                    A.toast('Tetapan sistem disimpan.' + (r.approved ? ' ' + r.approved + ' tempahan yang menunggu telah diluluskan.' : ''));
                    return A.refreshSession();
                }).then(function () { A.reload(); }).catch(function (err) { A.busy(btn, false); A.showError(err); });
            };
        });
    } });

    /**
     * Shrinks an uploaded image to fit a square box and returns a PNG/WebP data URL
     * small enough to store in Google Sheets (see LOGO_MAX in Code.gs).
     */
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
                        if (out.length <= 190000) return resolve(out);
                    }
                    reject(new Error('Imej terlalu kompleks untuk disimpan. Cuba logo yang lebih ringkas.'));
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    /* ==================================================================
     * Audit log
     * ================================================================== */
    A.route('admin/audit', { title: 'Log Audit', admin: true, render: function (ctx) {
        var p = ctx.params;
        return A.api('admin.audit', { page: p.page, q: p.q }).then(function (d) {
            if (!ctx.alive()) return;
            var labels = {
                'auth.register': ['Permohonan akses', 'person-plus', 'info'], 'booking.create': ['Tempahan baharu', 'plus-circle', 'primary'], 'booking.update': ['Tempahan dipinda', 'pencil', 'primary'],
                'booking.approved': ['Diluluskan', 'check-circle', 'success'], 'booking.rejected': ['Ditolak', 'x-circle', 'danger'], 'booking.cancelled': ['Dibatalkan', 'slash-circle', 'secondary'], 'settings.logo': ['Logo sekolah', 'image', 'primary'],
                'auth.login': ['Log masuk', 'box-arrow-in-right', 'secondary'], 'auth.activate': ['Daftar kata laluan', 'key', 'info'], 'auth.fail': ['Log masuk gagal', 'exclamation-triangle', 'warning'],
            };
            ctx.view.innerHTML = A.pageTitle('Log Audit', 'Rekod semua aktiviti penting dalam sistem.') +
                '<div class="card"><div class="card-header d-flex justify-content-between align-items-center"><span class="small text-body-secondary">' + d.total + ' rekod</span>' +
                '<form id="auditSearch"><div class="input-icon"><i class="bi bi-search"></i><input class="form-control form-control-sm" name="q" value="' + esc(p.q || '') + '" placeholder="Cari aktiviti…"></div></form></div>' +
                '<div class="table-responsive"><table class="table table-sm align-middle mb-0"><thead><tr><th>Masa</th><th>Pengguna</th><th>Aktiviti</th><th>Butiran</th></tr></thead><tbody>' +
                d.rows.map(function (l) {
                    var x = labels[l.action] || [l.action, 'dot', 'secondary'];
                    return '<tr><td class="small text-nowrap">' + A.fmtDateTime(l.created_at) + '</td><td class="small">' + esc(l.user_name || 'Sistem') + '</td><td class="small text-nowrap"><i class="bi bi-' + x[1] + ' text-' + x[2] + ' me-1"></i>' + esc(x[0]) + '</td><td class="small">' + esc(l.details) + '</td></tr>';
                }).join('') + '</tbody></table></div>' + (d.pages > 1 ? '<div class="card-footer">' + A.pager(d.page, d.pages, function (n) { A.go('admin/audit', { page: n, q: p.q }); }) + '</div>' : '') + '</div>';
            $('#auditSearch').onsubmit = function (e) { e.preventDefault(); A.go('admin/audit', { q: this.q.value }); };
        });
    } });
})(window.App);
