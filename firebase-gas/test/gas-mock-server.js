/*
 * Local test server: runs the real gas/Code.gs inside Node with in-memory mocks of
 * SpreadsheetApp, CacheService, LockService, MailApp, etc.
 * It serves:
 *   /            public/ (the Firebase Hosting build, talking to POST /gas)
 *   /gas-app     gas/Index.html as Apps Script would serve it (google.script.run shim)
 *
 *   node test/gas-mock-server.js [port]
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = +process.argv[2] || 8090;
const TZ = 'Asia/Kuala_Lumpur';
const BASE = 'http://127.0.0.1:' + PORT;

/* ---------------- Google Sheets mock ---------------- */
function Sheet(name) { this.name = name; this.data = []; }
Sheet.prototype.getName = function () { return this.name; };
Sheet.prototype.getLastRow = function () { return this.data.length; };
Sheet.prototype.appendRow = function (row) { this.data.push(row.slice()); return this; };
Sheet.prototype.deleteRow = function (r) { this.data.splice(r - 1, 1); return this; };
Sheet.prototype.setFrozenRows = function () { return this; };
Sheet.prototype.getRange = function (r, c, nr, nc) {
    const sheet = this;
    if (typeof r === 'string') return chain({});
    nr = nr || 1; nc = nc || 1;
    return chain({
        getValues() {
            const out = [];
            for (let i = 0; i < nr; i++) {
                const row = sheet.data[r - 1 + i] || [];
                const o = [];
                for (let j = 0; j < nc; j++) o.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]);
                out.push(o);
            }
            return out;
        },
        setValues(vals) {
            for (let i = 0; i < nr; i++) {
                while (sheet.data.length < r + i) sheet.data.push([]);
                const row = sheet.data[r - 1 + i];
                for (let j = 0; j < nc; j++) row[c - 1 + j] = vals[i][j];
            }
            return this;
        },
    });
};
function chain(o) {
    ['setNumberFormat', 'setFontWeight', 'setBackground', 'setFontColor'].forEach(function (m) { o[m] = function () { return o; }; });
    return o;
}
// Every spreadsheet (platform registry + one per school) lives in memory.
const spreadsheets = {};
function Spreadsheet(name) {
    this.id = crypto.randomBytes(22).toString('base64url');
    this.name = name;
    this.sheets = { Sheet1: new Sheet('Sheet1') };
    spreadsheets[this.id] = this;
}
Spreadsheet.prototype.getId = function () { return this.id; };
Spreadsheet.prototype.getName = function () { return this.name; };
Spreadsheet.prototype.getUrl = function () { return 'https://docs.google.com/spreadsheets/d/' + this.id + '/edit'; };
Spreadsheet.prototype.rename = function (n) { this.name = n; return this; };
Spreadsheet.prototype.getSheetByName = function (n) { return this.sheets[n] || null; };
Spreadsheet.prototype.insertSheet = function (n) { return (this.sheets[n] = new Sheet(n)); };
Spreadsheet.prototype.getSheets = function () { return Object.values(this.sheets); };
Spreadsheet.prototype.deleteSheet = function (sh) { delete this.sheets[sh.name]; };
const platformSs = new Spreadsheet('Platform');
const SheetsApp = {
    getActiveSpreadsheet: () => platformSs,
    create: (name) => new Spreadsheet(name),
    openById: (id) => {
        if (!spreadsheets[id]) throw new Error('Spreadsheet not found: ' + id);
        return spreadsheets[id];
    },
};

/* ---------------- Other Apps Script services ---------------- */
const cache = new Map();
const mails = [];
function formatDate(d, tz, pattern) {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
        .formatToParts(d).forEach((p) => { parts[p.type] = p.value; });
    if (parts.hour === '24') parts.hour = '00';
    return pattern.replace('yyyy', parts.year).replace('yy', parts.year.slice(2)).replace('MM', parts.month).replace('dd', parts.day)
        .replace('HH', parts.hour).replace('mm', parts.minute).replace('ss', parts.second);
}
const context = {
    console,
    SpreadsheetApp: SheetsApp,
    ScriptApp: { getService: () => ({ getUrl: () => BASE + '/gas-app' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v), remove: (k) => cache.delete(k) }) },
    Utilities: {
        formatDate,
        getUuid: () => crypto.randomUUID(),
        DigestAlgorithm: { SHA_256: 'sha256' },
        computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(String(s)).digest()),
        base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('base64url'),
    },
    MailApp: { sendEmail: (o) => mails.push(o) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/Code.gs'), 'utf8'), context, { filename: 'Code.gs' });

// Links in e-mails and the Super Admin panel point at this server instead of booking.akmalsys.com.
vm.runInContext('CONFIG.WEB_URL = ' + JSON.stringify(process.env.WEB_URL === undefined ? BASE : process.env.WEB_URL) + ';', context);
console.log(vm.runInContext('setup()', context));

/* ---------------- HTTP ---------------- */
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/gas' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            // Fresh table cache per request, like a real Apps Script execution.
                        const out = context.doPost({ postData: { contents: body } });
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(out.content);
        });
        return;
    }
    if (url.pathname === '/gas-app') {
        // Render the Apps Script template the way HtmlService would, plus a google.script.run shim.
        const file = url.searchParams.get('page') === 'display' ? 'Display.html' : 'Index.html';
        const scriptUrl = 'http://' + req.headers.host + '/gas-app';
        const slug = String(url.searchParams.get('s') || '').toLowerCase();
        const vars = { scriptUrl: scriptUrl, school: /^[a-z0-9-]{3,30}$/.test(slug) ? slug : '', platform: url.searchParams.get('page') === 'platform' };
        let html = fs.readFileSync(path.join(ROOT, 'gas', file), 'utf8')
            .replace(/<\?!=\s*JSON\.stringify\((\w+)\)\s*\?>/g, (m, k) => JSON.stringify(vars[k]));
        const shim = '<script>window.google={script:{run:(function(){function R(s,f){this.s=s;this.f=f;}' +
            'R.prototype.withSuccessHandler=function(fn){return new R(fn,this.f);};R.prototype.withFailureHandler=function(fn){return new R(this.s,fn);};' +
            'R.prototype.api=function(p){var s=this.s,f=this.f;fetch("/gas",{method:"POST",body:p}).then(function(r){return r.text();}).then(function(t){s&&s(t);},function(e){f&&f(e);});};' +
            'return new R();})()}};</script>';
        html = html.replace('<head>', '<head>' + shim);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
        return;
    }
    if (url.pathname === '/__sheets') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(Object.values(spreadsheets).map((x) => ({ id: x.id, name: x.name, sheets: Object.keys(x.sheets) }))));
        return;
    }
    if (url.pathname === '/__mails') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mails));
        return;
    }
    let file = path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(ROOT, 'public'))) { res.writeHead(403); res.end('403'); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        // Same as the Firebase "rewrites ** -> /index.html" rule: /smkabc, /platform
        if (path.extname(url.pathname)) { res.writeHead(404); res.end('404'); return; }
        file = path.join(ROOT, 'public', 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Mock server on http://127.0.0.1:' + PORT));
