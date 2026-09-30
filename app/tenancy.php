<?php
declare(strict_types=1);

/**
 * Multi-school ("multi-tenant") support.
 *
 * - data/platform.sqlite holds the school registry and the platform's super admins.
 * - Every school has its own database: data/schools/<slug>.sqlite. A school can never
 *   read another school's rows because they live in a different file.
 * - The active school comes from ?s=<slug> (added to every URL by url()), falling back
 *   to the last school used in this session.
 */

const RESERVED_SLUGS = ['app', 'data', 'assets', 'api', 'index', 'platform', 'router', 'config', 'admin', 'www', 'login',
    'logout', 'register', 'display', 'logo', 'static', 'public', 'firebase-gas', 'mail', 'cpanel', 'webmail'];

function platform_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0775, true);
    }
    $pdo = new PDO('sqlite:' . DATA_DIR . '/platform.sqlite', null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    if ((int) $pdo->query('PRAGMA user_version')->fetchColumn() < 1) {
        $pdo->exec(<<<SQL
            CREATE TABLE IF NOT EXISTS schools (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name          TEXT NOT NULL,
                school_code   TEXT,
                status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
                contact_name  TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                notes         TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS super_admins (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                last_login_at TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE TABLE IF NOT EXISTS platform_audit (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id   INTEGER,
                action     TEXT NOT NULL,
                details    TEXT,
                ip         TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            PRAGMA user_version = 1;
        SQL);
    }
    return $pdo;
}

function valid_slug(string $slug): bool
{
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/', $slug) && !in_array($slug, RESERVED_SLUGS, true);
}

function school_db_path(string $slug): string
{
    return DATA_DIR . '/schools/' . $slug . '.sqlite';
}

function find_school(string $slug): ?array
{
    $slug = strtolower(trim($slug));
    if (!valid_slug($slug)) {
        return null;
    }
    $st = platform_db()->prepare('SELECT * FROM schools WHERE slug = ?');
    $st->execute([$slug]);
    $school = $st->fetch() ?: null;
    return $school && is_file(school_db_path($school['slug'])) ? $school : null;
}

/** The school this request is for, or null on platform-level pages. */
function current_school(): ?array
{
    static $school = false;
    if ($school !== false) {
        return $school;
    }
    $school = null;
    // ?s= (code just typed, or an old link) wins; otherwise the school remembered in the session or on this device.
    $requested = is_string($_GET['s'] ?? null) ? $_GET['s'] : ($_SESSION['school'] ?? ($_COOKIE['tb_school'] ?? ''));
    if ($requested !== '' && ($found = find_school(strtolower(trim((string) $requested))))) {
        $school = $found;
        $_SESSION['school'] = $found['slug'];
    }
    return $school;
}

function school_slug(): string
{
    return current_school()['slug'] ?? '';
}

/**
 * Create a new school database with default settings, rooms and periods, plus its first admin.
 * Returns the new school's registry row.
 */
function create_school(array $d): array
{
    $pdo = platform_db();
    if (!is_dir(DATA_DIR . '/schools')) {
        mkdir(DATA_DIR . '/schools', 0775, true);
    }
    $path = school_db_path($d['slug']);
    if (is_file($path)) {
        throw new RuntimeException('Pangkalan data untuk kod ini sudah wujud.');
    }
    $pdo->prepare('INSERT INTO schools(slug, name, school_code, contact_name, contact_email, contact_phone, notes) VALUES (?,?,?,?,?,?,?)')
        ->execute([$d['slug'], $d['name'], $d['school_code'] ?: null, $d['contact_name'] ?: null, $d['contact_email'] ?: null, $d['contact_phone'] ?: null, $d['notes'] ?: null]);
    $id = (int) $pdo->lastInsertId();

    try {
        if (!empty($d['adopt_legacy'])) {
            // Move the pre-multi-school database (data/tempahan.sqlite) in as this school's data.
            foreach (['', '-wal', '-shm'] as $suffix) {
                if (is_file(DATA_DIR . '/tempahan.sqlite' . $suffix)) {
                    rename(DATA_DIR . '/tempahan.sqlite' . $suffix, $path . $suffix);
                }
            }
            $school = open_school_db($path);
        } else {
            $school = open_school_db($path);
            $school->prepare('INSERT INTO users(name, email, department, password_hash, role, must_change_password) VALUES (?,?,?,?,?,1)')
                ->execute([$d['admin_name'], strtolower($d['admin_email']), 'Pentadbiran', password_hash($d['admin_password'], PASSWORD_DEFAULT), 'admin']);
        }
        $up = $school->prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        $up->execute(['school_name', $d['name']]);
        if (!empty($d['school_code'])) {
            $up->execute(['school_code', $d['school_code']]);
        }
    } catch (Throwable $e) {
        $pdo->prepare('DELETE FROM schools WHERE id = ?')->execute([$id]);
        if (empty($d['adopt_legacy']) && is_file($path)) {
            @unlink($path);
        }
        throw $e;
    }
    $st = $pdo->prepare('SELECT * FROM schools WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch();
}

function open_school_db(string $path): PDO
{
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    migrate($pdo);
    return $pdo;
}

/* ---------- Super admin (platform owner) ---------- */

function super_admin(): ?array
{
    static $admin = false;
    if ($admin !== false) {
        return $admin;
    }
    $admin = null;
    if (!empty($_SESSION['super_admin_id'])) {
        $st = platform_db()->prepare('SELECT * FROM super_admins WHERE id = ?');
        $st->execute([$_SESSION['super_admin_id']]);
        $admin = $st->fetch() ?: null;
    }
    return $admin;
}

function platform_audit(string $action, string $details = ''): void
{
    platform_db()->prepare('INSERT INTO platform_audit(admin_id, action, details, ip) VALUES (?,?,?,?)')
        ->execute([super_admin()['id'] ?? null, $action, $details, client_ip()]);
}

/** The one address every school uses; teachers type their KPM school code there. */
function school_url(string $slug = ''): string
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') ? 'https' : 'http';
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
    return $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $base . '/';
}
