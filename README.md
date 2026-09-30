# Sistem Tempahan Bilik Khas

> **Dua versi tersedia dalam repo ini:**
> - **Versi PHP** (folder root, dokumen ini) — untuk hosting cPanel / PC sekolah.
> - **Versi Google Apps Script** ([`firebase-gas/`](firebase-gas/README.md)) — percuma, deploy terus dalam GAS (atau Firebase Hosting), data dalam Google Sheets, guru log masuk dengan memilih nama + No. KP.

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
- **Logo sekolah**: muat naik di Tetapan Sistem. Logo dikecilkan secara automatik, dan dipaparkan di sidebar, halaman log masuk, slip tempahan, paparan TV dan favicon.
- **Tetapan**: nama sekolah, waktu operasi, had tempah awal, tempoh maksimum, hujung minggu, pendaftaran sendiri (dengan had domain e-mel) dan had masa pembatalan.
- **Log audit** untuk semua aktiviti penting.
- **Paparan skrin TV** (`index.php?p=display`): jadual hari ini untuk bilik guru atau lobi, dengan kemas kini automatik.

### Umum
- Reka bentuk korporat dengan **mod gelap**, responsif untuk telefon, dan sedia untuk dicetak.
- Keselamatan: kata laluan dicincang (bcrypt), perlindungan CSRF, pertanyaan SQL berparameter, had cubaan log masuk dan sekatan akses ke folder `app/` dan `data/`.
- Tempahan disimpan dalam transaksi `BEGIN IMMEDIATE`, jadi dua guru yang menekan "Hantar" serentak tidak akan mendapat slot yang sama.

## Banyak sekolah (multi-sekolah)

Satu pemasangan boleh digunakan oleh banyak sekolah. Setiap sekolah mempunyai **fail pangkalan data sendiri** (`data/schools/<kod>.sqlite`), iaitu admin, guru, bilik, tempahan, tetapan dan logo sendiri. Data sekolah lain langsung tidak boleh dicapai.

- **Pautan sekolah:** `https://booking.akmalsys.com/<kod-sekolah>`, contohnya `/smkabc`. Admin sekolah kongsikan pautan ini kepada guru.
- **Laman utama** meminta kod sekolah (senarai sekolah tidak didedahkan), dan mengingati sekolah terakhir pada peranti.
- **Panel Super Admin** (pemilik platform): `index.php?p=platform`
  - Kali pertama dibuka, anda diminta mencipta akaun Super Admin. **Buat ini segera selepas pemasangan.**
  - Tambah sekolah (nama, kod pautan, admin pertama), gantung atau aktifkan, set semula kata laluan admin sekolah, tambah admin, muat turun sandaran, dan padam sekolah. Data sekolah yang dipadam disimpan dalam `data/deleted/`.
  - Jika fail `data/tempahan.sqlite` daripada versi satu-sekolah wujud, ia boleh diimport sebagai sekolah pertama.
- Log masuk disimpan berasingan bagi setiap sekolah, jadi akaun di satu sekolah tidak sah di sekolah lain.

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

### Selepas pemasangan
1. Buka `index.php?p=platform` dan cipta akaun **Super Admin** anda.
2. Klik **Tambah Sekolah** dan isi nama sekolah, kod pautan serta admin pertama.
3. Hantar pautan dan kata laluan sementara kepada admin sekolah. Admin akan diminta menukar kata laluan semasa log masuk pertama, kemudian mendaftar guru dan mengemas kini bilik di sekolah mereka.

## Sandaran
Sandarkan keseluruhan folder `data/` secara berkala: `platform.sqlite` ialah senarai sekolah, dan `schools/*.sqlite` ialah data setiap sekolah. Sandaran satu sekolah juga boleh dimuat turun dari panel Super Admin.

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
