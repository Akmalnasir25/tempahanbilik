# Sistem Tempahan Bilik Khas

> **Dua versi tersedia dalam repo ini:**
> - **Versi PHP** (folder root, dokumen ini) — untuk hosting cPanel / PC sekolah.
> - **Versi Firebase + Google Apps Script** ([`firebase-gas/`](firebase-gas/README.md)) — hos percuma di Firebase, data dalam Google Sheets, guru log masuk dengan akaun DELIMa.

Sistem web untuk guru menempah bilik khas sekolah (makmal, bilik tayang, pusat sumber, dewan dan lain-lain). Sistem ini menghalang tempahan bertindih secara automatik, dan pentadbir boleh mengurus semua rekod dari satu papan pemuka.

Dibina dengan **PHP 8 + SQLite**, jadi tiada pelayan pangkalan data berasingan diperlukan. Semua pustaka frontend (Bootstrap 5, FullCalendar, Chart.js, ikon dan fon) disimpan dalam `assets/vendor`, jadi sistem boleh berjalan di rangkaian dalaman sekolah tanpa akses Internet.

## Ciri-ciri

### Untuk guru
- **Tempah bilik** melalui borang 3 langkah. Pilih waktu persekolahan dengan klik (Waktu 1 → Waktu 3) atau masukkan masa sendiri.
- **Semakan pertembungan masa nyata**: sistem memberitahu serta-merta sama ada slot kosong atau bertembung, dan dengan tempahan siapa.
- **Jadual harian bilik** dipaparkan di sisi borang, bersama slot pilihan anda.
- **Tempahan berulang mingguan**, contohnya setiap Isnin selama 10 minggu. Semua minggu disemak sebelum disimpan.
- **Semak kekosongan**: grid semua bilik × waktu. Klik petak hijau untuk terus menempah. Ada juga carian "bilik kosong pada masa X" dengan tapisan kapasiti dan kategori.
- **Jadual tempahan**: paparan bulan, minggu, hari dan senarai. Anda boleh tapis mengikut bilik atau "tempahan saya", dan seret pada kalendar untuk menempah.
- **Tempahan saya**: pinda, batal (termasuk membatalkan satu siri berulang), cetak slip dan muat turun ke kalendar telefon (.ics).
- **Notifikasi** apabila tempahan diluluskan, ditolak atau dipinda.
- Senarai bilik dengan kemudahan, kapasiti dan status semasa ("Kosong sekarang" / "Sedang digunakan").

### Untuk pentadbir
- **Papan pemuka** dengan statistik, tempahan menunggu kelulusan (lulus dengan satu klik) dan carta trend.
- **Rekod tempahan**: tapisan tarikh, bilik, guru dan status; lulus/tolak/batal secara pukal; **eksport CSV** (boleh dibuka dalam Excel); cetak.
- **Mod kelulusan** (di Tetapan Sistem): **Lulus automatik** (lalai: tempahan terus diluluskan jika tiada pertindihan), **Semua perlu kelulusan**, atau **Ikut tetapan bilik**. Tempahan bertindih sentiasa disekat dalam semua mod.
- **Urus bilik khas**: kod, kategori, lokasi, kapasiti, kemudahan, warna, PIC dan status (Aktif / Penyelenggaraan / Tidak Aktif). Setiap bilik boleh ditanda **perlu kelulusan**, yang berkuat kuasa dalam mod "Ikut tetapan bilik".
- **Urus pengguna**: tambah, import pukal (tampal senarai), sahkan pendaftaran, set semula kata laluan, nyahaktif.
- **Penutupan & cuti**: tutup satu bilik atau semua bilik untuk tempoh tertentu. Ada pilihan untuk membatalkan tempahan terjejas dan memaklumkan guru.
- **Waktu persekolahan**: ubah suai senarai waktu (Waktu 1, Rehat, dan seterusnya).
- **Laporan & analitik**: kadar penggunaan setiap bilik, jumlah jam, hari dan waktu paling popular, dan pengguna paling aktif.
- **Tetapan**: nama sekolah, waktu operasi, had tempah awal, tempoh maksimum, hujung minggu, pendaftaran sendiri (dengan had domain e-mel) dan had masa pembatalan.
- **Log audit** untuk semua aktiviti penting.
- **Paparan skrin TV** (`index.php?p=display`): jadual hari ini untuk bilik guru atau lobi, dengan kemas kini automatik.

### Umum
- Reka bentuk korporat dengan **mod gelap**, responsif untuk telefon, dan sedia untuk dicetak.
- Keselamatan: kata laluan dicincang (bcrypt), perlindungan CSRF, pertanyaan SQL berparameter, had cubaan log masuk dan sekatan akses ke folder `app/` dan `data/`.
- Tempahan disimpan dalam transaksi `BEGIN IMMEDIATE`, jadi dua guru yang menekan "Hantar" serentak tidak akan mendapat slot yang sama.

## Pemasangan

**Keperluan:** PHP 8.1 atau lebih baharu dengan sambungan `pdo_sqlite` (tersedia secara lalai di kebanyakan hosting cPanel).

### Cuba di komputer sendiri
```bash
php -S localhost:8000 router.php
```
Buka http://localhost:8000. Pangkalan data (`data/tempahan.sqlite`) dicipta secara automatik pada kali pertama sistem dibuka.

### Hosting (cPanel / Apache)
1. Muat naik semua fail ke `public_html` (atau subfolder seperti `public_html/tempahan`).
2. Pastikan folder `data/` boleh ditulis oleh PHP (chmod 775).
3. Fail `.htaccess` yang disertakan menyekat akses terus ke `app/`, `data/` dan fail pangkalan data.
4. (Pilihan) Salin `config.example.php` kepada `config.php` untuk memindahkan folder data ke luar `public_html`.

> **Nginx:** tambah `location ~ ^/(app|data)/ { deny all; }` pada konfigurasi pelayan.

### Akaun lalai
| Peranan | E-mel | Kata laluan |
|---|---|---|
| Pentadbir | admin@sekolah.edu.my | admin123 |
| Guru (contoh) | guru@sekolah.edu.my | guru123 |

⚠️ **Tukar kata laluan pentadbir sebaik sahaja log masuk**, dan padam atau nyahaktifkan akaun guru contoh. Kemudian kemas kini nama sekolah di **Tetapan Sistem**, dan senarai bilik di **Urus Bilik Khas**.

## Sandaran
Semua data berada dalam satu fail: `data/tempahan.sqlite`. Salin fail ini secara berkala untuk membuat sandaran.

## Struktur
```
index.php          Penghala halaman
api.php            Titik akhir JSON (kalendar, semakan kekosongan)
router.php         Penghala untuk pelayan PHP terbina dalam
app/
  bootstrap.php    Konfigurasi & sesi
  db.php           Skema, migrasi & data awal
  helpers.php      Fungsi umum (auth, CSRF, format tarikh Bahasa Melayu)
  booking.php      Logik tempahan & pengesanan pertembungan
  views/layout.php Susun atur (sidebar, topbar)
  pages/           Halaman guru & pentadbir
assets/            CSS, JS & pustaka vendor
data/              Pangkalan data SQLite (tidak dimasukkan ke git)
```
