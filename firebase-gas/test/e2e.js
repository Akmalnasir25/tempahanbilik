/*
 * End-to-end browser test against the mock server.
 *   node test/gas-mock-server.js 8090 &
 *   node test/e2e.js [screenshotDir]
 * Requires the "playwright" package.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:8090/';
const SHOTS = process.argv[2] || path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MOCK_FB = fs.readFileSync(path.join(__dirname, 'mock-firebase.js'), 'utf8');
const CONFIG = "window.APP_CONFIG = { firebase: { apiKey: 'test', authDomain: 'test', projectId: 'test', appId: 'test' }, gasUrl: '" + BASE + "gas' };";
const problems = [];
const log = (...a) => console.log(...a);
function assert(cond, msg) { if (!cond) problems.push('ASSERT: ' + msg); log((cond ? '  ✔ ' : '  ✘ ') + msg); }

async function newPage(browser, email, opts) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1440, height: 900 } }, opts || {}));
    await ctx.route('**/config.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: CONFIG }));
    await ctx.route('https://www.gstatic.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: /firebase-app-compat/.test(r.request().url()) ? MOCK_FB : '' }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => problems.push(`[${email}] pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`[${email}] console: ${m.text()}`); });
    if (email) await page.addInitScript((e) => { window.__mockEmail = e; }, email);
    return page;
}
async function login(page) {
    await page.goto(BASE);
    await page.click('#googleBtn');
}
const wait = (page, sel) => page.waitForSelector(sel, { timeout: 15000 });
const idle = (page) => page.waitForFunction(() => !document.querySelector('.view-loading'), null, { timeout: 15000 });
function weekday(offset) { const d = new Date(); d.setDate(d.getDate() + offset); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

(async () => {
    const browser = await chromium.launch();
    const day = weekday(2);

    log('1. Halaman log masuk & sekatan domain');
    const guest = await newPage(browser, 'orang.luar@gmail.com');
    await guest.goto(BASE);
    await wait(guest, '#googleBtn');
    await guest.screenshot({ path: SHOTS + '/01-login.png' });
    await guest.click('#googleBtn');
    await wait(guest, 'text=Akses ditolak');
    assert(await guest.isVisible('text=moe-dl.edu.my'), 'Akaun bukan DELIMa ditolak');
    await guest.screenshot({ path: SHOTS + '/02-domain-denied.png' });

    log('2. Pentadbir mendaftar guru');
    const admin = await newPage(browser, 'admin@moe-dl.edu.my');
    await login(admin);
    await wait(admin, '.hero-card');
    assert(await admin.isVisible('text=Daftar & Urus Guru'), 'Admin nampak menu pentadbiran');
    await admin.goto(BASE + '#/admin/users?new=1');
    await wait(admin, '#userForm');
    await admin.fill('#userForm [name=name]', 'Cikgu Ali bin Abu');
    await admin.fill('#userForm [name=email]', 'ali@moe-dl.edu.my');
    await admin.fill('#userForm [name=department]', 'Sains');
    await admin.screenshot({ path: SHOTS + '/03-register-teacher.png', fullPage: true });
    await admin.click('#userForm button.btn-primary');
    await wait(admin, 'text=ali@moe-dl.edu.my');
    await admin.click('[data-bs-target="#importBox"]');
    await admin.fill('#importForm textarea', 'Siti Aminah, siti@moe-dl.edu.my, Bahasa Melayu\nLim Wei Ming, lim@moe-dl.edu.my, Matematik\nSalah Domain, x@gmail.com');
    await admin.click('#importForm button');
    await wait(admin, 'text=siti@moe-dl.edu.my');
    assert(await admin.isVisible('.tb-toast >> text=2 guru didaftarkan'), 'Import pukal: 2 didaftar, 1 dilangkau');
    await idle(admin);
    await admin.screenshot({ path: SHOTS + '/04-users.png', fullPage: true });

    log('3. Guru tidak berdaftar memohon akses');
    const newbie = await newPage(browser, 'baru@moe-dl.edu.my');
    await login(newbie);
    await wait(newbie, '#regForm');
    await newbie.fill('#regForm [name=name]', 'Cikgu Baru');
    await newbie.screenshot({ path: SHOTS + '/05-request-access.png' });
    await newbie.click('#regForm button');
    await wait(newbie, 'text=Menunggu pengesahan');
    await admin.goto(BASE + '#/admin/users?status=pending');
    await wait(admin, 'text=baru@moe-dl.edu.my');
    await admin.click('[data-status="active"]');
    await admin.waitForTimeout(800);
    await newbie.reload();
    await wait(newbie, '.hero-card');
    assert(true, 'Guru yang disahkan boleh log masuk');

    log('4. Guru membuat tempahan (lulus automatik)');
    const guru = await newPage(browser, 'ali@moe-dl.edu.my');
    await login(guru);
    await wait(guru, '.hero-card');
    await idle(guru);
    await guru.screenshot({ path: SHOTS + '/06-guru-dashboard.png', fullPage: true });
    await guru.goto(BASE + '#/book?room_id=1&date=' + day);
    await wait(guru, '#bookingForm');
    await guru.waitForSelector('.dt-grid');
    const chips = guru.locator('.period-chip');
    await chips.nth(1).click(); await chips.nth(3).click();
    await guru.fill('[name=purpose]', 'PdP Sains Komputer');
    await guru.fill('[name=class_name]', '4 Bestari');
    await guru.waitForSelector('#checkResult.ok');
    await guru.screenshot({ path: SHOTS + '/07-book-form.png', fullPage: true });
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert(await guru.isVisible('.slip-head >> text=Diluluskan'), 'Tempahan tanpa pertindihan terus Diluluskan');
    await guru.screenshot({ path: SHOTS + '/08-booking-created.png', fullPage: true });

    log('5. Pertindihan disekat');
    await guru.goto(BASE + '#/book?room_id=1&date=' + day + '&start=08:30&end=09:00');
    await wait(guru, '#bookingForm');
    await guru.fill('[name=purpose]', 'Cuba bertindih');
    await guru.waitForSelector('#checkResult.bad');
    assert(await guru.isDisabled('#submitBtn'), 'Butang hantar dimatikan apabila bertindih');
    await guru.screenshot({ path: SHOTS + '/09-clash.png', fullPage: true });
    // Also verify the server rejects it even if the UI is bypassed
    const serverClash = await guru.evaluate(() => App.api('booking.create', { room_id: 1, date: document.querySelector('#date').value, start_time: '08:30', end_time: '09:00', purpose: 'x' }).then(() => 'accepted', (e) => e.message));
    assert(serverClash !== 'accepted', 'Pelayan juga menolak tempahan bertindih');

    log('6. Tempahan berulang');
    await guru.goto(BASE + '#/book?room_id=2&date=' + day + '&start=14:30&end=15:30');
    await wait(guru, '#bookingForm');
    await guru.check('#repeat');
    await guru.fill('#repeat_weeks', '4');
    await guru.dispatchEvent('#repeat_weeks', 'input');
    await guru.fill('[name=purpose]', 'Kelas Tambahan');
    await guru.waitForSelector('#checkResult.ok');
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert((await guru.locator('.series-chip').count()) === 4, 'Siri 4 minggu dicipta');

    log('7. Mod kelulusan: semua perlu kelulusan');
    await admin.goto(BASE + '#/admin/settings');
    await wait(admin, '#settingsForm');
    await admin.fill('[name=school_name]', 'SMK Taman Contoh');
    await admin.check('input[name=approval_mode][value=manual]');
    await admin.screenshot({ path: SHOTS + '/10-settings.png', fullPage: true });
    await admin.click('#settingsForm button.btn-lg');
    await wait(admin, '.tb-toast >> text=Tetapan sistem disimpan');
    await guru.goto(BASE + '#/book?room_id=3&date=' + day + '&start=10:20&end=10:50');
    await wait(guru, '#bookingForm');
    await guru.fill('[name=purpose]', 'Eksperimen');
    await guru.waitForSelector('#checkResult.ok');
    assert(await guru.isVisible('text=akan menunggu kelulusan'), 'Borang memaklumkan perlu kelulusan');
    await guru.click('#submitBtn');
    await wait(guru, '.success-banner');
    assert(await guru.isVisible('.slip-head >> text=Menunggu'), 'Tempahan berstatus Menunggu');

    log('8. Pentadbir meluluskan');
    await admin.goto(BASE + '#/admin/bookings?status=pending');
    await wait(admin, '.row-check');
    await admin.screenshot({ path: SHOTS + '/11-admin-bookings.png', fullPage: true });
    await admin.check('#checkAll');
    await admin.click('[data-bulk=approved]');
    await wait(admin, '.tb-toast >> text=dikemas kini');
    await guru.goto(BASE + '#/notifications');
    await wait(guru, 'text=Diluluskan');
    assert(true, 'Guru menerima notifikasi kelulusan');
    const mails = await (await fetch(BASE + '__mails')).json();
    assert(mails.some((m) => m.to === 'ali@moe-dl.edu.my' && /Diluluskan/.test(m.subject)), 'E-mel notifikasi dihantar kepada guru');

    log('9. Halaman lain');
    for (const [who, route, name] of [[guru, 'availability?date=' + day, '12-availability'], [guru, 'calendar', '13-calendar'], [guru, 'calendar?view=month', '14-calendar-month'],
        [guru, 'my-bookings', '15-my-bookings'], [guru, 'rooms', '16-rooms'], [guru, 'profile', '17-profile'], [admin, 'dashboard', '18-admin-dashboard'],
        [admin, 'admin/rooms?edit=1', '19-admin-rooms'], [admin, 'admin/closures', '20-closures'], [admin, 'admin/periods', '21-periods'],
        [admin, 'admin/reports?from=' + day.slice(0, 8) + '01&to=' + day.slice(0, 8) + '28', '22-reports'], [admin, 'admin/audit', '23-audit']]) {
        await who.goto(BASE + '#/' + route);
        await idle(who);
        await who.waitForTimeout(route.startsWith('calendar') ? 800 : 300);
        await who.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
    }
    assert(await admin.isVisible('text=SMK Taman Contoh'), 'Nama sekolah dikemas kini oleh admin');

    log('10. Penutupan bilik menyekat tempahan');
    await admin.goto(BASE + '#/admin/closures');
    await wait(admin, '#closureForm');
    await admin.selectOption('#closureForm [name=room_id]', '4');
    await admin.fill('#closureForm [name=start_date]', day);
    await admin.fill('#closureForm [name=reason]', 'Penyelenggaraan');
    await admin.click('#closureForm button');
    await wait(admin, '.tb-toast >> text=Penutupan berjaya');
    await guru.goto(BASE + '#/book?room_id=4&date=' + day + '&start=10:20&end=10:50');
    await wait(guru, '#bookingForm');
    await guru.fill('[name=purpose]', 'x');
    await guru.waitForSelector('#checkResult.bad');
    assert(await guru.isVisible('text=Bilik ditutup'), 'Bilik ditutup tidak boleh ditempah');

    log('11. Keselamatan');
    const forbidden = await guru.evaluate(() => App.api('admin.users.list').then(() => 'allowed', (e) => e.code));
    assert(forbidden === 'FORBIDDEN', 'Guru tidak boleh memanggil API pentadbir');
    const noToken = await (await fetch(BASE + 'gas', { method: 'POST', body: JSON.stringify({ action: 'dashboard' }) })).json();
    assert(noToken.code === 'AUTH', 'Permintaan tanpa token ditolak');
    const forged = await (await fetch(BASE + 'gas', { method: 'POST', body: JSON.stringify({ action: 'dashboard', token: 'palsu' }) })).json();
    assert(forged.code === 'AUTH', 'Token palsu ditolak');

    log('12. Paparan TV & telefon');
    const tv = await newPage(browser, null);
    await tv.goto(BASE + 'display.html');
    await tv.waitForSelector('.db-room');
    await tv.screenshot({ path: SHOTS + '/24-display.png', fullPage: true });
    const mobile = await newPage(browser, 'ali@moe-dl.edu.my', { viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    await login(mobile);
    await wait(mobile, '.hero-card');
    await idle(mobile);
    await mobile.screenshot({ path: SHOTS + '/25-mobile-dark.png', fullPage: true });

    await browser.close();
    console.log('\nMASALAH (' + problems.length + '):\n' + problems.join('\n'));
    process.exit(problems.length ? 1 : 0);
})().catch((e) => { console.error(e); console.log(problems.join('\n')); process.exit(1); });
