/*
 * End-to-end browser test against the mock server (both deployment modes).
 *   node test/gas-mock-server.js 8090 &
 *   node test/e2e.js [screenshotDir]
 * Requires the "playwright" package.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090/';
const SLUG = 'pea1234';           // KPM school code (typed as PEA1234)
const SB = BASE;                   // one address for every school
const SLUG2 = 'xba1001';
const SA = { name: 'Akmal Nasir', email: 'akmal@contoh.com', password: 'SuperRahsia2026' };
const SHOTS = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const VENDOR = path.join(__dirname, '..', 'public', 'assets', 'vendor');
const CONFIG = "window.APP_CONFIG = { gasUrl: '" + BASE + "gas' };";
const ADMIN_IC = '000000000000';
const problems = [];
const log = (...a) => console.log(...a);
function assert(cond, msg) { if (!cond) problems.push('ASSERT: ' + msg); log((cond ? '  ✔ ' : '  ✘ ') + msg); }

// CDN files used by the Apps Script build, served from the local vendor copies.
const CDN_MAP = [
    [/bootstrap\.min\.css$/, 'bootstrap/bootstrap.min.css', 'text/css'],
    [/bootstrap-icons\.min\.css$/, 'bootstrap-icons/bootstrap-icons.min.css', 'text/css'],
    [/bootstrap-icons\.woff2/, 'bootstrap-icons/fonts/bootstrap-icons.woff2', 'font/woff2'],
    [/bootstrap-icons\.woff(\?|$)/, 'bootstrap-icons/fonts/bootstrap-icons.woff', 'font/woff'],
    [/bootstrap\.bundle\.min\.js$/, 'bootstrap/bootstrap.bundle.min.js', 'application/javascript'],
    [/chart\.umd\.min\.js$/, 'chartjs/chart.umd.min.js', 'application/javascript'],
    [/fullcalendar@[^/]+\/index\.global\.min\.js$/, 'fullcalendar/index.global.min.js', 'application/javascript'],
    [/ms\.global\.min\.js$/, 'fullcalendar/locale-ms.global.min.js', 'application/javascript'],
];

// opts.school: KPM code already remembered on this device (default SLUG); null = fresh device.
async function newPage(browser, who, opts) {
    opts = Object.assign({}, opts);
    const school = opts.school === undefined ? SLUG : opts.school;
    delete opts.school;
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts));
    if (school) await ctx.addInitScript((c) => { try { if (!localStorage.getItem('tb-school')) localStorage.setItem('tb-school', JSON.stringify({ code: c })); } catch (e) { /* ignore */ } }, school);
    await ctx.route('**/config.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: CONFIG }));
    await ctx.route('https://cdn.jsdelivr.net/**', (r) => {
        const url = r.request().url();
        const hit = CDN_MAP.find(([re]) => re.test(url));
        if (!hit) { problems.push('Unmapped CDN request: ' + url); return r.fulfill({ status: 404, body: '' }); }
        return r.fulfill({ contentType: hit[2], body: fs.readFileSync(path.join(VENDOR, hit[1])) });
    });
    await ctx.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ contentType: 'text/css', body: '' }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`[${who}] pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${who}] console: ${m.text()}`); });
    return page;
}
const wait = (page, sel) => page.waitForSelector(sel, { timeout: 15000 });
const idle = (page) => page.waitForFunction(() => !document.querySelector('.view-loading'), null, { timeout: 15000 });
async function pickName(page, name) {
    await wait(page, '#userSelect');
    const value = await page.$eval('#userSelect', (sel, n) => { const o = Array.from(sel.options).find((x) => x.text.startsWith(n)); return o ? o.value : ''; }, name);
    if (!value) throw new Error('Nama tiada dalam dropdown: ' + name);
    await page.selectOption('#userSelect', value);
}
async function login(page, name, password, url) {
    await page.goto(url || SB);
    await pickName(page, name);
    await page.fill('#loginStep [name=password]', password);
    await page.click('#loginStep button.btn-primary');
}
function weekday(offset) { const d = new Date(); d.setDate(d.getDate() + offset); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }
const post = (body) => fetch(BASE + 'gas', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
const names = (page) => page.$eval('#userSelect', (sel) => sel.textContent);
const gas = (body, school) => post(Object.assign({ school: school || SLUG }, body));

(async () => {
    const browser = await chromium.launch();
    const day = weekday(2);

    log('0. Super Admin: persediaan platform & cipta sekolah');
    const sa = await newPage(browser, 'superadmin', { school: null });
    await sa.goto(BASE + 'platform');
    await wait(sa, '#pAuth [name=name]');
    assert(await sa.isVisible('text=Persediaan pertama platform'), 'Halaman persediaan Super Admin dipaparkan kali pertama');
    await sa.fill('#pAuth [name=name]', SA.name);
    await sa.fill('#pAuth [name=email]', SA.email);
    await sa.fill('#pAuth [name=password]', SA.password);
    await sa.click('#pAuth button');
    await wait(sa, 'a[href="#/new"]');
    assert((await post({ action: 'platform.setup', data: { name: 'Penyamar', email: 'x@x.com', password: 'abcdefghijk' } })).code === 'FORBIDDEN', 'Persediaan tidak boleh diulang selepas Super Admin wujud');
    await sa.goto(BASE + 'platform#/new');
    await wait(sa, '#newSchool');
    await sa.fill('#newSchool [name=name]', 'SMK Taman Cahaya');
    await sa.fill('#slug', 'platform');
    await sa.fill('#newSchool [name=admin_name]', 'Pentadbir Sistem');
    await sa.fill('#newSchool [name=admin_password]', ADMIN_IC);
    await sa.click('#newSchool button.btn-lg');
    await wait(sa, '#pErr .alert');
    assert(await sa.isVisible('#pErr >> text=Kod sekolah mestilah'), 'Kod terpelihara ("platform") ditolak');
    await sa.fill('#slug', 'pea1234');
    assert((await sa.inputValue('#slug')) === 'PEA1234', 'Kod sekolah KPM ditukar ke huruf besar');
    await sa.screenshot({ path: SHOTS + '/00a-platform-new-school.png', fullPage: true });
    await sa.click('#newSchool button.btn-lg');
    await wait(sa, 'text=berjaya dicipta');
    assert(await sa.isVisible('text=Kata laluan sementara: ' + ADMIN_IC), 'Maklumat log masuk admin sekolah dipaparkan sekali');
    assert(await sa.isVisible('text=Kod sekolah: PEA1234'), 'Kod sekolah dipaparkan untuk dihantar kepada admin');
    assert(await sa.isVisible('.school-link >> text=PEA1234'), 'Sekolah baharu tersenarai dengan kod PEA1234');
    await sa.screenshot({ path: SHOTS + '/00b-platform-schools.png', fullPage: true });

    log('1. Pentadbir log masuk (nama + No. KP)');
    const admin = await newPage(browser, 'admin');
    await admin.goto(SB);
    await wait(admin, '#userSelect');
    await pickName(admin, 'Pentadbir Sistem');
    await admin.screenshot({ path: SHOTS + '/01-login.png' });
    await admin.fill('#loginStep [name=password]', '111111111111');
    await admin.click('#loginStep button.btn-primary');
    await wait(admin, '#loginAlert .alert');
    assert(await admin.isVisible('text=tidak tepat'), 'Kata laluan salah ditolak');
    await admin.fill('#loginStep [name=password]', ADMIN_IC);
    await admin.click('#loginStep button.btn-primary');
    await wait(admin, '.hero-card');
    assert(await admin.isVisible('text=Daftar & Urus Guru'), 'Pentadbir masuk dan nampak menu pentadbiran');

    log('2. Pentadbir daftar nama guru (tanpa No. KP)');
    await admin.goto(SB + '#/admin/users?new=1');
    await wait(admin, '#userForm');
    await admin.fill('#userForm [name=name]', 'Cikgu Ali bin Abu');
    await admin.fill('#userForm [name=department]', 'Sains');
    await admin.screenshot({ path: SHOTS + '/02-register-teacher.png', fullPage: true });
    await admin.click('#userForm button.btn-primary');
    await wait(admin, 'td >> text=Cikgu Ali bin Abu');
    await admin.click('[data-bs-target="#importBox"]');
    await admin.fill('#importForm textarea', 'Siti Aminah binti Ali, Bahasa Melayu\nLim Wei Ming, Matematik, lim@contoh.com\nCikgu Ali bin Abu, Sains');
    await admin.click('#importForm button');
    await wait(admin, 'td >> text=Siti Aminah binti Ali');
    assert(await admin.isVisible('.tb-toast >> text=2 guru didaftarkan'), 'Import pukal: 2 didaftar, pendua dilangkau');
    await idle(admin);
    await admin.screenshot({ path: SHOTS + '/03-users.png', fullPage: true });

    log('3. Guru log masuk kali pertama — daftar No. KP sebagai kata laluan');
    const guru = await newPage(browser, 'guru');
    await guru.goto(SB);
    await wait(guru, '#nameFilter');
    await guru.fill('#nameFilter', 'ali bin');
    await wait(guru, '#loginStep [name=ic]');
    assert(await guru.$eval('#userSelect', (s) => s.options[s.selectedIndex].text.startsWith('Cikgu Ali')), 'Carian nama memilih guru yang betul');
    assert(await guru.isVisible('text=Log masuk kali pertama'), 'Paparan kali pertama dipaparkan');
    await guru.fill('#loginStep [name=ic]', '900101-10-1234');
    await guru.fill('#loginStep [name=ic_confirm]', '900101101235');
    await guru.screenshot({ path: SHOTS + '/04-first-login.png' });
    await guru.click('#loginStep button.btn-primary');
    await wait(guru, '#loginAlert .alert');
    assert(await guru.isVisible('text=tidak sepadan'), 'Pengesahan No. KP yang tidak sepadan ditolak');
    await guru.fill('#loginStep [name=ic_confirm]', '900101101234');
    await guru.click('#loginStep button.btn-primary');
    await wait(guru, 'text=No. KP berjaya didaftarkan');
    assert(true, 'Selepas daftar No. KP, akaun menunggu pengesahan admin');
    await guru.screenshot({ path: SHOTS + '/04b-pending.png' });
    const guruId = (await gas({ action: 'config' })).data.teachers.find((t) => t.name.startsWith('Cikgu Ali')).id;
    assert((await gas({ action: 'login', data: { user_id: guruId, password: '900101101234' } })).code === 'PENDING', 'Log masuk disekat sehingga admin mengesahkan');
    await guru.click('#backLogin3');
    await wait(guru, '#userSelect');
    assert(await guru.isVisible('text=Menunggu pengesahan'), 'Halaman log masuk menunjukkan status menunggu');

    log('3b. Admin tolak (disyaki dirampas), guru daftar semula, admin sahkan');
    await admin.goto(SB + '#/admin/users?status=pending');
    await wait(admin, '[data-reject]');
    await admin.screenshot({ path: SHOTS + '/04c-admin-pending.png', fullPage: true });
    await admin.click('[data-reject]');
    await admin.click('[data-confirm-ok]');
    await wait(admin, '.tb-toast >> text=ditolak');
    const again = (await gas({ action: 'config' })).data.teachers.find((t) => t.id === guruId);
    assert(again && !again.activated && !again.pending, 'Selepas ditolak, akaun kembali belum didaftar (guru sebenar boleh daftar semula)');
    assert((await gas({ action: 'activate', data: { user_id: guruId, ic: '900101101234', ic_confirm: '900101101234' } })).data.status === 'pending', 'Guru mendaftar semula No. KP');
    await admin.goto(SB + '#/admin/users');
    await wait(admin, '#approveAll');
    await admin.click('#approveAll');
    await admin.click('[data-confirm-ok]');
    await wait(admin, '.tb-toast >> text=akaun disahkan');
    await guru.reload();
    await login(guru, 'Cikgu Ali', '900101101234');
    await wait(guru, '.hero-card');
    assert(true, 'Guru masuk selepas admin mengesahkan');

    log('4. Log keluar & log masuk semula dengan No. KP');
    await guru.click('#userChip');
    await guru.click('[data-logout]');
    await wait(guru, '#userSelect');
    assert(await guru.$eval('#userSelect', (s) => s.options[s.selectedIndex].text.startsWith('Cikgu Ali')), 'Nama terakhir diingat');
    await wait(guru, '#loginStep [name=password]');
    await guru.fill('#loginStep [name=password]', '900101101234');
    await guru.click('#loginStep button.btn-primary');
    await wait(guru, '.hero-card');
    await idle(guru);
    await guru.screenshot({ path: SHOTS + '/05-guru-dashboard.png', fullPage: true });
    const dash = await gas({ action: 'login', data: { user_id: guruId, password: '900101-10-1234' } });
    assert(dash.ok, 'No. KP dengan sengkang juga diterima');

    log('5. Tempahan: lulus automatik, pertindihan, berulang');
    await guru.goto(SB + '#/book?room_id=1&date=' + day);
    await wait(guru, '#bookingForm');
    await guru.waitForSelector('.dt-grid');
    const chips = guru.locator('.period-chip');
    await chips.nth(1).click(); await chips.nth(3).click();
    await guru.fill('[name=purpose]', 'PdP Sains Komputer');
    await guru.fill('[name=class_name]', '4 Bestari');
    await guru.waitForSelector('#checkResult.ok');
    await guru.screenshot({ path: SHOTS + '/06-book-form.png', fullPage: true });
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert(await guru.isVisible('.slip-head >> text=Diluluskan'), 'Tempahan tanpa pertindihan terus Diluluskan');
    await guru.goto(SB + '#/book?room_id=1&date=' + day + '&start=08:30&end=09:00');
    await wait(guru, '#bookingForm');
    await guru.fill('[name=purpose]', 'Cuba bertindih');
    await guru.waitForSelector('#checkResult.bad');
    assert(await guru.isDisabled('#submitBtn'), 'Butang hantar dimatikan apabila bertindih');
    const serverClash = await guru.evaluate((d) => App.api('booking.create', { room_id: 1, date: d, start_time: '08:30', end_time: '09:00', purpose: 'x' }).then(() => 'accepted', (e) => e.message), day);
    assert(serverClash !== 'accepted', 'Pelayan juga menolak tempahan bertindih');
    await guru.goto(SB + '#/book?room_id=2&date=' + day + '&start=14:30&end=15:30');
    await wait(guru, '#bookingForm');
    await guru.check('#repeat');
    await guru.fill('#repeat_weeks', '4');
    await guru.dispatchEvent('#repeat_weeks', 'input');
    await guru.fill('[name=purpose]', 'Kelas Tambahan');
    await guru.waitForSelector('#checkResult.ok');
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert((await guru.locator('.series-chip').count()) === 4, 'Siri 4 minggu dicipta');

    log('6. Profil: e-mel & tukar kata laluan');
    await guru.goto(SB + '#/profile');
    await wait(guru, '#profileForm');
    await guru.fill('#profileForm [name=email]', 'ali@contoh.com');
    await guru.click('#profileForm button');
    await wait(guru, '.tb-toast >> text=Profil berjaya');
    await guru.fill('#pwForm [name=current]', '900101101234');
    await guru.fill('#pwForm [name=password]', 'rahsia123');
    await guru.fill('#pwForm [name=confirm]', 'rahsia123');
    await guru.click('#pwForm button');
    await wait(guru, '.tb-toast >> text=Kata laluan berjaya');
    assert((await gas({ action: 'login', data: { user_id: guruId, password: 'rahsia123' } })).ok, 'Kata laluan baharu berfungsi');
    assert(!(await gas({ action: 'login', data: { user_id: guruId, password: '900101101234' } })).ok, 'No. KP lama tidak lagi berfungsi selepas tukar');

    log('7. Mod kelulusan manual + kelulusan pentadbir + notifikasi');
    await admin.goto(SB + '#/admin/settings');
    await wait(admin, '#settingsForm');
    await admin.fill('[name=school_name]', 'SMK Taman Contoh');
    await admin.check('input[name=approval_mode][value=manual]');
    await admin.screenshot({ path: SHOTS + '/07-settings.png', fullPage: true });
    await admin.click('#settingsForm button.btn-lg');
    await wait(admin, '.tb-toast >> text=Tetapan sistem disimpan');
    log('7b. Muat naik logo sekolah');
    await admin.goto(SB + '#/admin/settings');
    await wait(admin, '#logoPick');
    await admin.setInputFiles('#logoFile', path.join(__dirname, 'logo-contoh.png'));
    await wait(admin, '.tb-toast >> text=Logo sekolah dikemas kini');
    await wait(admin, '#sidebarLogo img');
    const logoLen = (await gas({ action: 'config' })).data.logo.length;
    assert(logoLen > 1000 && logoLen <= 200000, 'Logo dikecilkan & disimpan (' + Math.round(logoLen / 1024) + ' KB)');
    const dims = await admin.$eval('#sidebarLogo img', (i) => [i.naturalWidth, i.naturalHeight]);
    assert(dims[0] <= 256 && dims[1] <= 256, 'Logo diubah saiz kepada ' + dims.join('×'));
    await idle(admin);
    await admin.screenshot({ path: SHOTS + '/07b-logo-settings.png', fullPage: true });
    const badLogo = await admin.evaluate(() => App.api('admin.logo.save', { logo: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }).then(() => 'accepted', (e) => e.message));
    assert(badLogo !== 'accepted', 'Format logo tidak sah (SVG mentah) ditolak oleh pelayan');
    const guruLogo = await guru.evaluate(() => App.api('admin.logo.save', { logo: '' }).then(() => 'accepted', (e) => e.code));
    assert(guruLogo === 'FORBIDDEN', 'Guru tidak boleh menukar logo');
    await guru.goto(SB + '#/dashboard');
    await guru.reload();
    await wait(guru, '.hero-card');

    await guru.goto(SB + '#/book?room_id=3&date=' + day + '&start=10:20&end=10:50');
    await wait(guru, '#bookingForm');
    await guru.fill('[name=purpose]', 'Eksperimen');
    await guru.waitForSelector('#checkResult.ok');
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert(await guru.isVisible('.slip-head >> text=Menunggu'), 'Tempahan berstatus Menunggu');
    assert(await guru.isVisible('.slip-head .brand-logo img'), 'Logo sekolah dipaparkan pada slip tempahan');
    await admin.goto(SB + '#/admin/bookings?status=pending');
    await wait(admin, '.row-check');
    await admin.screenshot({ path: SHOTS + '/08-admin-bookings.png', fullPage: true });
    await admin.check('#checkAll');
    await admin.click('[data-bulk=approved]');
    await wait(admin, '.tb-toast >> text=dikemas kini');
    await guru.goto(SB + '#/notifications');
    await wait(guru, 'text=Diluluskan');
    assert(true, 'Guru menerima notifikasi kelulusan');
    const mails = await (await fetch(BASE + '__mails')).json();
    assert(mails.some((m) => m.to === 'ali@contoh.com' && /Diluluskan/.test(m.subject)), 'E-mel notifikasi dihantar kepada guru yang ada e-mel');

    log('8. Guru tiada dalam senarai mendaftar sendiri');
    const newbie = await newPage(browser, 'newbie');
    await newbie.goto(SB);
    await wait(newbie, '#showRegister');
    assert(await newbie.isVisible('.auth-hero .brand-logo img'), 'Logo sekolah dipaparkan di halaman log masuk');
    await newbie.click('#showRegister');
    await newbie.fill('#regForm [name=name]', 'Cikgu Baru');
    await newbie.fill('#regForm [name=ic]', '880202025555');
    await newbie.fill('#regForm [name=department]', 'Sejarah');
    await newbie.screenshot({ path: SHOTS + '/09-self-register.png' });
    await newbie.click('#regForm button.btn-primary');
    await wait(newbie, 'text=Pendaftaran dihantar');
    await admin.goto(SB + '#/admin/users?status=pending');
    await wait(admin, 'td >> text=Cikgu Baru');
    await admin.click('[data-status="active"]');
    await wait(admin, '.tb-toast >> text=Status akaun');
    await login(newbie, 'Cikgu Baru', '880202025555');
    await wait(newbie, '.hero-card');
    assert(true, 'Guru yang disahkan boleh log masuk dengan No. KP yang didaftarkan');

    log('9. Pentadbir set semula kata laluan');
    await admin.goto(SB + '#/admin/users');
    await admin.waitForSelector('[data-reset]', { state: 'attached' });
    await admin.evaluate((id) => App.api('admin.users.resetPassword', { id: id }), guruId);
    const after = await gas({ action: 'login', data: { user_id: guruId, password: 'rahsia123' } });
    assert(after.code === 'NOT_ACTIVATED', 'Selepas set semula, guru perlu mendaftar No. KP semula');
    await guru.reload();
    await wait(guru, '#userSelect');
    assert(await guru.isVisible('#loginStep [name=ic]'), 'Sesi lama tamat & paparan kali pertama muncul');
    await gas({ action: 'activate', data: { user_id: guruId, ic: '900101101234', ic_confirm: '900101101234' } });
    await admin.evaluate((id) => App.api('admin.users.setStatus', { id: id, status: 'active' }), guruId);
    assert((await gas({ action: 'login', data: { user_id: guruId, password: '900101101234' } })).ok, 'Selepas set semula: daftar No. KP + pengesahan admin, kemudian boleh log masuk');

    log('10. Keselamatan');
    await login(guru, 'Cikgu Baru', '880202025555');
    await wait(guru, '.hero-card');
    const forbidden = await guru.evaluate(() => App.api('admin.users.list').then(() => 'allowed', (e) => e.code));
    assert(forbidden === 'FORBIDDEN', 'Guru tidak boleh memanggil API pentadbir');
    assert((await gas({ action: 'dashboard' })).code === 'AUTH', 'Permintaan tanpa token ditolak');
    assert((await gas({ action: 'dashboard', token: 'palsu' })).code === 'AUTH', 'Token palsu ditolak');
    const sitiId = (await gas({ action: 'config' })).data.teachers.find((t) => t.name.startsWith('Lim')).id;
    await gas({ action: 'activate', data: { user_id: sitiId, ic: '770707077777', ic_confirm: '770707077777' } });
    await admin.evaluate((id) => App.api('admin.users.setStatus', { id: id, status: 'active' }), sitiId);
    let last;
    for (let i = 0; i < 6; i++) last = await gas({ action: 'login', data: { user_id: sitiId, password: 'salah' + i } });
    assert(last.code === 'LOCKED', 'Akaun dikunci selepas 5 cubaan salah');
    const cfg = await gas({ action: 'config' });
    assert(!JSON.stringify(cfg).includes('password_hash'), 'Senarai nama awam tidak mendedahkan hash kata laluan');

    log('11. Halaman lain & tangkapan skrin');
    for (const [who, route, name] of [[guru, 'availability?date=' + day, '10-availability'], [guru, 'calendar', '11-calendar'], [guru, 'my-bookings', '12-my-bookings'],
        [guru, 'rooms', '13-rooms'], [guru, 'profile', '14-profile'], [admin, 'dashboard', '15-admin-dashboard'], [admin, 'admin/users', '16-admin-users'],
        [admin, 'admin/reports?from=' + day.slice(0, 8) + '01&to=' + day.slice(0, 8) + '28', '17-reports'], [admin, 'admin/audit', '18-audit']]) {
        await who.goto(SB + '#/' + route);
        await idle(who);
        await who.waitForTimeout(route.startsWith('calendar') ? 800 : 300);
        await who.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    }

    log('12. Mod GAS (Index.html dari Apps Script, google.script.run)');
    const g = await newPage(browser, 'gas-mode');
    await login(g, 'Pentadbir Sistem', ADMIN_IC, BASE + 'gas-app?s=' + SLUG);
    await wait(g, '.hero-card');
    await idle(g);
    assert(await g.isVisible('.hero-card >> text=SMK Taman Contoh'), 'Aplikasi berfungsi apabila dibuka terus dari GAS');
    await g.screenshot({ path: SHOTS + '/19-gas-mode-dashboard.png', fullPage: true });
    await g.goto(BASE + 'gas-app?s=' + SLUG + '#/calendar');
    await g.waitForSelector('.fc-event', { timeout: 15000 });
    assert(true, 'Kalendar dimuatkan dari CDN dalam mod GAS');
    await g.goto(BASE + 'gas-app?s=' + SLUG + '#/admin/reports');
    await idle(g);
    await g.waitForTimeout(400);
    assert(await g.$eval('#statusChart', (c) => c.width > 0), 'Carta laporan dipaparkan dalam mod GAS');
    assert((await g.getAttribute('#displayLink', 'href')).endsWith('/gas-app?page=display&s=' + SLUG), 'Pautan paparan TV menghala ke ?page=display&s=' + SLUG);
    const tvGas = await newPage(browser, 'tv-gas');
    await tvGas.goto(BASE + 'gas-app?page=display&s=' + SLUG);
    await tvGas.waitForSelector('.db-room');
    assert(true, 'Paparan TV berfungsi dalam mod GAS');

    log('13. Paparan TV & telefon (mod Firebase)');
    const tv = await newPage(browser, 'tv');
    await tv.goto(BASE + 'display.html');
    await tv.waitForSelector('.db-room');
    await tv.screenshot({ path: SHOTS + '/20-display.png', fullPage: true });
    assert(await tv.isVisible('#logo img'), 'Logo dipaparkan pada paparan TV');
    const mobile = await newPage(browser, 'mobile', { viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await mobile.goto(SB);
    await wait(mobile, '#userSelect');
    await mobile.screenshot({ path: SHOTS + '/21-mobile-login.png', fullPage: true });
    await login(mobile, 'Cikgu Baru', '880202025555');
    await wait(mobile, '.hero-card');
    await idle(mobile);
    await mobile.screenshot({ path: SHOTS + '/22-mobile-dark.png', fullPage: true });

    log('14. Buang logo');
    await admin.goto(SB + '#/admin/settings');
    await wait(admin, '#logoRemove');
    await admin.click('#logoRemove');
    await admin.click('[data-confirm-ok]');
    await wait(admin, '.tb-toast >> text=Logo sekolah dibuang');
    assert((await gas({ action: 'config' })).data.logo === '', 'Logo dibuang dan ikon lalai kembali');
    assert(await admin.isVisible('#sidebarLogo .bi-buildings'), 'Sidebar kembali ke ikon lalai');

    log('15. Banyak sekolah: pengasingan data, halaman utama, gantung, set semula, padam');
    const saTok = await sa.evaluate(() => sessionStorage.getItem('tb-platform-token'));
    const b = await post({ action: 'platform.school.create', token: saTok, data: { slug: 'XBA1001', name: 'SK Bukit Indah', admin_name: 'Cikgu Admin Bukit' } });
    assert(b.ok && b.data.admin_password.length >= 8, 'Sekolah kedua dicipta dengan kata laluan sementara dijana');
    const cfgB = (await gas({ action: 'config' }, SLUG2)).data;
    assert(cfgB.school_name === 'SK Bukit Indah' && cfgB.teachers.length === 1 && cfgB.teachers[0].name === 'Cikgu Admin Bukit', 'Sekolah kedua hanya nampak guru sendiri');
    const loginA = await gas({ action: 'login', data: { user_id: guruId, password: '880202025555' } }, SLUG2);
    assert(!loginA.ok, 'Kata laluan guru sekolah A tidak berfungsi di sekolah B');
    const tokA = await guru.evaluate((s) => localStorage.getItem('tb-token:' + s) || sessionStorage.getItem('tb-token:' + s), SLUG);
    assert(tokA && (await gas({ action: 'dashboard', token: tokA }, SLUG2)).code === 'AUTH', 'Token sesi sekolah A ditolak oleh sekolah B');
    const bAdmin = await newPage(browser, 'admin-b', { school: SLUG2 });
    await login(bAdmin, 'Cikgu Admin Bukit', b.data.admin_password, BASE);
    await wait(bAdmin, '.hero-card');
    await idle(bAdmin);
    assert(await bAdmin.isVisible('.hero-card >> text=SK Bukit Indah'), 'Admin sekolah B masuk ke sekolah sendiri');
    const bRes = await bAdmin.evaluate(() => App.api('admin.bookings', {}).then((r) => JSON.stringify(r)));
    assert(!bRes.includes('PdP Sains Komputer'), 'Tempahan sekolah A tidak kelihatan di sekolah B');

    const land = await newPage(browser, 'landing', { school: null });
    await land.goto(BASE);
    await wait(land, '#schoolCode');
    assert(!(await land.content()).includes('SK Bukit Indah'), 'Halaman utama tidak menyenaraikan sekolah');
    assert(!(await land.$('#userSelect')), 'Senarai nama guru tidak dipaparkan sebelum kod sekolah dimasukkan');
    await land.screenshot({ path: SHOTS + '/23-landing.png' });
    await land.fill('#schoolCode', 'tiada999');
    await land.click('#codeForm button');
    await wait(land, '#codeAlert .alert >> text=tidak dijumpai');
    assert(true, 'Kod sekolah salah memaparkan ralat');
    await land.fill('#schoolCode', ' xba1001 ');
    await land.click('#codeForm button');
    await wait(land, '#userSelect');
    assert(land.url() === BASE, 'Alamat kekal ' + BASE + ' (tiada kod sekolah dalam URL)');
    assert((await names(land)).includes('Cikgu Admin Bukit'), 'Selepas kod betul, senarai nama guru sekolah itu dipaparkan');
    await land.screenshot({ path: SHOTS + '/24-landing-names.png' });
    await land.reload();
    await wait(land, '#userSelect');
    assert(true, 'Sekolah diingati: buka semula terus ke senarai nama');
    await land.click('#switchSchool');
    await wait(land, '#schoolCode');
    assert(true, '"Tukar sekolah" kembali ke kotak kod sekolah');
    await land.goto(BASE + 'pea1234');
    await wait(land, '#userSelect');
    assert(land.url() === BASE && (await names(land)).includes('Cikgu Ali bin Abu'), 'Pautan lama /kod masih berfungsi dan alamat dikemaskan');

    await sa.goto(BASE + 'platform#/school?id=' + b.data.id);
    await wait(sa, '#toggleStatus');
    await sa.screenshot({ path: SHOTS + '/25-platform-school.png', fullPage: true });
    await sa.click('#toggleStatus');
    await sa.click('[data-confirm-ok]');
    await wait(sa, 'text=Digantung');
    assert((await gas({ action: 'config' }, SLUG2)).code === 'SCHOOL_SUSPENDED', 'Sekolah digantung tidak boleh diakses');
    await bAdmin.reload();
    await wait(bAdmin, 'text=Akaun digantung');
    assert(true, 'Pengguna sekolah digantung nampak mesej digantung');
    assert((await gas({ action: 'config' })).ok, 'Sekolah lain tidak terjejas oleh penggantungan');
    await post({ action: 'platform.school.setStatus', token: saTok, data: { id: b.data.id, status: 'active' } });
    const bAdminId = cfgB.teachers[0].id;
    const reset = await post({ action: 'platform.school.resetAdmin', token: saTok, data: { id: b.data.id, user_id: bAdminId } });
    assert(reset.ok && (await gas({ action: 'login', data: { user_id: bAdminId, password: reset.data.password } }, SLUG2)).ok, 'Super Admin set semula kata laluan admin sekolah');
    assert(!(await gas({ action: 'login', data: { user_id: bAdminId, password: b.data.admin_password } }, SLUG2)).ok, 'Kata laluan lama admin tidak lagi sah');
    assert((await post({ action: 'platform.schools', token: 'palsu' })).code === 'AUTH', 'API Super Admin menolak token palsu');
    assert((await post({ action: 'platform.schools', token: tokA })).code === 'AUTH', 'Token guru/admin sekolah tidak boleh guna API Super Admin');
    const bad = await post({ action: 'platform.school.delete', token: saTok, data: { id: b.data.id, confirm_slug: 'salah' } });
    assert(bad.code === 'VALIDATION', 'Padam memerlukan kod pengesahan yang betul');
    await sa.goto(BASE + 'platform#/school?id=' + b.data.id);
    await wait(sa, '#delSchool');
    await sa.fill('#delSchool [name=confirm_slug]', 'XBA1001');
    await sa.click('#delSchool button');
    await wait(sa, '.tb-toast >> text=dipadam');
    assert((await gas({ action: 'config' }, SLUG2)).code === 'SCHOOL_NOT_FOUND', 'Sekolah dipadam tidak boleh diakses lagi');
    const sheets = await (await fetch(BASE + '__sheets')).json();
    assert(sheets.some((x) => x.name.startsWith('[DIPADAM] SK Bukit Indah')), 'Google Sheet sekolah dipadam disimpan (dinamakan semula) untuk pemulihan');
    await sa.goto(BASE + 'platform#/audit');
    await wait(sa, 'td >> text=school.delete');
    assert(true, 'Log audit platform merekod tindakan Super Admin');
    await sa.screenshot({ path: SHOTS + '/26-platform-audit.png', fullPage: true });

    log('16. Mod GAS: halaman utama & panel Super Admin');
    const gl = await newPage(browser, 'gas-landing', { school: null });
    await gl.goto(BASE + 'gas-app');
    await wait(gl, '#schoolCode');
    await gl.fill('#schoolCode', 'PEA1234');
    await gl.click('#codeForm button');
    await wait(gl, '#userSelect');
    assert((await names(gl)).includes('Cikgu Ali bin Abu'), 'Mod GAS: kod sekolah memaparkan senarai nama');
    await gl.goto(BASE + 'gas-app?page=platform');
    await wait(gl, '#pAuth [name=email]');
    await gl.fill('#pAuth [name=email]', SA.email);
    await gl.fill('#pAuth [name=password]', SA.password);
    await gl.click('#pAuth button');
    await wait(gl, '.school-link');
    assert(await gl.isVisible('td >> text=SMK Taman Contoh'), 'Mod GAS: panel Super Admin berfungsi (nama sekolah dari Tetapan disegerakkan)');

    await browser.close();
    console.log('\nMASALAH (' + problems.length + '):\n' + problems.join('\n'));
    process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(problems.join('\n')); process.exit(1); });
