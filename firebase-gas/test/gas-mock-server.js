/*
 * Local test server: runs the real gas/Code.gs inside Node with in-memory mocks of
 * SpreadsheetApp, CacheService, LockService, UrlFetchApp (Firebase token lookup), etc.
 * It also serves public/ so the whole SPA can be exercised in a browser.
 *
 *   node test/gas-mock-server.js [port]
 *
 * Tokens are faked as "mock:<email>" (see test/mock-firebase.js).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PORT = +process.argv[2] || 8090;
const TZ = 'Asia/Kuala_Lumpur';

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
const sheets = {};
const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = new Sheet(n)),
    getSheets: () => Object.values(sheets),
    deleteSheet: (s) => { delete sheets[s.name]; },
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
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: () => ss },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, v) }) },
    Utilities: {
        formatDate,
        getUuid: () => crypto.randomUUID(),
        DigestAlgorithm: { SHA_256: 'sha256' },
        computeDigest: (alg, s) => Array.from(crypto.createHash(alg).update(String(s)).digest()),
        base64EncodeWebSafe: (bytes) => Buffer.from(bytes.map((b) => (b + 256) % 256)).toString('base64url'),
    },
    UrlFetchApp: {
        fetch(url, opts) {
            const token = JSON.parse(opts.payload).idToken;
            const m = /^mock:(.+@.+)$/.exec(token);
            if (!/accounts:lookup/.test(url) || !m) return { getResponseCode: () => 400, getContentText: () => '{}' };
            const email = m[1];
            return {
                getResponseCode: () => 200,
                getContentText: () => JSON.stringify({ users: [{ email, emailVerified: true, displayName: email.split('@')[0].replace(/[._]/g, ' '), providerUserInfo: [{ providerId: 'google.com' }] }] }),
            };
        },
    },
    MailApp: { sendEmail: (o) => mails.push(o) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ content: s, setMimeType() { return this; } }) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'gas/Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
vm.runInContext("CONFIG.FIREBASE_API_KEY = 'test'; CONFIG.INITIAL_ADMINS = ['admin@moe-dl.edu.my'];", context);
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
            vm.runInContext('_tables = {}; _ss = null;', context);
            const out = context.doPost({ postData: { contents: body } });
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            res.end(out.content);
        });
        return;
    }
    if (url.pathname === '/__mails') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mails));
        return;
    }
    const file = path.join(ROOT, 'public', url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(ROOT, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404); res.end('404'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Mock server on http://127.0.0.1:' + PORT));
