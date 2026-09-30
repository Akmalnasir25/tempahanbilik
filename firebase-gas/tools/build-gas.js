/*
 * Builds the Apps Script HTML files from public/:
 *   gas/Index.html   — the full app (CSS + JS inlined, libraries from jsDelivr CDN)
 *   gas/Display.html — the TV board
 * Run after changing anything in public/:   node tools/build-gas.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CDN = {
    'assets/vendor/bootstrap/bootstrap.min.css': 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'assets/vendor/bootstrap-icons/bootstrap-icons.min.css': 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'assets/vendor/bootstrap/bootstrap.bundle.min.js': 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
};
const FONT = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">';
const CONFIG = '<script>window.APP_CONFIG = { gasUrl: <?!= JSON.stringify(scriptUrl) ?>, cdn: true };</script>';

function css() {
    // Fonts come from Google Fonts in the GAS build.
    return read('public/assets/css/app.css').replace(/@font-face\s*{[^}]*}\s*/g, '');
}

function build(src) {
    let html = read('public/' + src);
    html = html.replace(/<link href="(assets\/vendor\/[^"?]+)"[^>]*>/g, (m, p) => {
        if (!CDN[p]) throw new Error('No CDN mapping for ' + p);
        return '<link href="' + CDN[p] + '" rel="stylesheet">';
    });
    html = html.replace(/<link href="assets\/css\/app\.css[^"]*"[^>]*>/, () => FONT + '\n<style>\n' + css() + '\n</style>');
    html = html.replace(/<script src="(assets\/vendor\/[^"?]+)"><\/script>/g, (m, p) => {
        if (!CDN[p]) throw new Error('No CDN mapping for ' + p);
        return '<script src="' + CDN[p] + '"></script>';
    });
    html = html.replace(/<script src="config\.js[^"]*"><\/script>/, () => CONFIG);
    html = html.replace(/<script src="(assets\/js\/[^"?]+)[^"]*"><\/script>/g, (m, p) => {
        const js = read('public/' + p);
        if (js.indexOf('<?') !== -1 || /<\/script/i.test(js)) throw new Error(p + ' contains a sequence that breaks Apps Script templates');
        return '<script>\n' + js + '\n</script>';
    });
    html = html.replace(/<link rel="icon"[^>]*>\n?/, '');
    if (/(src|href)="assets\//.test(html)) throw new Error(src + ': unresolved local asset reference');
    return html;
}

const out = [['index.html', 'gas/Index.html'], ['display.html', 'gas/Display.html']];
out.forEach(([src, dest]) => {
    const html = build(src);
    fs.writeFileSync(path.join(ROOT, dest), html);
    console.log(dest, (html.length / 1024).toFixed(0) + ' KB');
});
