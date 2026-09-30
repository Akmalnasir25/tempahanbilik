/**
 * Sistem Tempahan Bilik Khas — backend Google Apps Script
 *
 * Data disimpan dalam Google Sheets (helaian yang "memiliki" skrip ini).
 * Sistem boleh dibuka terus melalui URL Web App ini (Index.html), atau
 * dari Firebase Hosting yang memanggil URL yang sama.
 *
 * Log masuk: pentadbir mendaftar nama guru sahaja. Guru pilih nama → masukkan
 * No. Kad Pengenalan sebagai kata laluan. Kali pertama, guru mendaftarkan
 * No. KP mereka sendiri sebagai kata laluan.
 */

var CONFIG = {
  // Kata laluan (No. KP, 12 digit) pentadbir pertama. Selepas setup(), pilih
  // "Pentadbir Sistem" di halaman log masuk dan masukkan No. KP ini.
  ADMIN_IC: '000000000000',
  ADMIN_NAME: 'Pentadbir Sistem',
};

var TZ = 'Asia/Kuala_Lumpur';
var BLOCKING = { pending: true, approved: true };
var SESSION_DAYS_REMEMBER = 30;
var SESSION_HOURS = 12;
var MAX_FAILS = 5;

var SCHEMA = {
  Settings: ['key', 'value'],
  Users: ['id', 'name', 'password_hash', 'email', 'phone', 'department', 'role', 'status', 'created_at', 'last_login_at'],
  Sessions: ['token_hash', 'user_id', 'expires_at', 'created_at'],
  Rooms: ['id', 'code', 'name', 'category', 'location', 'capacity', 'facilities', 'description', 'pic_name', 'color', 'requires_approval', 'status', 'created_at'],
  Periods: ['id', 'label', 'start_time', 'end_time', 'is_break'],
  Closures: ['id', 'room_id', 'start_date', 'end_date', 'reason', 'created_by', 'created_at'],
  Bookings: ['id', 'ref_no', 'user_id', 'room_id', 'date', 'start_time', 'end_time', 'purpose', 'class_name', 'subject', 'attendees', 'notes',
    'status', 'series_id', 'admin_remark', 'reviewed_by', 'reviewed_at', 'created_at', 'updated_at'],
  Notifications: ['id', 'user_id', 'title', 'message', 'link', 'is_read', 'created_at'],
  Audit: ['id', 'user_name', 'action', 'details', 'created_at'],
};
var NUMERIC = { id: 1, user_id: 1, room_id: 1, capacity: 1, attendees: 1, requires_approval: 1, is_break: 1, is_read: 1, reviewed_by: 1, created_by: 1 };

var DEFAULT_SETTINGS = {
  system_name: 'Sistem Tempahan Bilik Khas',
  school_name: 'Sekolah Menengah Kebangsaan Contoh',
  school_code: 'ABC1234',
  school_address: '',
  open_time: '07:00',
  close_time: '18:00',
  max_advance_days: '60',
  max_duration_hours: '6',
  max_recurring_weeks: '16',
  allow_weekend: '0',
  allow_registration: '1',
  public_display: '1',
  cancel_cutoff_hours: '0',
  approval_mode: 'auto',
  email_notifications: '1',
  app_url: '',
};

var STATUS_LABELS = { pending: 'Menunggu', approved: 'Diluluskan', rejected: 'Ditolak', cancelled: 'Dibatalkan' };
var DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
var MONTHS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
var MONTHS_SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

/* =====================================================================
 * Setup — jalankan SEKALI dari editor Apps Script (pilih "setup" → Run)
 * ===================================================================== */
function setup() {
  var ss = ss_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    sh.getRange('A:Z').setNumberFormat('@'); // simpan tarikh/masa sebagai teks
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]).setFontWeight('bold').setBackground('#0b1b3f').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  });
  var blank = ss.getSheetByName('Sheet1') || ss.getSheetByName('Helaian1');
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  var s = settings_();
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
    if (s[k] === undefined) setSetting_(k, DEFAULT_SETTINGS[k]);
  });

  if (!T('Rooms').rows().length) {
    [
      ['MK1', 'Makmal Komputer 1', 'Makmal', 'Blok A, Aras 2', 40, 'Komputer x40, Projektor, Pendingin hawa', 'En. Rahman', '#1d4ed8', 0],
      ['MK2', 'Makmal Komputer 2', 'Makmal', 'Blok A, Aras 3', 35, 'Komputer x35, Projektor, Pendingin hawa', 'En. Rahman', '#0891b2', 0],
      ['MS1', 'Makmal Sains 1', 'Makmal', 'Blok B, Aras 1', 40, 'Peralatan eksperimen, Kebuk wasap, Sinki', 'Pn. Aminah', '#059669', 0],
      ['BT', 'Bilik Tayang', 'Bilik Multimedia', 'Blok C, Aras 1', 80, 'Projektor HD, Sistem PA, Pendingin hawa', 'En. Lim', '#7c3aed', 0],
      ['PSS', 'Pusat Sumber Sekolah', 'Pusat Sumber', 'Blok D, Aras 1', 60, 'Koleksi buku, Sudut digital', 'Pn. Siti', '#d97706', 0],
      ['BM', 'Bilik Mesyuarat Utama', 'Bilik Mesyuarat', 'Blok Pentadbiran', 25, 'Skrin TV, Sidang video', 'Pejabat', '#475569', 1],
      ['DSK', 'Dewan Serbaguna', 'Dewan', 'Kompleks Sukan', 300, 'Pentas, Sistem PA', 'HEM', '#0f766e', 1],
    ].forEach(function (r) {
      T('Rooms').insert({ code: r[0], name: r[1], category: r[2], location: r[3], capacity: r[4], facilities: r[5], pic_name: r[6], color: r[7], requires_approval: r[8], status: 'active', created_at: nowStamp_() });
    });
  }
  if (!T('Periods').rows().length) {
    [['Waktu 1', '07:30', '08:00', 0], ['Waktu 2', '08:00', '08:30', 0], ['Waktu 3', '08:30', '09:00', 0], ['Waktu 4', '09:00', '09:30', 0],
      ['Waktu 5', '09:30', '10:00', 0], ['Rehat', '10:00', '10:20', 1], ['Waktu 6', '10:20', '10:50', 0], ['Waktu 7', '10:50', '11:20', 0],
      ['Waktu 8', '11:20', '11:50', 0], ['Waktu 9', '11:50', '12:20', 0], ['Waktu 10', '12:20', '12:50', 0], ['Waktu 11', '12:50', '13:20', 0],
      ['Waktu 12', '13:20', '13:50', 0], ['Petang 1', '14:30', '15:30', 0], ['Petang 2', '15:30', '16:30', 0], ['Petang 3', '16:30', '17:30', 0],
    ].forEach(function (p) { T('Periods').insert({ label: p[0], start_time: p[1], end_time: p[2], is_break: p[3] }); });
  }
  if (!T('Users').rows().some(function (u) { return u.role === 'admin'; })) {
    var ic = normIc_(CONFIG.ADMIN_IC);
    T('Users').insert({ name: CONFIG.ADMIN_NAME, password_hash: hashSecret_(ic), role: 'admin', status: 'active', created_at: nowStamp_() });
  }
  return 'Setup selesai. Log masuk sebagai "' + CONFIG.ADMIN_NAME + '" menggunakan No. KP dalam CONFIG.ADMIN_IC.';
}

/* =====================================================================
 * Entry points
 *  - doGet  : papar aplikasi (Index.html) atau paparan TV (?page=display)
 *  - doPost : API JSON untuk frontend di Firebase Hosting
 *  - api    : API yang sama untuk google.script.run (apabila dibuka terus dari GAS)
 * ===================================================================== */
function doGet(e) {
  var page = e && e.parameter && e.parameter.page;
  var file = page === 'display' ? 'Display' : 'Index';
  var t;
  try {
    t = HtmlService.createTemplateFromFile(file);
  } catch (err) {
    return json_({ ok: true, data: { service: 'tempahan-bilik', note: 'Fail ' + file + '.html tiada; hanya API tersedia.' } });
  }
  t.scriptUrl = ScriptApp.getService().getUrl();
  var name = '';
  try { name = setting_('system_name'); } catch (err2) { name = DEFAULT_SETTINGS.system_name; }
  return t.evaluate()
    .setTitle(page === 'display' ? 'Jadual Bilik Khas Hari Ini' : name)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, code: 'BAD_REQUEST', error: 'Permintaan tidak sah.' });
  }
  return json_(handle_(req));
}

function api(reqJson) {
  var req;
  try {
    req = JSON.parse(reqJson || '{}');
  } catch (err) {
    return JSON.stringify({ ok: false, code: 'BAD_REQUEST', error: 'Permintaan tidak sah.' });
  }
  return JSON.stringify(handle_(req));
}

function handle_(req) {
  var action = String(req.action || '');
  var handler = ACTIONS[action];
  if (!handler) return { ok: false, code: 'NOT_FOUND', error: 'Tindakan tidak dikenali: ' + action };
  var lock = null;
  try {
    if (handler.write) {
      lock = LockService.getScriptLock();
      lock.waitLock(25000);
    }
    var ctx = { req: req, user: null, token: req.token || '' };
    if (handler.auth !== false) {
      ctx.user = sessionUser_(req.token);
      if (handler.admin && ctx.user.role !== 'admin') throw apiError_('FORBIDDEN', 'Hanya pentadbir boleh melakukan tindakan ini.');
    }
    var data = handler.fn(req.data || {}, ctx);
    var out = { ok: true, data: data };
    if (ctx.user && ctx.user.id) out.meta = meta_(ctx.user);
    return out;
  } catch (err) {
    if (err && err.apiCode) return { ok: false, code: err.apiCode, error: err.message, info: err.info || null };
    console.error(err && err.stack || err);
    return { ok: false, code: 'SERVER', error: 'Ralat pelayan: ' + (err && err.message || err) };
  } finally {
    if (lock) lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiError_(code, message, info) {
  var e = new Error(message);
  e.apiCode = code;
  e.info = info;
  return e;
}

/* =====================================================================
 * Auth — nama + kata laluan, sesi berasaskan token
 * ===================================================================== */
function hex_(bytes) {
  return bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s))); }

/** Salted, iterated SHA-256. Stored as "salt$hash". */
function hashSecret_(secret, salt) {
  salt = salt || Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  var h = salt;
  for (var i = 0; i < 300; i++) h = sha_(h + ':' + salt + ':' + secret);
  return salt + '$' + h;
}
function checkSecret_(secret, stored) {
  if (!stored || String(stored).indexOf('$') === -1) return false;
  var salt = String(stored).split('$')[0];
  var a = hashSecret_(secret, salt), b = String(stored);
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function normIc_(ic) { return String(ic || '').replace(/\D/g, ''); }
function validIc_(ic) { return /^\d{12}$/.test(ic); }
function checkPassword_(pw) {
  pw = String(pw || '');
  if (pw.length < 6) throw apiError_('VALIDATION', 'Kata laluan mestilah sekurang-kurangnya 6 aksara.');
  return pw;
}
/** Login secret: an IC number is compared digits-only so "900101-10-1234" == "900101101234". */
function loginSecret_(pw) {
  var digits = normIc_(pw);
  return /^[\d\s-]+$/.test(String(pw || '')) && digits ? digits : String(pw || '');
}

function throttle_(userId) {
  var n = Number(CacheService.getScriptCache().get('fail_' + userId) || 0);
  if (n >= MAX_FAILS) throw apiError_('LOCKED', 'Terlalu banyak cubaan. Sila cuba semula selepas 15 minit atau hubungi pentadbir.');
}
function recordFail_(userId) {
  var c = CacheService.getScriptCache();
  c.put('fail_' + userId, String(Number(c.get('fail_' + userId) || 0) + 1), 900);
}

function createSession_(user, remember) {
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var ms = remember ? SESSION_DAYS_REMEMBER * 86400000 : SESSION_HOURS * 3600000;
  var expires = Utilities.formatDate(new Date(Date.now() + ms), TZ, 'yyyy-MM-dd HH:mm:ss');
  var now = nowStamp_();
  // Remove this user's expired sessions while we are here.
  var old = T('Sessions').rows().filter(function (s) { return s.expires_at < now; }).sort(function (a, b) { return b._row - a._row; });
  old.slice(0, 50).forEach(function (s) { T('Sessions').sheet.deleteRow(s._row); });
  if (old.length) T('Sessions')._rows = null;
  T('Sessions').insert({ token_hash: sha_(token), user_id: user.id, expires_at: expires, created_at: now });
  CacheService.getScriptCache().remove('fail_' + user.id);
  T('Users').update(user, { last_login_at: now });
  return token;
}

function sessionUser_(token) {
  if (!token) throw apiError_('AUTH', 'Sila log masuk.');
  var th = sha_(token);
  var cache = CacheService.getScriptCache();
  var uid = cache.get('ses_' + th);
  if (!uid) {
    var s = findBy_('Sessions', 'token_hash', th);
    if (!s || s.expires_at < nowStamp_()) throw apiError_('AUTH', 'Sesi tamat. Sila log masuk semula.');
    uid = String(s.user_id);
    cache.put('ses_' + th, uid, 600);
  }
  var user = T('Users').find(uid);
  // A password reset clears password_hash, which must end every existing session at once.
  if (!user || user.status !== 'active' || !user.password_hash) {
    cache.remove('ses_' + th);
    throw apiError_('AUTH', 'Akaun tidak aktif. Sila hubungi pentadbir.');
  }
  return user;
}

function userOut_(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, department: u.department, role: u.role, status: u.status,
    activated: !!u.password_hash, created_at: u.created_at, last_login_at: u.last_login_at };
}

function meta_(user) {
  var unread = T('Notifications').rows().filter(function (n) { return n.user_id === user.id && !n.is_read; }).length;
  var m = { unread: unread };
  if (user.role === 'admin') {
    var today = today_();
    m.pending = T('Bookings').rows().filter(function (b) { return b.status === 'pending' && b.date >= today; }).length;
    m.pendingUsers = T('Users').rows().filter(function (u) { return u.status === 'pending'; }).length;
  }
  return m;
}

/* =====================================================================
 * Sheet storage layer
 * ===================================================================== */
var _ss = null;
function ss_() {
  if (_ss) return _ss;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  _ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  return _ss;
}

var _tables = {};
function T(name) {
  if (!_tables[name]) _tables[name] = new Table_(name);
  return _tables[name];
}

function Table_(name) {
  this.name = name;
  this.cols = SCHEMA[name];
  this.sheet = ss_().getSheetByName(name);
  if (!this.sheet) throw apiError_('SETUP', 'Helaian "' + name + '" tiada. Sila jalankan fungsi setup() dalam Apps Script.');
  this._rows = null;
}

Table_.prototype.rows = function () {
  if (this._rows) return this._rows;
  var last = this.sheet.getLastRow();
  var n = this.cols.length;
  var vals = last > 1 ? this.sheet.getRange(2, 1, last - 1, n).getValues() : [];
  var cols = this.cols;
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] === null) continue;
    var o = { _row: i + 2 };
    for (var j = 0; j < n; j++) o[cols[j]] = norm_(cols[j], vals[i][j]);
    out.push(o);
  }
  this._rows = out;
  return out;
};

Table_.prototype.find = function (id) {
  id = Number(id);
  var rows = this.rows();
  for (var i = 0; i < rows.length; i++) if (rows[i].id === id) return rows[i];
  return null;
};

Table_.prototype.toRow_ = function (obj) {
  return this.cols.map(function (c) {
    var v = obj[c];
    if (v === undefined || v === null) return '';
    if (NUMERIC[c]) return v === '' ? '' : Number(v);
    return String(v);
  });
};

Table_.prototype.insert = function (obj) {
  var rows = this.rows();
  if (this.cols[0] === 'id') {
    var max = 0;
    rows.forEach(function (r) { if (r.id > max) max = r.id; });
    obj.id = max + 1;
  }
  var values = this.toRow_(obj);
  this.sheet.appendRow(values);
  var rec = { _row: this.sheet.getLastRow() };
  var cols = this.cols;
  cols.forEach(function (c, j) { rec[c] = norm_(c, values[j]); });
  rows.push(rec);
  return rec;
};

Table_.prototype.update = function (id, patch) {
  var rec = typeof id === 'object' ? id : this.find(id);
  if (!rec) throw apiError_('NOT_FOUND', 'Rekod tidak dijumpai.');
  Object.keys(patch).forEach(function (k) { rec[k] = patch[k]; });
  var values = this.toRow_(rec);
  this.sheet.getRange(rec._row, 1, 1, values.length).setValues([values]);
  var cols = this.cols;
  cols.forEach(function (c, j) { rec[c] = norm_(c, values[j]); });
  return rec;
};

Table_.prototype.remove = function (id) {
  var rec = typeof id === 'object' ? id : this.find(id);
  if (!rec) return;
  this.sheet.deleteRow(rec._row);
  this._rows = null;
};

function norm_(col, v) {
  if (v instanceof Date) {
    if (/time$/.test(col)) return Utilities.formatDate(v, TZ, 'HH:mm');
    if (/_at$/.test(col)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd HH:mm:ss');
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  if (NUMERIC[col]) return v === '' || v === null ? (col === 'id' ? '' : null) : Number(v);
  return v === null || v === undefined ? '' : String(v);
}

function findBy_(table, col, value) {
  var rows = T(table).rows();
  for (var i = 0; i < rows.length; i++) if (String(rows[i][col]).toLowerCase() === String(value).toLowerCase()) return rows[i];
  return null;
}

function settings_() {
  var o = {};
  T('Settings').rows().forEach(function (r) { o[r.key] = r.value; });
  return o;
}

function setting_(key) {
  var s = settings_();
  return s[key] !== undefined ? s[key] : DEFAULT_SETTINGS[key];
}

function setSetting_(key, value) {
  var rec = findBy_('Settings', 'key', key);
  if (rec) {
    rec.value = String(value);
    T('Settings').sheet.getRange(rec._row, 1, 1, 2).setValues([[key, String(value)]]);
  } else {
    T('Settings').insert({ key: key, value: String(value) });
  }
}

/* ---------- School logo ----------
 * Stored as a data URL split across Settings rows "logo:0", "logo:1", …
 * because a single Sheets cell holds at most 50,000 characters. */
var LOGO_CHUNK = 40000;
var LOGO_MAX = 200000;

function logo_() {
  return T('Settings').rows().filter(function (r) { return /^logo:\d+$/.test(r.key); })
    .sort(function (a, b) { return Number(a.key.slice(5)) - Number(b.key.slice(5)); })
    .map(function (r) { return r.value; }).join('');
}

function setLogo_(dataUrl) {
  T('Settings').rows().filter(function (r) { return /^logo:\d+$/.test(r.key); })
    .sort(function (a, b) { return b._row - a._row; })
    .forEach(function (r) { T('Settings').sheet.deleteRow(r._row); });
  T('Settings')._rows = null;
  for (var i = 0; i * LOGO_CHUNK < dataUrl.length; i++) {
    T('Settings').insert({ key: 'logo:' + i, value: dataUrl.slice(i * LOGO_CHUNK, (i + 1) * LOGO_CHUNK) });
  }
}

function clean_(o) {
  var r = {};
  Object.keys(o).forEach(function (k) { if (k !== '_row') r[k] = o[k]; });
  return r;
}

/* =====================================================================
 * Date helpers (dates are 'yyyy-MM-dd', times 'HH:mm', local time TZ)
 * ===================================================================== */
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function nowTime_() { return Utilities.formatDate(new Date(), TZ, 'HH:mm'); }
function nowStamp_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function validDate_(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d))) return false;
  var x = new Date(d + 'T00:00:00Z');
  return !isNaN(x) && x.toISOString().slice(0, 10) === d;
}
function validTime_(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t)); }
function addDays_(d, n) {
  var x = new Date(d + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
function dow_(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
function toMin_(t) { var p = String(t).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
function fmtDate_(d, withDay, short) {
  if (!validDate_(d)) return d;
  var x = new Date(d + 'T00:00:00Z');
  var s = x.getUTCDate() + ' ' + (short ? MONTHS_SHORT : MONTHS)[x.getUTCMonth()] + ' ' + x.getUTCFullYear();
  return withDay ? DAYS[x.getUTCDay()] + ', ' + s : s;
}

/* =====================================================================
 * Audit & notifications
 * ===================================================================== */
function audit_(ctx, action, details) {
  T('Audit').insert({ user_name: ctx && ctx.user ? ctx.user.name : '', action: action, details: details || '', created_at: nowStamp_() });
}

function notify_(userId, title, message, link) {
  T('Notifications').insert({ user_id: userId, title: title, message: message || '', link: link || '', is_read: 0, created_at: nowStamp_() });
  if (setting_('email_notifications') !== '1') return;
  var u = T('Users').find(userId);
  if (!u || !u.email) return;
  try {
    var url = String(setting_('app_url') || '');
    var html = '<div style="font-family:Arial,sans-serif;max-width:560px">' +
      '<div style="background:#0b1b3f;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0"><strong>' + htmlEsc_(setting_('system_name')) + '</strong><br><small>' + htmlEsc_(setting_('school_name')) + '</small></div>' +
      '<div style="border:1px solid #e4e8f1;border-top:0;padding:20px;border-radius:0 0 10px 10px"><h3 style="margin:0 0 8px">' + htmlEsc_(title) + '</h3><p>' + htmlEsc_(message) + '</p>' +
      (url ? '<p><a href="' + htmlEsc_(url + (link || '')) + '" style="background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Buka sistem</a></p>' : '') +
      '</div></div>';
    MailApp.sendEmail({ to: u.email, subject: '[' + setting_('system_name') + '] ' + title, htmlBody: html, name: setting_('system_name') });
  } catch (err) {
    console.warn('E-mel gagal dihantar: ' + err);
  }
}

function notifyAdmins_(title, message, link, exceptId) {
  T('Users').rows().forEach(function (u) {
    if (u.role === 'admin' && u.status === 'active' && u.id !== exceptId) notify_(u.id, title, message, link);
  });
}

function htmlEsc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

/* =====================================================================
 * Booking domain logic
 * ===================================================================== */
function roomNeedsApproval_(room) {
  var mode = setting_('approval_mode');
  if (mode === 'manual') return true;
  if (mode === 'room') return !!Number(room.requires_approval);
  return false;
}

function conflicts_(roomId, date, start, end, excludeId) {
  return T('Bookings').rows().filter(function (b) {
    return b.room_id === Number(roomId) && b.date === date && BLOCKING[b.status] && b.start_time < end && b.end_time > start && b.id !== Number(excludeId || 0);
  });
}

function closureFor_(roomId, date) {
  var hits = T('Closures').rows().filter(function (c) {
    return (!c.room_id || c.room_id === Number(roomId)) && c.start_date <= date && c.end_date >= date;
  });
  return hits[0] || null;
}

function userName_(id) {
  var u = T('Users').find(id);
  return u ? u.name : '(pengguna dipadam)';
}

function validateSlot_(room, date, start, end, user, excludeId) {
  var errors = [];
  var admin = user.role === 'admin';
  if (room.status !== 'active') errors.push('Bilik ' + room.name + ' tidak dibuka untuk tempahan.');
  if (!validDate_(date)) return ['Tarikh tidak sah.'];
  if (!validTime_(start) || !validTime_(end)) return ['Masa tidak sah.'];
  if (end <= start) errors.push('Masa tamat mesti selepas masa mula.');
  if (date + ' ' + start < today_() + ' ' + nowTime_()) errors.push('Tidak boleh menempah untuk masa yang telah berlalu.');

  if (!admin) {
    var maxDays = Number(setting_('max_advance_days'));
    if (maxDays > 0 && date > addDays_(today_(), maxDays)) errors.push('Tempahan hanya dibenarkan sehingga ' + maxDays + ' hari lebih awal.');
    var d = dow_(date);
    if (setting_('allow_weekend') !== '1' && (d === 0 || d === 6)) errors.push('Tempahan pada hujung minggu tidak dibenarkan.');
    var open = setting_('open_time'), close = setting_('close_time');
    if (start < open || end > close) errors.push('Masa tempahan mestilah dalam waktu operasi (' + open + ' – ' + close + ').');
    var maxH = Number(setting_('max_duration_hours'));
    if (maxH > 0 && end > start && toMin_(end) - toMin_(start) > maxH * 60) errors.push('Tempoh tempahan tidak boleh melebihi ' + maxH + ' jam.');
  }
  var closure = closureFor_(room.id, date);
  if (closure) errors.push('Bilik ditutup pada ' + fmtDate_(date) + ': ' + closure.reason + '.');
  if (end > start) {
    conflicts_(room.id, date, start, end, excludeId).forEach(function (c) {
      errors.push('Bertembung dengan tempahan ' + c.ref_no + ' oleh ' + userName_(c.user_id) + ' (' + c.start_time + ' – ' + c.end_time + ') pada ' + fmtDate_(date, false, true) + '.');
    });
  }
  return errors;
}

function genRef_() {
  var existing = {};
  T('Bookings').rows().forEach(function (b) { existing[b.ref_no] = 1; });
  var ref;
  do {
    ref = 'TB' + Utilities.formatDate(new Date(), TZ, 'yyMM') + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5).toUpperCase();
  } while (existing[ref]);
  return ref;
}

function canModify_(b, user) {
  if (!BLOCKING[b.status]) return false;
  if (user.role === 'admin') return true;
  if (b.user_id !== user.id) return false;
  var cutoff = Number(setting_('cancel_cutoff_hours')) || 0;
  var startMs = new Date(b.date + 'T' + b.start_time + ':00+08:00').getTime();
  return startMs - cutoff * 3600000 > Date.now();
}

function bookingOut_(b, user) {
  var r = T('Rooms').find(b.room_id) || {};
  var o = clean_(b);
  o.room_name = r.name || '-';
  o.room_code = r.code || '';
  o.room_color = r.color || '#64748b';
  o.room_location = r.location || '';
  o.user_name = userName_(b.user_id);
  if (user) o.can_modify = canModify_(b, user);
  return o;
}

function readBookingInput_(d) {
  return {
    room_id: Number(d.room_id),
    date: String(d.date || ''),
    start_time: String(d.start_time || ''),
    end_time: String(d.end_time || ''),
    purpose: String(d.purpose || '').trim().slice(0, 150),
    class_name: String(d.class_name || '').trim().slice(0, 50),
    subject: String(d.subject || '').trim().slice(0, 80),
    attendees: d.attendees === '' || d.attendees == null ? '' : Math.max(0, parseInt(d.attendees, 10) || 0),
    notes: String(d.notes || '').trim().slice(0, 500),
  };
}

function checkBasics_(room, input) {
  if (!room) throw apiError_('VALIDATION', 'Sila pilih bilik.');
  if (!input.purpose) throw apiError_('VALIDATION', 'Sila nyatakan tujuan tempahan.');
  if (input.attendees && room.capacity > 0 && input.attendees > room.capacity) {
    throw apiError_('VALIDATION', 'Bilangan peserta (' + input.attendees + ') melebihi kapasiti bilik (' + room.capacity + ').');
  }
}

function changeStatus_(b, status, actor, remark) {
  var allowed = { pending: ['approved', 'rejected', 'cancelled'], approved: ['cancelled', 'rejected'], rejected: ['approved'] };
  if ((allowed[b.status] || []).indexOf(status) === -1) return 'Perubahan status tidak dibenarkan.';
  if (status === 'approved' && b.status === 'rejected') {
    var clash = conflicts_(b.room_id, b.date, b.start_time, b.end_time, b.id);
    if (clash.length) return 'Slot ini kini telah ditempah oleh ' + userName_(clash[0].user_id) + ' (' + clash[0].ref_no + ').';
  }
  var prev = b.status;
  var patch = { status: status, updated_at: nowStamp_() };
  if (remark) patch.admin_remark = remark;
  if (actor.role === 'admin') { patch.reviewed_by = actor.id; patch.reviewed_at = nowStamp_(); }
  T('Bookings').update(b, patch);
  var room = T('Rooms').find(b.room_id) || { name: '-' };
  audit_({ user: actor }, 'booking.' + status, b.ref_no + (remark ? ' – ' + remark : ''));
  if (b.user_id !== actor.id) {
    notify_(b.user_id, 'Tempahan ' + b.ref_no + ' ' + STATUS_LABELS[status],
      room.name + ', ' + fmtDate_(b.date, false, true) + ' (' + b.start_time + ' – ' + b.end_time + ')' + (remark ? '. Catatan: ' + remark : ''), '#/booking?id=' + b.id);
  } else if (status === 'cancelled' && prev === 'pending') {
    notifyAdmins_('Tempahan ' + b.ref_no + ' ditarik balik', actor.name + ' membatalkan permohonan.', '#/booking?id=' + b.id);
  }
  return '';
}

/* =====================================================================
 * Actions
 * ===================================================================== */
var ACTIONS = {};
function action_(name, opts, fn) {
  opts.fn = fn;
  ACTIONS[name] = opts;
}

function publicSettings_() {
  var s = settings_();
  var out = {};
  Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = s[k] !== undefined ? s[k] : DEFAULT_SETTINGS[k]; });
  return out;
}

/* ---------- Public ---------- */
action_('config', { auth: false }, function () {
  var s = publicSettings_();
  var teachers = T('Users').rows().filter(function (u) { return u.status === 'active'; })
    .map(function (u) { return { id: u.id, name: u.name, department: u.department, activated: !!u.password_hash }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
  return { system_name: s.system_name, school_name: s.school_name, allow_registration: s.allow_registration, teachers: teachers, logo: logo_(),
    rooms: T('Rooms').rows().filter(function (r) { return r.status === 'active'; }).length };
});

action_('display', { auth: false }, function () {
  if (setting_('public_display') !== '1') throw apiError_('FORBIDDEN', 'Paparan awam dimatikan oleh pentadbir.');
  var today = today_();
  var rooms = T('Rooms').rows().filter(function (r) { return r.status === 'active'; }).map(function (r) {
    var c = closureFor_(r.id, today);
    return { id: r.id, name: r.name, location: r.location, color: r.color, closed: c ? c.reason : '' };
  });
  var bookings = T('Bookings').rows().filter(function (b) { return b.date === today && BLOCKING[b.status]; })
    .sort(function (a, b) { return a.start_time < b.start_time ? -1 : 1; })
    .map(function (b) { return { room_id: b.room_id, start: b.start_time, end: b.end_time, purpose: b.purpose, class_name: b.class_name, user: userName_(b.user_id) }; });
  return { school_name: setting_('school_name'), logo: logo_(), date: today, dateLabel: fmtDate_(today, true), now: nowTime_(), rooms: rooms, bookings: bookings };
});

/* ---------- Session ---------- */
/* ---------- Log masuk ---------- */
action_('login', { auth: false, write: true }, function (d) {
  var u = T('Users').find(d.user_id);
  if (!u || u.status !== 'active') throw apiError_('VALIDATION', 'Sila pilih nama anda daripada senarai.');
  if (!u.password_hash) throw apiError_('NOT_ACTIVATED', 'Ini log masuk kali pertama anda. Sila daftarkan No. KP anda sebagai kata laluan.');
  throttle_(u.id);
  if (!checkSecret_(loginSecret_(d.password), u.password_hash)) {
    recordFail_(u.id);
    audit_({ user: u }, 'auth.fail', 'Kata laluan salah');
    throw apiError_('VALIDATION', 'No. KP / kata laluan tidak tepat.');
  }
  audit_({ user: u }, 'auth.login', '');
  return { token: createSession_(u, !!d.remember) };
});

action_('activate', { auth: false, write: true }, function (d) {
  var u = T('Users').find(d.user_id);
  if (!u || u.status !== 'active') throw apiError_('VALIDATION', 'Sila pilih nama anda daripada senarai.');
  if (u.password_hash) throw apiError_('VALIDATION', 'Akaun ini sudah didaftarkan. Sila log masuk dengan No. KP anda.');
  var ic = normIc_(d.ic);
  if (!validIc_(ic)) throw apiError_('VALIDATION', 'No. Kad Pengenalan mestilah 12 digit.');
  if (normIc_(d.ic_confirm) !== ic) throw apiError_('VALIDATION', 'Pengesahan No. KP tidak sepadan.');
  T('Users').update(u, { password_hash: hashSecret_(ic) });
  audit_({ user: u }, 'auth.activate', 'No. KP didaftarkan sebagai kata laluan');
  return { token: createSession_(u, !!d.remember) };
});

action_('register', { auth: false, write: true }, function (d) {
  if (setting_('allow_registration') !== '1') throw apiError_('FORBIDDEN', 'Pendaftaran sendiri ditutup. Sila hubungi pentadbir.');
  var name = String(d.name || '').trim();
  var ic = normIc_(d.ic);
  if (name.length < 3) throw apiError_('VALIDATION', 'Sila masukkan nama penuh.');
  if (!validIc_(ic)) throw apiError_('VALIDATION', 'No. Kad Pengenalan mestilah 12 digit.');
  if (findBy_('Users', 'name', name)) throw apiError_('VALIDATION', 'Nama ini sudah wujud dalam senarai. Sila pilih nama anda di halaman log masuk.');
  var u = T('Users').insert({ name: name, password_hash: hashSecret_(ic), email: String(d.email || '').trim(), phone: String(d.phone || '').trim(),
    department: String(d.department || '').trim(), role: 'guru', status: 'pending', created_at: nowStamp_() });
  audit_({ user: u }, 'auth.register', name);
  notifyAdmins_('Pendaftaran guru baharu', name + ' memohon akaun dan menunggu pengesahan.', '#/admin/users?status=pending');
  return { status: 'pending' };
});

action_('logout', { write: true }, function (d, ctx) {
  var th = sha_(ctx.token);
  CacheService.getScriptCache().remove('ses_' + th);
  var s = findBy_('Sessions', 'token_hash', th);
  if (s) T('Sessions').remove(s);
  return true;
});

action_('session', {}, function (d, ctx) {
  return {
    user: userOut_(ctx.user),
    settings: publicSettings_(),
    rooms: T('Rooms').rows().map(clean_),
    periods: T('Periods').rows().map(clean_).sort(function (a, b) { return a.start_time < b.start_time ? -1 : 1; }),
    today: today_(),
    now: nowTime_(),
  };
});

action_('password.change', { write: true }, function (d, ctx) {
  if (!checkSecret_(loginSecret_(d.current), ctx.user.password_hash)) throw apiError_('VALIDATION', 'Kata laluan semasa tidak tepat.');
  var pw = loginSecret_(checkPassword_(d.password));
  T('Users').update(ctx.user, { password_hash: hashSecret_(pw) });
  audit_(ctx, 'auth.password', '');
  return true;
});

action_('profile.update', { write: true }, function (d, ctx) {
  var name = String(d.name || '').trim();
  if (name.length < 3) throw apiError_('VALIDATION', 'Sila masukkan nama penuh.');
  var u = T('Users').update(ctx.user, { name: name, email: String(d.email || '').trim(), phone: String(d.phone || '').trim(), department: String(d.department || '').trim() });
  audit_(ctx, 'profile.update', '');
  return userOut_(u);
});

/* ---------- Dashboard ---------- */
action_('dashboard', {}, function (d, ctx) {
  var user = ctx.user, today = today_(), now = nowTime_();
  var monthStart = today.slice(0, 8) + '01', monthEnd = today.slice(0, 8) + '31';
  var bookings = T('Bookings').rows();
  var active = T('Rooms').rows().filter(function (r) { return r.status === 'active'; });
  var todays = bookings.filter(function (b) { return b.date === today && BLOCKING[b.status]; })
    .sort(function (a, b) { return a.start_time < b.start_time ? -1 : 1; });

  var freeNow = active.filter(function (r) {
    if (closureFor_(r.id, today)) return false;
    return !todays.some(function (b) { return b.room_id === r.id && b.start_time <= now && b.end_time > now; });
  }).map(function (r) {
    var next = todays.filter(function (b) { return b.room_id === r.id && b.start_time > now; })[0];
    return { id: r.id, name: r.name, color: r.color, next_start: next ? next.start_time : '' };
  });

  var mine = bookings.filter(function (b) { return b.user_id === user.id && BLOCKING[b.status] && (b.date > today || (b.date === today && b.end_time > now)); })
    .sort(function (a, b) { return (a.date + a.start_time) < (b.date + b.start_time) ? -1 : 1; });

  var out = {
    today: todays.map(function (b) { return bookingOut_(b); }),
    upcoming: mine.slice(0, 6).map(function (b) { return bookingOut_(b); }),
    freeNow: freeNow,
    activeRooms: active.length,
    now: now,
  };
  var inMonth = function (b) { return b.date >= monthStart && b.date <= monthEnd && BLOCKING[b.status]; };
  if (user.role === 'admin') {
    var pending = bookings.filter(function (b) { return b.status === 'pending' && b.date >= today; })
      .sort(function (a, b) { return (a.date + a.start_time) < (b.date + b.start_time) ? -1 : 1; });
    out.stats = [todays.length, pending.length, bookings.filter(inMonth).length, T('Users').rows().filter(function (u) { return u.status === 'active'; }).length];
    out.pending = pending.slice(0, 6).map(function (b) { return bookingOut_(b); });
    var labels = [], data = [];
    var y = Number(today.slice(0, 4)), m = Number(today.slice(5, 7));
    for (var i = 5; i >= 0; i--) {
      var mm = m - i, yy = y;
      while (mm < 1) { mm += 12; yy--; }
      var key = yy + '-' + ('0' + mm).slice(-2);
      labels.push(MONTHS_SHORT[mm - 1] + ' ' + String(yy).slice(2));
      data.push(bookings.filter(function (b) { return BLOCKING[b.status] && b.date.slice(0, 7) === key; }).length);
    }
    out.trend = { labels: labels, data: data };
    out.perRoom = T('Rooms').rows().filter(function (r) { return r.status !== 'inactive'; }).map(function (r) {
      return { code: r.code, name: r.name, color: r.color, n: bookings.filter(function (b) { return b.room_id === r.id && inMonth(b); }).length };
    }).sort(function (a, b) { return b.n - a.n; });
  } else {
    out.stats = [mine.length, mine.filter(function (b) { return b.status === 'pending'; }).length,
      bookings.filter(function (b) { return b.user_id === user.id && inMonth(b); }).length, freeNow.length];
  }
  return out;
});

/* ---------- Availability, calendar & clash check ---------- */
action_('availability', {}, function (d) {
  var date = String(d.date || '');
  if (!validDate_(date)) throw apiError_('VALIDATION', 'Tarikh tidak sah.');
  var roomId = Number(d.room_id) || 0, exclude = Number(d.exclude) || 0;
  var bookings = T('Bookings').rows().filter(function (b) {
    return b.date === date && BLOCKING[b.status] && (!roomId || b.room_id === roomId) && b.id !== exclude;
  }).map(function (b) {
    return { id: b.id, room_id: b.room_id, start: b.start_time, end: b.end_time, purpose: b.purpose, user: userName_(b.user_id), status: b.status, ref: b.ref_no };
  });
  var closures = {};
  T('Rooms').rows().forEach(function (r) {
    if (roomId && r.id !== roomId) return;
    var c = closureFor_(r.id, date);
    if (c) closures[r.id] = c.reason;
  });
  return { date: date, bookings: bookings, closures: closures, open: setting_('open_time'), close: setting_('close_time'), today: today_(), now: nowTime_() };
});

action_('check', {}, function (d, ctx) {
  var room = T('Rooms').find(d.room_id);
  if (!room) return { ok: false, errors: ['Sila pilih bilik.'] };
  var date = String(d.date || '');
  if (!validDate_(date)) return { ok: false, errors: ['Tarikh tidak sah.'] };
  var weeks = Math.max(1, Math.min(Number(setting_('max_recurring_weeks')), Number(d.repeat_weeks) || 1));
  var errors = [];
  for (var i = 0; i < weeks; i++) {
    var dd = addDays_(date, i * 7);
    validateSlot_(room, dd, String(d.start || ''), String(d.end || ''), ctx.user, Number(d.exclude) || 0).forEach(function (e) {
      var msg = (weeks > 1 ? fmtDate_(dd, false, true) + ': ' : '') + e;
      if (errors.indexOf(msg) === -1) errors.push(msg);
    });
  }
  return { ok: !errors.length, errors: errors, approval: roomNeedsApproval_(room) && ctx.user.role !== 'admin' };
});

action_('events', {}, function (d, ctx) {
  var from = String(d.start || '').slice(0, 10), to = String(d.end || '').slice(0, 10);
  if (!validDate_(from) || !validDate_(to)) throw apiError_('VALIDATION', 'Julat tarikh tidak sah.');
  var roomId = Number(d.room_id) || 0;
  var events = T('Bookings').rows().filter(function (b) {
    return b.date >= from && b.date <= to && BLOCKING[b.status] && (!roomId || b.room_id === roomId) && (!d.mine || b.user_id === ctx.user.id);
  }).map(function (b) {
    var o = bookingOut_(b);
    return {
      id: b.id, title: (roomId ? '' : o.room_code + ' · ') + b.purpose,
      start: b.date + 'T' + b.start_time, end: b.date + 'T' + b.end_time,
      backgroundColor: o.room_color, borderColor: o.room_color, classNames: b.status === 'pending' ? ['ev-pending'] : [],
      extendedProps: { ref: b.ref_no, room: o.room_name, user: o.user_name, purpose: b.purpose, 'class': b.class_name, subject: b.subject, status: b.status, statusLabel: STATUS_LABELS[b.status], time: b.start_time + ' – ' + b.end_time },
    };
  });
  T('Closures').rows().forEach(function (c) {
    if (c.start_date > to || c.end_date < from) return;
    if (roomId && c.room_id && c.room_id !== roomId) return;
    var r = c.room_id ? T('Rooms').find(c.room_id) : null;
    events.push({ title: 'DITUTUP: ' + (r ? r.name : 'Semua bilik') + ' – ' + c.reason, start: c.start_date, end: addDays_(c.end_date, 1), allDay: true,
      display: 'block', backgroundColor: '#64748b', borderColor: '#64748b', classNames: ['ev-closure'], extendedProps: { closure: true } });
  });
  return events;
});

/* ---------- Bookings ---------- */
action_('booking.create', { write: true }, function (d, ctx) {
  var user = ctx.user;
  var input = readBookingInput_(d);
  var room = T('Rooms').find(input.room_id);
  checkBasics_(room, input);
  if (!validDate_(input.date)) throw apiError_('VALIDATION', 'Tarikh tidak sah.');
  var weeks = Math.max(1, Math.min(Number(setting_('max_recurring_weeks')), Number(d.repeat_weeks) || 1));
  var dates = [];
  for (var i = 0; i < weeks; i++) dates.push(addDays_(input.date, i * 7));
  var errors = [];
  dates.forEach(function (dd) {
    validateSlot_(room, dd, input.start_time, input.end_time, user, 0).forEach(function (e) {
      var msg = (weeks > 1 ? fmtDate_(dd, false, true) + ': ' : '') + e;
      if (errors.indexOf(msg) === -1) errors.push(msg);
    });
  });
  if (errors.length) throw apiError_('VALIDATION', 'Tempahan tidak dapat diproses.', { errors: errors });

  var needs = roomNeedsApproval_(room);
  var status = needs && user.role !== 'admin' ? 'pending' : 'approved';
  var series = weeks > 1 ? Utilities.getUuid().slice(0, 12) : '';
  var ids = [];
  dates.forEach(function (dd) {
    var rec = T('Bookings').insert({
      ref_no: genRef_(), user_id: user.id, room_id: room.id, date: dd, start_time: input.start_time, end_time: input.end_time,
      purpose: input.purpose, class_name: input.class_name, subject: input.subject, attendees: input.attendees, notes: input.notes,
      status: status, series_id: series, admin_remark: '',
      reviewed_by: status === 'approved' && needs ? user.id : '', reviewed_at: status === 'approved' && needs ? nowStamp_() : '',
      created_at: nowStamp_(), updated_at: nowStamp_(),
    });
    ids.push(rec.id);
  });
  var first = T('Bookings').find(ids[0]);
  audit_(ctx, 'booking.create', first.ref_no + ' – ' + room.name + ', ' + input.date + ' ' + input.start_time + '-' + input.end_time + (weeks > 1 ? ' (x' + weeks + ' minggu)' : ''));
  if (status === 'pending') {
    notifyAdmins_('Tempahan baharu menunggu kelulusan',
      user.name + ' menempah ' + room.name + ' pada ' + fmtDate_(input.date, false, true) + ' (' + input.start_time + ' – ' + input.end_time + ')' + (weeks > 1 ? ' untuk ' + weeks + ' minggu' : '') + '.',
      '#/booking?id=' + ids[0], user.id);
  }
  return { ids: ids, status: status };
});

action_('booking.update', { write: true }, function (d, ctx) {
  var user = ctx.user;
  var b = T('Bookings').find(d.id);
  if (!b || !canModify_(b, user)) throw apiError_('FORBIDDEN', 'Tempahan ini tidak boleh dipinda.');
  var input = readBookingInput_(d);
  var room = T('Rooms').find(input.room_id);
  checkBasics_(room, input);
  var errors = validateSlot_(room, input.date, input.start_time, input.end_time, user, b.id);
  if (errors.length) throw apiError_('VALIDATION', 'Tempahan tidak dapat diproses.', { errors: errors });
  var changed = room.id !== b.room_id || input.date !== b.date || input.start_time !== b.start_time || input.end_time !== b.end_time;
  var status = b.status;
  var needs = roomNeedsApproval_(room);
  if (user.role !== 'admin' && needs && changed) status = 'pending';
  else if (!needs) status = 'approved';
  var prev = b.status;
  input.status = status;
  input.updated_at = nowStamp_();
  T('Bookings').update(b, input);
  audit_(ctx, 'booking.update', b.ref_no + ' dikemas kini');
  if (status === 'pending' && prev !== 'pending') notifyAdmins_('Tempahan dipinda – perlu semakan', user.name + ' meminda tempahan ' + b.ref_no + '.', '#/booking?id=' + b.id);
  if (b.user_id !== user.id) notify_(b.user_id, 'Tempahan anda dipinda oleh pentadbir', 'Tempahan ' + b.ref_no + ' telah dikemas kini.', '#/booking?id=' + b.id);
  return { id: b.id, status: status };
});

action_('booking.get', {}, function (d, ctx) {
  var b = T('Bookings').find(d.id);
  if (!b) throw apiError_('NOT_FOUND', 'Tempahan tidak dijumpai.');
  var o = bookingOut_(b, ctx.user);
  var owner = T('Users').find(b.user_id) || {};
  o.user_email = owner.email || '';
  o.user_phone = owner.phone || '';
  o.user_department = owner.department || '';
  o.reviewer_name = b.reviewed_by ? userName_(b.reviewed_by) : '';
  o.series = b.series_id ? T('Bookings').rows().filter(function (x) { return x.series_id === b.series_id; })
    .sort(function (a, c) { return a.date < c.date ? -1 : 1; })
    .map(function (x) { return { id: x.id, date: x.date, status: x.status }; }) : [];
  o.active_series = o.series.filter(function (x) { return BLOCKING[x.status] && x.date >= today_(); }).length;
  return o;
});

action_('booking.setStatus', { write: true }, function (d, ctx) {
  var user = ctx.user;
  var status = String(d.status || '');
  var remark = String(d.remark || '').trim().slice(0, 300);
  var ids = d.ids ? d.ids.map(Number) : [Number(d.id)];
  if (d.scope === 'series' && ids.length === 1) {
    var b0 = T('Bookings').find(ids[0]);
    if (b0 && b0.series_id) {
      ids = T('Bookings').rows().filter(function (x) { return x.series_id === b0.series_id && x.date >= today_() && BLOCKING[x.status]; }).map(function (x) { return x.id; });
    }
  }
  var done = 0, errors = [];
  ids.forEach(function (id) {
    var b = T('Bookings').find(id);
    if (!b) return;
    if (status === 'approved' || status === 'rejected') {
      if (user.role !== 'admin') { errors.push('Hanya pentadbir boleh meluluskan atau menolak tempahan.'); return; }
    } else if (status === 'cancelled') {
      if (!canModify_(b, user)) { errors.push(b.ref_no + ': tidak boleh dibatalkan lagi.'); return; }
    } else {
      errors.push('Tindakan tidak sah.');
      return;
    }
    var err = changeStatus_(b, status, user, remark);
    if (err) errors.push(b.ref_no + ': ' + err); else done++;
  });
  return { done: done, errors: errors };
});

action_('myBookings', {}, function (d, ctx) {
  var user = ctx.user, today = today_(), now = nowTime_();
  var q = String(d.q || '').toLowerCase();
  var mine = T('Bookings').rows().filter(function (b) { return b.user_id === user.id; });
  var isUpcoming = function (b) { return BLOCKING[b.status] && (b.date > today || (b.date === today && b.end_time > now)); };
  var isPast = function (b) { return b.status === 'approved' && !isUpcoming(b); };
  var isClosed = function (b) { return b.status === 'cancelled' || b.status === 'rejected'; };
  var counts = { upcoming: mine.filter(isUpcoming).length, past: mine.filter(isPast).length, closed: mine.filter(isClosed).length, all: mine.length };
  var tab = d.tab || 'upcoming';
  var list = mine.filter(tab === 'past' ? isPast : tab === 'closed' ? isClosed : tab === 'all' ? function () { return true; } : isUpcoming);
  if (q) {
    list = list.filter(function (b) {
      var r = T('Rooms').find(b.room_id) || {};
      return [b.purpose, b.ref_no, r.name, b.class_name].join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }
  list.sort(function (a, b) {
    var x = a.date + a.start_time, y = b.date + b.start_time;
    return tab === 'upcoming' ? (x < y ? -1 : 1) : (x < y ? 1 : -1);
  });
  return { counts: counts, rows: list.slice(0, 200).map(function (b) { return bookingOut_(b, user); }) };
});

/* ---------- Notifications ---------- */
action_('notifications', {}, function (d, ctx) {
  return T('Notifications').rows().filter(function (n) { return n.user_id === ctx.user.id; })
    .sort(function (a, b) { return b.id - a.id; }).slice(0, Number(d.limit) || 50).map(clean_);
});

action_('notifications.read', { write: true }, function (d, ctx) {
  T('Notifications').rows().filter(function (n) { return n.user_id === ctx.user.id && !n.is_read && (!d.id || n.id === Number(d.id)); })
    .forEach(function (n) { T('Notifications').update(n, { is_read: 1 }); });
  return true;
});

action_('notifications.clear', { write: true }, function (d, ctx) {
  var ids = T('Notifications').rows().filter(function (n) { return n.user_id === ctx.user.id && n.is_read; })
    .sort(function (a, b) { return b._row - a._row; });
  ids.forEach(function (n) { T('Notifications').sheet.deleteRow(n._row); });
  T('Notifications')._rows = null;
  return ids.length;
});

/* =====================================================================
 * Admin actions
 * ===================================================================== */
action_('admin.bookings', { admin: true }, function (d) {
  var rows = T('Bookings').rows();
  var f = d || {};
  var q = String(f.q || '').toLowerCase();
  var counts = { all: rows.length, pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  rows.forEach(function (b) { counts[b.status] = (counts[b.status] || 0) + 1; });
  var list = rows.filter(function (b) {
    if (f.from && b.date < f.from) return false;
    if (f.to && b.date > f.to) return false;
    if (f.room_id && b.room_id !== Number(f.room_id)) return false;
    if (f.user_id && b.user_id !== Number(f.user_id)) return false;
    if (f.status && b.status !== f.status) return false;
    if (q) {
      var hay = [b.ref_no, b.purpose, userName_(b.user_id), b.class_name, b.subject].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  list.sort(function (a, b) {
    var x = a.date + a.start_time, y = b.date + b.start_time;
    return f.status === 'pending' ? (x < y ? -1 : 1) : (x < y ? 1 : -1);
  });
  var total = list.length;
  var per = f.all ? total : 25;
  var page = Math.max(1, Number(f.page) || 1);
  var slice = list.slice((page - 1) * per, page * per).map(function (b) {
    var o = bookingOut_(b);
    if (f.all) {
      var u = T('Users').find(b.user_id) || {};
      o.user_department = u.department || '';
    }
    return o;
  });
  return { rows: slice, total: total, page: page, pages: Math.max(1, Math.ceil(total / (per || 1))), counts: counts };
});

action_('admin.rooms.save', { admin: true, write: true }, function (d, ctx) {
  var id = Number(d.id) || 0;
  var rec = {
    code: String(d.code || '').trim().toUpperCase(), name: String(d.name || '').trim(), category: String(d.category || '').trim(),
    location: String(d.location || '').trim(), capacity: Math.max(0, parseInt(d.capacity, 10) || 0), facilities: String(d.facilities || '').trim(),
    description: String(d.description || '').trim(), pic_name: String(d.pic_name || '').trim(),
    color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : '#1d4ed8', requires_approval: d.requires_approval ? 1 : 0,
    status: ['active', 'maintenance', 'inactive'].indexOf(d.status) !== -1 ? d.status : 'active',
  };
  if (!/^[A-Z0-9-]{1,10}$/.test(rec.code)) throw apiError_('VALIDATION', 'Kod bilik diperlukan (huruf/nombor, maks. 10 aksara).');
  if (!rec.name) throw apiError_('VALIDATION', 'Nama bilik diperlukan.');
  var dup = T('Rooms').rows().filter(function (r) { return r.code.toUpperCase() === rec.code && r.id !== id; });
  if (dup.length) throw apiError_('VALIDATION', 'Kod bilik ' + rec.code + ' telah digunakan.');
  var out;
  if (id) {
    out = T('Rooms').update(id, rec);
    audit_(ctx, 'room.update', rec.name);
  } else {
    rec.created_at = nowStamp_();
    out = T('Rooms').insert(rec);
    audit_(ctx, 'room.create', rec.name);
  }
  return clean_(out);
});

action_('admin.rooms.delete', { admin: true, write: true }, function (d, ctx) {
  var r = T('Rooms').find(d.id);
  if (!r) throw apiError_('NOT_FOUND', 'Bilik tidak dijumpai.');
  if (T('Bookings').rows().some(function (b) { return b.room_id === r.id; })) {
    throw apiError_('VALIDATION', 'Bilik ' + r.name + ' mempunyai rekod tempahan. Tukar status kepada "Tidak Aktif" untuk menyembunyikannya.');
  }
  T('Rooms').remove(r);
  audit_(ctx, 'room.delete', r.name);
  return true;
});

action_('admin.users.list', { admin: true }, function () {
  var bookings = T('Bookings').rows();
  return T('Users').rows().map(function (u) {
    var o = userOut_(u);
    o.bookings = bookings.filter(function (b) { return b.user_id === u.id; }).length;
    return o;
  }).sort(function (a, b) {
    if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
});

action_('admin.users.save', { admin: true, write: true }, function (d, ctx) {
  var id = Number(d.id) || 0;
  var rec = { name: String(d.name || '').trim(), email: String(d.email || '').trim().toLowerCase(), phone: String(d.phone || '').trim(),
    department: String(d.department || '').trim(), role: d.role === 'admin' ? 'admin' : 'guru' };
  if (rec.name.length < 3) throw apiError_('VALIDATION', 'Nama diperlukan.');
  if (rec.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.email)) throw apiError_('VALIDATION', 'E-mel tidak sah.');
  var dup = findBy_('Users', 'name', rec.name);
  if (dup && dup.id !== id) throw apiError_('VALIDATION', 'Nama "' + rec.name + '" sudah wujud. Tambah maklumat pembeza, contohnya "(Sains)".');
  if (id === ctx.user.id && rec.role !== 'admin') throw apiError_('VALIDATION', 'Anda tidak boleh membuang peranan pentadbir anda sendiri.');
  if (id) {
    audit_(ctx, 'user.update', rec.name);
    return userOut_(T('Users').update(id, rec));
  }
  rec.status = 'active';
  rec.created_at = nowStamp_();
  audit_(ctx, 'user.create', rec.name);
  return userOut_(T('Users').insert(rec));
});

action_('admin.users.import', { admin: true, write: true }, function (d, ctx) {
  var created = 0, skipped = [];
  String(d.text || '').split(/\r?\n/).forEach(function (line) {
    var parts = line.split(/[,\t;]/).map(function (s) { return s.trim(); });
    if (!parts[0]) return;
    var name = parts[0];
    if (name.length < 3) { skipped.push(name + ' (nama terlalu pendek)'); return; }
    if (findBy_('Users', 'name', name)) { skipped.push(name + ' (sudah wujud)'); return; }
    T('Users').insert({ name: name, department: parts[1] || '', email: (parts[2] || '').toLowerCase(), role: 'guru', status: 'active', created_at: nowStamp_() });
    created++;
  });
  audit_(ctx, 'user.import', created + ' pengguna');
  return { created: created, skipped: skipped };
});

action_('admin.users.setStatus', { admin: true, write: true }, function (d, ctx) {
  var u = T('Users').find(d.id);
  if (!u) throw apiError_('NOT_FOUND', 'Pengguna tidak dijumpai.');
  if (u.id === ctx.user.id) throw apiError_('VALIDATION', 'Anda tidak boleh menukar status akaun anda sendiri.');
  var status = d.status === 'active' ? 'active' : 'inactive';
  var wasPending = u.status === 'pending';
  T('Users').update(u, { status: status });
  audit_(ctx, 'user.' + status, u.name);
  if (status === 'active' && wasPending) notify_(u.id, 'Akaun anda telah diaktifkan', 'Selamat datang! Anda kini boleh membuat tempahan bilik khas.', '#/book');
  return true;
});

action_('admin.users.resetPassword', { admin: true, write: true }, function (d, ctx) {
  var u = T('Users').find(d.id);
  if (!u) throw apiError_('NOT_FOUND', 'Pengguna tidak dijumpai.');
  T('Users').update(u, { password_hash: '' });
  T('Sessions').rows().filter(function (s) { return s.user_id === u.id; }).sort(function (a, b) { return b._row - a._row; })
    .forEach(function (s) { T('Sessions').sheet.deleteRow(s._row); });
  T('Sessions')._rows = null;
  CacheService.getScriptCache().remove('fail_' + u.id);
  audit_(ctx, 'user.reset_password', u.name);
  return true;
});

action_('admin.users.delete', { admin: true, write: true }, function (d, ctx) {
  var u = T('Users').find(d.id);
  if (!u) throw apiError_('NOT_FOUND', 'Pengguna tidak dijumpai.');
  if (u.id === ctx.user.id) throw apiError_('VALIDATION', 'Anda tidak boleh memadam akaun anda sendiri.');
  if (T('Bookings').rows().some(function (b) { return b.user_id === u.id; })) {
    throw apiError_('VALIDATION', u.name + ' mempunyai rekod tempahan. Nyahaktifkan akaun untuk mengekalkan rekod.');
  }
  T('Users').remove(u);
  audit_(ctx, 'user.delete', u.name);
  return true;
});

action_('admin.closures.list', { admin: true }, function (d) {
  var today = today_();
  var bookings = T('Bookings').rows();
  return T('Closures').rows().filter(function (c) { return d.past ? c.end_date < today : c.end_date >= today; }).map(function (c) {
    var o = clean_(c);
    var r = c.room_id ? T('Rooms').find(c.room_id) : null;
    o.room_name = r ? r.name : '';
    o.room_color = r ? r.color : '';
    o.creator = c.created_by ? userName_(c.created_by) : '-';
    o.affected = bookings.filter(function (b) { return BLOCKING[b.status] && b.date >= c.start_date && b.date <= c.end_date && (!c.room_id || b.room_id === c.room_id); }).length;
    return o;
  }).sort(function (a, b) { return (a.start_date < b.start_date ? -1 : 1) * (d.past ? -1 : 1); });
});

action_('admin.closures.save', { admin: true, write: true }, function (d, ctx) {
  var start = String(d.start_date || ''), end = String(d.end_date || '') || start, reason = String(d.reason || '').trim();
  if (!validDate_(start) || !validDate_(end) || end < start) throw apiError_('VALIDATION', 'Julat tarikh tidak sah.');
  if (!reason) throw apiError_('VALIDATION', 'Sila nyatakan sebab penutupan.');
  var roomId = Number(d.room_id) || '';
  T('Closures').insert({ room_id: roomId, start_date: start, end_date: end, reason: reason, created_by: ctx.user.id, created_at: nowStamp_() });
  var room = roomId ? T('Rooms').find(roomId) : null;
  audit_(ctx, 'closure.create', (room ? room.name : 'Semua bilik') + ' ' + start + ' – ' + end + ': ' + reason);
  var cancelled = 0;
  if (d.cancel_existing) {
    T('Bookings').rows().filter(function (b) { return BLOCKING[b.status] && b.date >= start && b.date <= end && (!roomId || b.room_id === roomId); })
      .forEach(function (b) { if (!changeStatus_(b, 'cancelled', ctx.user, 'Bilik ditutup: ' + reason)) cancelled++; });
  }
  return { cancelled: cancelled };
});

action_('admin.closures.delete', { admin: true, write: true }, function (d, ctx) {
  T('Closures').remove(Number(d.id));
  audit_(ctx, 'closure.delete', '#' + d.id);
  return true;
});

action_('admin.periods.save', { admin: true, write: true }, function (d, ctx) {
  var list = d.periods || [];
  var bad = 0;
  var keep = {};
  list.forEach(function (p) {
    var label = String(p.label || '').trim();
    if (!label && !p.start_time && !p.end_time) return;
    if (!label || !validTime_(p.start_time) || !validTime_(p.end_time) || p.end_time <= p.start_time) { bad++; return; }
    var rec = { label: label, start_time: p.start_time, end_time: p.end_time, is_break: p.is_break ? 1 : 0 };
    if (p.id) { T('Periods').update(Number(p.id), rec); keep[Number(p.id)] = 1; }
    else keep[T('Periods').insert(rec).id] = 1;
  });
  T('Periods').rows().filter(function (p) { return !keep[p.id]; }).sort(function (a, b) { return b._row - a._row; })
    .forEach(function (p) { T('Periods').sheet.deleteRow(p._row); });
  T('Periods')._rows = null;
  audit_(ctx, 'period.update', '');
  return { invalid: bad, periods: T('Periods').rows().map(clean_).sort(function (a, b) { return a.start_time < b.start_time ? -1 : 1; }) };
});

action_('admin.settings.save', { admin: true, write: true }, function (d, ctx) {
  var s = d.settings || {};
  ['system_name', 'school_name', 'school_code', 'school_address', 'app_url'].forEach(function (k) {
    if (s[k] !== undefined) setSetting_(k, String(s[k]).trim().slice(0, 200));
  });
  if (validTime_(s.open_time) && validTime_(s.close_time) && s.close_time > s.open_time) {
    setSetting_('open_time', s.open_time);
    setSetting_('close_time', s.close_time);
  }
  var ints = { max_advance_days: [0, 365], max_duration_hours: [0, 24], max_recurring_weeks: [1, 52], cancel_cutoff_hours: [0, 168] };
  Object.keys(ints).forEach(function (k) {
    if (s[k] !== undefined) setSetting_(k, String(Math.max(ints[k][0], Math.min(ints[k][1], parseInt(s[k], 10) || 0))));
  });
  ['allow_weekend', 'allow_registration', 'public_display', 'email_notifications'].forEach(function (k) {
    if (s[k] !== undefined) setSetting_(k, s[k] ? '1' : '0');
  });
  if (['auto', 'manual', 'room'].indexOf(s.approval_mode) !== -1) setSetting_('approval_mode', s.approval_mode);

  var approved = 0;
  if (d.approve_pending) {
    var today = today_();
    T('Bookings').rows().filter(function (b) { return b.status === 'pending' && b.date >= today; }).forEach(function (b) {
      var room = T('Rooms').find(b.room_id);
      if (room && !roomNeedsApproval_(room) && !changeStatus_(b, 'approved', ctx.user, 'Diluluskan automatik (mod kelulusan ditukar)')) approved++;
    });
  }
  audit_(ctx, 'settings.update', 'Mod kelulusan: ' + setting_('approval_mode'));
  return { settings: publicSettings_(), approved: approved };
});

action_('admin.logo.save', { admin: true, write: true }, function (d, ctx) {
  var logo = String(d.logo || '');
  if (logo) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(logo)) throw apiError_('VALIDATION', 'Format logo tidak sah. Gunakan fail PNG, JPG atau WebP.');
    if (logo.length > LOGO_MAX) throw apiError_('VALIDATION', 'Saiz logo terlalu besar. Sila guna imej yang lebih kecil.');
  }
  setLogo_(logo);
  audit_(ctx, 'settings.logo', logo ? 'Logo dikemas kini' : 'Logo dibuang');
  return { logo: logo };
});

action_('admin.reports', { admin: true }, function (d) {
  var from = validDate_(d.from) ? d.from : today_().slice(0, 8) + '01';
  var to = validDate_(d.to) ? d.to : addDays_(addDays_(from.slice(0, 8) + '28', 4).slice(0, 8) + '01', -1);
  if (to < from) { var t = from; from = to; to = t; }
  var allowWeekend = setting_('allow_weekend') === '1';
  var closedAll = T('Closures').rows().filter(function (c) { return !c.room_id; });
  var schoolDays = 0;
  for (var x = from; x <= to; x = addDays_(x, 1)) {
    var w = dow_(x);
    if (!allowWeekend && (w === 0 || w === 6)) continue;
    if (closedAll.some(function (c) { return c.start_date <= x && c.end_date >= x; })) continue;
    schoolDays++;
  }
  var openMin = toMin_(setting_('close_time')) - toMin_(setting_('open_time'));
  var inRange = T('Bookings').rows().filter(function (b) { return b.date >= from && b.date <= to; });
  var approved = inRange.filter(function (b) { return b.status === 'approved'; });
  var mins = function (b) { return toMin_(b.end_time) - toMin_(b.start_time); };
  var util = function (m) { return schoolDays && openMin > 0 ? Math.round(m / (schoolDays * openMin) * 1000) / 10 : 0; };
  var summary = { total: inRange.length, approved: approved.length, minutes: 0, teachers: 0, pending: 0, rejected: 0, cancelled: 0 };
  var teachers = {};
  inRange.forEach(function (b) { if (summary[b.status] !== undefined && b.status !== 'approved') summary[b.status]++; });
  approved.forEach(function (b) { summary.minutes += mins(b); teachers[b.user_id] = (teachers[b.user_id] || 0) + 1; });
  summary.teachers = Object.keys(teachers).length;
  var perRoom = T('Rooms').rows().filter(function (r) { return r.status !== 'inactive'; }).map(function (r) {
    var list = approved.filter(function (b) { return b.room_id === r.id; });
    var m = list.reduce(function (s, b) { return s + mins(b); }, 0);
    return { code: r.code, name: r.name, color: r.color, n: list.length, hours: Math.round(m / 6) / 10, util: util(m) };
  }).sort(function (a, b) { return b.hours - a.hours; });
  var byDow = [0, 0, 0, 0, 0, 0, 0];
  var byHour = {};
  approved.forEach(function (b) {
    byDow[dow_(b.date)]++;
    var h = b.start_time.slice(0, 2) + ':00';
    byHour[h] = (byHour[h] || 0) + 1;
  });
  var hours = Object.keys(byHour).sort();
  var top = Object.keys(teachers).map(function (id) {
    var u = T('Users').find(id) || {};
    return { name: u.name || '-', department: u.department || '', n: teachers[id] };
  }).sort(function (a, b) { return b.n - a.n; }).slice(0, 10);
  return { from: from, to: to, schoolDays: schoolDays, summary: summary, perRoom: perRoom, byDow: byDow,
    byHour: { labels: hours, data: hours.map(function (h) { return byHour[h]; }) }, top: top,
    avgUtil: perRoom.length ? Math.round(perRoom.reduce(function (s, r) { return s + r.util; }, 0) / perRoom.length * 10) / 10 : 0 };
});

action_('admin.audit', { admin: true }, function (d) {
  var q = String(d.q || '').toLowerCase();
  var rows = T('Audit').rows().filter(function (a) { return !q || [a.action, a.details, a.user_name].join(' ').toLowerCase().indexOf(q) !== -1; })
    .sort(function (a, b) { return b.id - a.id; });
  var page = Math.max(1, Number(d.page) || 1);
  return { rows: rows.slice((page - 1) * 50, page * 50).map(clean_), total: rows.length, page: page, pages: Math.max(1, Math.ceil(rows.length / 50)) };
});
