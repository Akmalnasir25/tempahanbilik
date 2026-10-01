# Sistem Tempahan Bilik Khas — Versi Google Apps Script (+ Firebase pilihan)

Versi ini tidak memerlukan pelayan atau hosting berbayar. Data disimpan dalam **Google Sheets**, dan logik sistem berjalan dalam **Google Apps Script (GAS)**.

> Versi PHP asal masih ada di root repo dan tidak diubah.

## Cara log masuk

1. **Pentadbir mendaftarkan nama guru sahaja**, sama ada satu per satu atau diimport secara pukal.
2. Guru buka sistem, **pilih nama mereka dari dropdown** (boleh taip untuk cari).
3. **Kali pertama:** guru **mendaftarkan No. Kad Pengenalan sendiri** (12 digit, ditaip dua kali). No. KP ini menjadi kata laluan mereka.
4. **Seterusnya:** pilih nama dan masukkan No. KP. Sengkang dibenarkan, contohnya `900101-10-1234`.
5. Guru boleh menukar kata laluan kepada yang lain di **Profil Saya**.
6. Jika guru lupa kata laluan, pentadbir klik **Set semula kata laluan**. Guru kemudian mendaftarkan No. KP semula pada log masuk seterusnya.

Keselamatan: No. KP / kata laluan **tidak disimpan sebagai teks biasa**. Ia disimpan dalam bentuk cincang (*salted hash*) dalam Google Sheet. Akaun juga dikunci selama 15 minit selepas 5 cubaan yang salah.

---

## Pilihan A (paling mudah) — Deploy terus dalam Google Apps Script

Hanya 4 fail perlu ditampal. Tiada Firebase dan tiada pemasangan apa-apa di komputer.

1. Log masuk ke Google dan cipta **Google Sheet baharu**, contohnya "Data Tempahan Bilik Khas".
2. Klik **Extensions → Apps Script**.
3. **`Code.gs`**: padam kandungan asal, kemudian tampal seluruh kandungan [`gas/Code.gs`](gas/Code.gs).
4. **`Index.html`**: klik **＋ → HTML**, namakan fail **`Index`**, kemudian tampal kandungan [`gas/Index.html`](gas/Index.html).
5. **`Display.html`**: ulang langkah yang sama dengan nama **`Display`** dan kandungan [`gas/Display.html`](gas/Display.html). Fail ini untuk paparan TV.
6. **`Logo.html`**: ulang sekali lagi dengan nama **`Logo`** dan kandungan [`gas/Logo.html`](gas/Logo.html). Fail ini ialah logo lalai sistem. Jika dilangkau, sistem masih berfungsi tetapi memaparkan ikon bangunan sehingga logo sekolah dimuat naik.
7. (Disyorkan) Klik ⚙️ **Project Settings**, tandakan **"Show appsscript.json"**, kemudian tampal kandungan [`gas/appsscript.json`](gas/appsscript.json). Ini menetapkan zon waktu Malaysia.
8. Di bahagian atas `Code.gs`, tukar **`ADMIN_IC`** kepada No. KP pentadbir:
   ```js
   var CONFIG = {
     ADMIN_IC: '800101015555',      // No. KP pentadbir = kata laluan pentadbir
     ADMIN_NAME: 'Pentadbir Sistem',
   };
   ```
9. Pilih fungsi **`setup`** dalam menu atas dan klik **▶ Run**. Benarkan akses apabila diminta.
10. Klik **Deploy → New deployment → ⚙️ Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
11. Klik **Deploy** dan salin **URL Web App** (berakhir dengan `/exec`). **Inilah alamat sistem anda**; kongsikan kepada guru.
12. Buka URL tersebut, pilih **Pentadbir Sistem**, dan masukkan `ADMIN_IC`. Kemudian:
    - **Tetapan Sistem:** tukar nama sekolah dan **muat naik logo sekolah**. Sistem sudah disertakan dengan logo
      lalai, jadi langkah ini pilihan sahaja; tekan **Buang** untuk kembali ke logo lalai. Logo dikecilkan secara
      automatik, dan dipaparkan di sidebar, halaman log masuk, slip tempahan dan paparan TV.
    - **Daftar & Urus Guru:** masukkan nama guru.
    - **Urus Bilik Khas:** kemas kini senarai bilik.

> 💡 Paparan TV untuk bilik guru: `URL-web-app?page=display`
>
> 💡 Jika pilihan "Anyone" tiada (sesetengah akaun DELIMa menyekatnya), gunakan **akaun Gmail biasa** untuk memiliki Sheet dan skrip ini.

## Pilihan B — Firebase Hosting (untuk URL `nama.web.app`)

Frontend yang sama di-hos di Firebase, dan ia memanggil URL Web App GAS dari Pilihan A.

1. Lengkapkan **Pilihan A langkah 1–11** dahulu. Fail `Index.html`, `Display.html` dan `Logo.html` tetap diperlukan untuk paparan TV, tetapi boleh ditinggalkan jika tidak mahu.
2. Isi [`public/config.js`](public/config.js):
   ```js
   window.APP_CONFIG = { gasUrl: 'https://script.google.com/macros/s/…/exec' };
   ```
3. Dalam [`.firebaserc`](.firebaserc), tukar `ISI_PROJECT_ID` kepada ID projek Firebase anda.
4. Deploy (perlukan [Node.js](https://nodejs.org)):
   ```bash
   npm install -g firebase-tools
   firebase login
   cd firebase-gas
   firebase deploy --only hosting
   ```

Firebase Authentication **tidak diperlukan**, kerana log masuk diuruskan oleh sistem sendiri.

---

## Import pukal nama guru
Di **Daftar & Urus Guru → Import Pukal**, tampal satu guru setiap baris. Anda juga boleh salin terus dari Excel atau Google Sheets:
```
Siti Aminah binti Ali, Bahasa Melayu
Lim Wei Ming, Matematik, lim@contoh.com
Rahman bin Yusof
```
Format: `Nama, Panitia (pilihan), E-mel (pilihan)`. E-mel hanya digunakan untuk notifikasi.

## Kemas kini sistem kemudian
- **Ubah `Code.gs`:** klik **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL tidak berubah.
- **Ubah fail dalam `public/`:** jalankan `node tools/build-gas.js` untuk menjana semula `gas/Index.html` dan `gas/Display.html`. Tampal semula fail tersebut dalam Apps Script, kemudian deploy *New version*. Untuk Pilihan B, jalankan juga `firebase deploy`.

## Sandaran data
Semua data berada dalam Google Sheet. Gunakan **File → Version history** atau **File → Make a copy** untuk sandaran. **Jangan ubah nama helaian atau baris tajuk.**

## Masalah lazim
| Masalah | Penyelesaian |
|---|---|
| "Helaian … tiada" | Jalankan fungsi `setup` dalam Apps Script |
| Nama guru tiada dalam dropdown | Pastikan guru didaftarkan dan berstatus **Aktif** |
| Guru lupa kata laluan | **Daftar & Urus Guru → ⋯ → Set semula kata laluan** |
| "Terlalu banyak cubaan" | Tunggu 15 minit, atau pentadbir set semula kata laluan |
| Perubahan kod tidak berkesan | Deploy **New version** (bukan hanya Save) |
| Sistem agak perlahan (1–2 saat) | Ini normal untuk Apps Script |

## Ujian tempatan (untuk pembangun)
```bash
node test/gas-mock-server.js 8090 &   # jalankan Code.gs sebenar dengan tiruan Google Sheets
node test/e2e.js                      # ujian pelayar (Playwright), kedua-dua mod
```

## Struktur
```
firebase-gas/
  gas/Code.gs            Backend: API, log masuk, logik tempahan
  gas/Index.html         Aplikasi untuk Apps Script (dijana oleh tools/build-gas.js)
  gas/Display.html       Paparan TV untuk Apps Script (dijana)
  gas/Logo.html          Logo lalai sistem sebagai data URL (ditampal ke Apps Script)
  gas/appsscript.json    Manifest Apps Script
  public/                Sumber frontend + laman untuk Firebase Hosting
  tools/build-gas.js     Jana gas/*.html daripada public/
  test/                  Pelayan tiruan & ujian pelayar
```
