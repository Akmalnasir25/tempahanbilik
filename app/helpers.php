<?php
declare(strict_types=1);

/* ---------- Output & routing ---------- */

function e(mixed $v): string
{
    return htmlspecialchars((string) ($v ?? ''), ENT_QUOTES, 'UTF-8');
}

function url(string $page, array $params = []): string
{
    return 'index.php?' . http_build_query(array_merge(['p' => $page], $params));
}

function redirect(string $page, array $params = []): never
{
    header('Location: ' . url($page, $params));
    exit;
}

function redirect_back(string $fallback = 'dashboard'): never
{
    $ref = $_SERVER['HTTP_REFERER'] ?? '';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if ($ref !== '' && parse_url($ref, PHP_URL_HOST) === parse_url('//' . $host, PHP_URL_HOST)) {
        header('Location: ' . $ref);
        exit;
    }
    redirect($fallback);
}

function json_response(mixed $data, int $code = 200): never
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function flash(string $type, string $message): void
{
    $_SESSION['flash'][] = [$type, $message];
}

function take_flashes(): array
{
    $f = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return $f;
}

/* ---------- Request ---------- */

function is_post(): bool
{
    return ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
}

function input(string $key, string $default = ''): string
{
    $v = $_POST[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function query(string $key, string $default = ''): string
{
    $v = $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $default;
}

function client_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? 'cli');
}

/* ---------- CSRF ---------- */

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function verify_csrf(): void
{
    $token = $_POST['_csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($token) || !hash_equals(csrf_token(), $token)) {
        http_response_code(419);
        if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')) {
            json_response(['error' => 'Sesi tamat. Sila muat semula halaman.'], 419);
        }
        flash('danger', 'Sesi anda telah tamat. Sila cuba lagi.');
        redirect_back();
    }
}

/* ---------- Settings ---------- */

function settings(bool $refresh = false): array
{
    static $cache = null;
    if ($cache === null || $refresh) {
        $cache = db()->query('SELECT key, value FROM settings')->fetchAll(PDO::FETCH_KEY_PAIR);
    }
    return $cache;
}

function setting(string $key, ?string $default = null): ?string
{
    return settings()[$key] ?? $default;
}

function save_setting(string $key, string $value): void
{
    db()->prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
        ->execute([$key, $value]);
}

/* ---------- Auth ---------- */

function current_user(): ?array
{
    static $user = false;
    if ($user !== false) {
        return $user;
    }
    $user = null;
    if (!empty($_SESSION['uid'])) {
        $st = db()->prepare("SELECT * FROM users WHERE id = ? AND status = 'active'");
        $st->execute([$_SESSION['uid']]);
        $user = $st->fetch() ?: null;
        if (!$user) {
            unset($_SESSION['uid']);
        }
    }
    return $user;
}

function is_admin(): bool
{
    return (current_user()['role'] ?? '') === 'admin';
}

function login_user(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $user['id'];
    db()->prepare("UPDATE users SET last_login_at = datetime('now','localtime') WHERE id = ?")->execute([$user['id']]);
}

function require_login(): array
{
    $u = current_user();
    if (!$u) {
        if (!empty($_GET['p']) && $_GET['p'] !== 'dashboard') {
            $_SESSION['intended'] = $_SERVER['REQUEST_URI'] ?? '';
        }
        redirect('login');
    }
    return $u;
}

function require_admin(): array
{
    $u = require_login();
    if ($u['role'] !== 'admin') {
        http_response_code(403);
        flash('danger', 'Anda tidak mempunyai kebenaran untuk mengakses halaman tersebut.');
        redirect('dashboard');
    }
    return $u;
}

/* ---------- Audit & notifications ---------- */

function audit(string $action, string $details = ''): void
{
    db()->prepare('INSERT INTO audit_logs(user_id, action, details, ip) VALUES (?,?,?,?)')
        ->execute([current_user()['id'] ?? null, $action, $details, client_ip()]);
}

function notify(int $userId, string $title, string $message = '', string $link = ''): void
{
    db()->prepare('INSERT INTO notifications(user_id, title, message, link) VALUES (?,?,?,?)')
        ->execute([$userId, $title, $message, $link]);
}

function notify_admins(string $title, string $message = '', string $link = '', ?int $exceptId = null): void
{
    $ids = db()->query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $id) {
        if ((int) $id !== $exceptId) {
            notify((int) $id, $title, $message, $link);
        }
    }
}

function unread_notifications(int $userId): int
{
    $st = db()->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0');
    $st->execute([$userId]);
    return (int) $st->fetchColumn();
}

/* ---------- Dates & formatting ---------- */

const MALAY_DAYS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MALAY_MONTHS = [1 => 'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const MALAY_MONTHS_SHORT = [1 => 'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];

function valid_date(string $d): bool
{
    $dt = DateTime::createFromFormat('!Y-m-d', $d);
    return $dt !== false && $dt->format('Y-m-d') === $d;
}

function valid_time(string $t): bool
{
    return (bool) preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t);
}

function fmt_date(?string $date, bool $withDay = false, bool $short = false): string
{
    if (!$date) {
        return '-';
    }
    $ts = strtotime($date);
    if ($ts === false) {
        return e($date);
    }
    $m = (int) date('n', $ts);
    $s = date('j', $ts) . ' ' . ($short ? MALAY_MONTHS_SHORT[$m] : MALAY_MONTHS[$m]) . ' ' . date('Y', $ts);
    return $withDay ? MALAY_DAYS[(int) date('w', $ts)] . ', ' . $s : $s;
}

function fmt_datetime(?string $dt): string
{
    if (!$dt) {
        return '-';
    }
    return fmt_date($dt, false, true) . ', ' . date('H:i', strtotime($dt));
}

function day_name(string $date): string
{
    return MALAY_DAYS[(int) date('w', strtotime($date))];
}

function time_to_min(string $t): int
{
    [$h, $m] = array_map('intval', explode(':', $t));
    return $h * 60 + $m;
}

function min_to_time(int $m): string
{
    return sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
}

function duration_label(string $start, string $end): string
{
    $mins = time_to_min($end) - time_to_min($start);
    $h = intdiv($mins, 60);
    $m = $mins % 60;
    return trim(($h ? $h . ' jam ' : '') . ($m ? $m . ' minit' : ''));
}

function time_ago(string $dt): string
{
    $diff = time() - strtotime($dt);
    if ($diff < 60) return 'baru sahaja';
    if ($diff < 3600) return intdiv($diff, 60) . ' minit lalu';
    if ($diff < 86400) return intdiv($diff, 3600) . ' jam lalu';
    if ($diff < 604800) return intdiv($diff, 86400) . ' hari lalu';
    return fmt_date($dt, false, true);
}

function greeting(): string
{
    $h = (int) date('G');
    return match (true) {
        $h < 12 => 'Selamat pagi',
        $h < 15 => 'Selamat tengah hari',
        $h < 19 => 'Selamat petang',
        default => 'Selamat malam',
    };
}

const STATUS_LABELS = [
    'pending'   => ['Menunggu', 'warning', 'hourglass-split'],
    'approved'  => ['Diluluskan', 'success', 'check-circle-fill'],
    'rejected'  => ['Ditolak', 'danger', 'x-circle-fill'],
    'cancelled' => ['Dibatalkan', 'secondary', 'slash-circle'],
];

function status_badge(string $status): string
{
    [$label, $color, $icon] = STATUS_LABELS[$status] ?? [$status, 'secondary', 'circle'];
    return '<span class="badge badge-soft-' . $color . '"><i class="bi bi-' . $icon . ' me-1"></i>' . e($label) . '</span>';
}

const ROOM_STATUS_LABELS = [
    'active'      => ['Aktif', 'success'],
    'maintenance' => ['Penyelenggaraan', 'warning'],
    'inactive'    => ['Tidak Aktif', 'secondary'],
];

function room_status_badge(string $status): string
{
    [$label, $color] = ROOM_STATUS_LABELS[$status] ?? [$status, 'secondary'];
    return '<span class="badge badge-soft-' . $color . '">' . e($label) . '</span>';
}

function initials(string $name): string
{
    $name = preg_replace('/^(cikgu|puan|pn\.?|en\.?|encik|tuan|dr\.?|hj\.?|hjh\.?)\s+/i', '', trim($name));
    $parts = preg_split('/\s+/', (string) $name) ?: [];
    $s = '';
    foreach (array_slice($parts, 0, 2) as $p) {
        $s .= mb_strtoupper(mb_substr($p, 0, 1));
    }
    return $s ?: '?';
}

function all_rooms(bool $activeOnly = false): array
{
    $sql = 'SELECT * FROM rooms' . ($activeOnly ? " WHERE status = 'active'" : '') . ' ORDER BY category, name';
    return db()->query($sql)->fetchAll();
}

function find_room(int $id): ?array
{
    $st = db()->prepare('SELECT * FROM rooms WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function all_periods(): array
{
    return db()->query('SELECT * FROM periods ORDER BY start_time')->fetchAll();
}

function paginate(int $total, int $perPage = 20): array
{
    $pages = max(1, (int) ceil($total / $perPage));
    $page = min($pages, max(1, (int) ($_GET['page'] ?? 1)));
    return ['page' => $page, 'pages' => $pages, 'offset' => ($page - 1) * $perPage, 'limit' => $perPage, 'total' => $total];
}

function pagination_links(array $pg): string
{
    if ($pg['pages'] <= 1) {
        return '';
    }
    $params = $_GET;
    $html = '<nav><ul class="pagination pagination-sm mb-0">';
    $range = array_unique(array_filter([1, $pg['page'] - 2, $pg['page'] - 1, $pg['page'], $pg['page'] + 1, $pg['page'] + 2, $pg['pages']],
        fn($n) => $n >= 1 && $n <= $pg['pages']));
    sort($range);
    $prev = 0;
    foreach ($range as $n) {
        if ($prev && $n > $prev + 1) {
            $html .= '<li class="page-item disabled"><span class="page-link">…</span></li>';
        }
        $params['page'] = $n;
        $html .= '<li class="page-item' . ($n === $pg['page'] ? ' active' : '') . '"><a class="page-link" href="index.php?' . e(http_build_query($params)) . '">' . $n . '</a></li>';
        $prev = $n;
    }
    return $html . '</ul></nav>';
}

function csv_download(string $filename, array $header, iterable $rows): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, $header, ',', '"', '\\');
    foreach ($rows as $r) {
        // Neutralise spreadsheet formula injection
        $r = array_map(fn($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v, $r);
        fputcsv($out, $r, ',', '"', '\\');
    }
    fclose($out);
    exit;
}

/** JSON safe for embedding inside <script> or HTML attributes. */
function js(mixed $v): string
{
    return (string) json_encode($v, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE);
}
