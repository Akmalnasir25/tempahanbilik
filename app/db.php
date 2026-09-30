<?php
declare(strict_types=1);

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    if (!is_dir(DATA_DIR)) {
        mkdir(DATA_DIR, 0775, true);
    }
    $pdo = new PDO('sqlite:' . DATA_DIR . '/tempahan.sqlite', null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $version = (int) $pdo->query('PRAGMA user_version')->fetchColumn();

    if ($version < 1) {
        $pdo->exec('BEGIN');
        $pdo->exec(<<<SQL
            CREATE TABLE settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
                phone         TEXT,
                department    TEXT,
                password_hash TEXT NOT NULL,
                role          TEXT NOT NULL DEFAULT 'guru' CHECK (role IN ('admin','guru')),
                status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','pending','inactive')),
                must_change_password INTEGER NOT NULL DEFAULT 0,
                last_login_at TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE rooms (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                code        TEXT NOT NULL UNIQUE COLLATE NOCASE,
                name        TEXT NOT NULL,
                category    TEXT,
                location    TEXT,
                capacity    INTEGER NOT NULL DEFAULT 0,
                facilities  TEXT,
                description TEXT,
                pic_name    TEXT,
                color       TEXT NOT NULL DEFAULT '#1d4ed8',
                requires_approval INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','maintenance','inactive')),
                created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE periods (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                label      TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time   TEXT NOT NULL,
                is_break   INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE closures (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                room_id    INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
                start_date TEXT NOT NULL,
                end_date   TEXT NOT NULL,
                reason     TEXT NOT NULL,
                created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE bookings (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                ref_no        TEXT NOT NULL UNIQUE,
                user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                room_id       INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                date          TEXT NOT NULL,
                start_time    TEXT NOT NULL,
                end_time      TEXT NOT NULL,
                purpose       TEXT NOT NULL,
                class_name    TEXT,
                subject       TEXT,
                attendees     INTEGER,
                notes         TEXT,
                status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
                series_id     TEXT,
                admin_remark  TEXT,
                reviewed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at   TEXT,
                created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX idx_bookings_room_date ON bookings(room_id, date);
            CREATE INDEX idx_bookings_user ON bookings(user_id, date);
            CREATE INDEX idx_bookings_status ON bookings(status);

            CREATE TABLE notifications (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title      TEXT NOT NULL,
                message    TEXT,
                link       TEXT,
                is_read    INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
            CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

            CREATE TABLE audit_logs (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
                action     TEXT NOT NULL,
                details    TEXT,
                ip         TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
            );
        SQL);
        seed($pdo);
        $pdo->exec('PRAGMA user_version = 1');
        $pdo->exec('COMMIT');
    }
}

function seed(PDO $pdo): void
{
    $settings = [
        'school_name'         => 'Sekolah Menengah Kebangsaan Contoh',
        'school_code'         => 'ABC1234',
        'system_name'         => 'Sistem Tempahan Bilik Khas',
        'school_address'      => 'Jalan Pendidikan, 50000 Kuala Lumpur',
        'open_time'           => '07:00',
        'close_time'          => '18:00',
        'max_advance_days'    => '60',
        'max_duration_hours'  => '6',
        'max_recurring_weeks' => '16',
        'allow_weekend'       => '0',
        'allow_registration'  => '1',
        'email_domain'        => '',
        'public_display'      => '1',
        'cancel_cutoff_hours' => '0',
    ];
    $st = $pdo->prepare('INSERT INTO settings(key, value) VALUES (?, ?)');
    foreach ($settings as $k => $v) {
        $st->execute([$k, $v]);
    }

    $st = $pdo->prepare('INSERT INTO users(name, email, department, password_hash, role, must_change_password) VALUES (?,?,?,?,?,?)');
    $st->execute(['Pentadbir Sistem', 'admin@sekolah.edu.my', 'Pentadbiran', password_hash('admin123', PASSWORD_DEFAULT), 'admin', 1]);
    $st->execute(['Cikgu Contoh', 'guru@sekolah.edu.my', 'Sains & Matematik', password_hash('guru123', PASSWORD_DEFAULT), 'guru', 1]);

    $rooms = [
        ['MK1', 'Makmal Komputer 1', 'Makmal', 'Blok A, Aras 2', 40, 'Komputer x40, Projektor, Pendingin hawa, Papan putih interaktif', 'En. Rahman', '#1d4ed8', 0],
        ['MK2', 'Makmal Komputer 2', 'Makmal', 'Blok A, Aras 3', 35, 'Komputer x35, Projektor, Pendingin hawa', 'En. Rahman', '#0891b2', 0],
        ['MS1', 'Makmal Sains 1', 'Makmal', 'Blok B, Aras 1', 40, 'Peralatan eksperimen, Kebuk wasap, Sinki', 'Pn. Aminah', '#059669', 0],
        ['MS2', 'Makmal Sains 2', 'Makmal', 'Blok B, Aras 1', 40, 'Peralatan eksperimen, Mikroskop x20', 'Pn. Aminah', '#16a34a', 0],
        ['BT',  'Bilik Tayang', 'Bilik Multimedia', 'Blok C, Aras 1', 80, 'Projektor HD, Sistem PA, Pendingin hawa, Kerusi auditorium', 'En. Lim', '#7c3aed', 0],
        ['PSS', 'Pusat Sumber Sekolah', 'Pusat Sumber', 'Blok D, Aras 1', 60, 'Koleksi buku, Sudut digital, Pendingin hawa', 'Pn. Siti', '#d97706', 0],
        ['BM',  'Bilik Mesyuarat Utama', 'Bilik Mesyuarat', 'Blok Pentadbiran', 25, 'Meja mesyuarat, Skrin TV 75", Sidang video', 'Pejabat', '#475569', 1],
        ['BKH', 'Bengkel Kemahiran Hidup', 'Bengkel', 'Blok E', 35, 'Mesin kerja kayu, Peralatan tangan', 'En. Kumar', '#b45309', 0],
        ['BSN', 'Bilik Seni Visual', 'Bilik Seni', 'Blok C, Aras 2', 35, 'Meja lukisan, Sinki, Rak pameran', 'Pn. Farah', '#db2777', 0],
        ['BMZ', 'Bilik Muzik', 'Bilik Seni', 'Blok C, Aras 2', 30, 'Piano, Set dram, Kalis bunyi', 'En. Daniel', '#e11d48', 0],
        ['DSK', 'Dewan Serbaguna', 'Dewan', 'Kompleks Sukan', 300, 'Pentas, Sistem PA, Kerusi 300', 'HEM', '#0f766e', 1],
    ];
    $st = $pdo->prepare('INSERT INTO rooms(code, name, category, location, capacity, facilities, pic_name, color, requires_approval) VALUES (?,?,?,?,?,?,?,?,?)');
    foreach ($rooms as $r) {
        $st->execute($r);
    }

    $periods = [
        ['Waktu 1', '07:30', '08:00', 0], ['Waktu 2', '08:00', '08:30', 0], ['Waktu 3', '08:30', '09:00', 0],
        ['Waktu 4', '09:00', '09:30', 0], ['Waktu 5', '09:30', '10:00', 0], ['Rehat', '10:00', '10:20', 1],
        ['Waktu 6', '10:20', '10:50', 0], ['Waktu 7', '10:50', '11:20', 0], ['Waktu 8', '11:20', '11:50', 0],
        ['Waktu 9', '11:50', '12:20', 0], ['Waktu 10', '12:20', '12:50', 0], ['Waktu 11', '12:50', '13:20', 0],
        ['Waktu 12', '13:20', '13:50', 0], ['Petang 1', '14:30', '15:30', 0], ['Petang 2', '15:30', '16:30', 0],
        ['Petang 3', '16:30', '17:30', 0],
    ];
    $st = $pdo->prepare('INSERT INTO periods(label, start_time, end_time, is_break) VALUES (?,?,?,?)');
    foreach ($periods as $p) {
        $st->execute($p);
    }
}
