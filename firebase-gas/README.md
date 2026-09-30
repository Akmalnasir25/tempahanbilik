# Sistem Tempahan Bilik Khas — Versi Google Apps Script (banyak sekolah)

Versi ini **percuma sepenuhnya** — tiada pelayan, tiada cPanel.
- **Data:** disimpan dalam **Google Sheets**.
- **Logik sistem:** berjalan dalam **Google Apps Script (GAS)**.
- **Laman web:** di-hos di **Firebase Hosting** dengan domain sendiri, contohnya `booking.akmalsys.com`.

> Versi PHP masih ada di root repo dan tidak diubah.

## Konsep banyak sekolah

```
booking.akmalsys.com             → Satu alamat untuk semua sekolah:
                                   masukkan kod sekolah KPM (cth. PEA1234) → Teruskan → pilih nama guru
booking.akmalsys.com/platform    → Panel Super Admin (anda): cipta, gantung & urus sekolah
```

- **Setiap sekolah mendapat Google Sheet sendiri**, dicipta automatik dalam Google Drive anda. Data sekolah tidak pernah bercampur.
- **Log masuk, sesi dan kata laluan juga terpisah.** Token sekolah A ditolak di sekolah B.
- **Daftar platform:** Google Sheet yang memiliki skrip menyimpan senarai sekolah, akaun Super Admin dan log audit.
- **Senarai nama guru hanya dipaparkan selepas kod sekolah yang betul dimasukkan.** Senarai sekolah tidak pernah dipaparkan.
- **Sekolah diingati pada peranti:** guru hanya perlu taip kod sekali. Pautan **Tukar sekolah** di halaman log masuk membolehkan kod lain dimasukkan.

## Cara log masuk (guru & admin sekolah)

1. Guru buka `booking.akmalsys.com` dan masukkan kod sekolah KPM (sekali sahaja bagi setiap peranti).
2. **Admin sekolah mendaftarkan nama guru sahaja**, satu per satu atau secara import pukal.
3. Guru **pilih nama mereka dari dropdown**. Mereka boleh menaip untuk mencari nama.
4. **Kali pertama:** guru **mendaftarkan No. Kad Pengenalan sendiri**.
   - No. KP mesti 12 digit dan ditaip dua kali.
   - No. KP ini menjadi kata laluan guru.
   - **Akaun kemudian menunggu pengesahan admin sekolah.** Ini menghalang orang luar yang tahu kod sekolah daripada mendaftar menggunakan nama guru lain.
5. **Admin sekolah mengesahkan** di **Daftar & Urus Guru**: klik **Sahkan**, atau **Sahkan semua**. Jika pendaftaran mencurigakan, klik **Tolak**: No. KP itu dibuang dan guru sebenar boleh mendaftar semula.
6. **Seterusnya:** pilih nama dan masukkan No. KP. Sengkang dibenarkan, contohnya `900101-10-1234`.
7. Guru boleh menukar kata laluan di **Profil Saya**.
8. Jika guru lupa kata laluan, admin sekolah klik **Set semula kata laluan**. Guru mendaftarkan No. KP semula, dan admin mengesahkannya sekali lagi.

Keselamatan:
- No. KP dan kata laluan disimpan sebagai cincangan bergaram (*salted hash*), bukan teks biasa.
- Akaun dikunci selama 15 minit selepas 5 cubaan yang salah.

---

## Langkah 1 — Google Apps Script (backend)

1. Log masuk ke Google dan cipta **Google Sheet baharu**, contohnya "Platform Tempahan Bilik". Sheet ini menjadi daftar platform.
2. Klik **Extensions → Apps Script**.
3. **`Code.gs`**: padam kandungan asal, kemudian tampal seluruh kandungan [`gas/Code.gs`](gas/Code.gs).
4. **`Index.html`**: klik **＋ → HTML**, namakan **`Index`**, kemudian tampal kandungan [`gas/Index.html`](gas/Index.html).
5. **`Display.html`**: ulang langkah 4 dengan nama **`Display`** dan kandungan [`gas/Display.html`](gas/Display.html).
6. (Disyorkan) Tetapkan zon waktu Malaysia:
   - Buka ⚙️ **Project Settings**.
   - Tandakan **"Show appsscript.json"**.
   - Tampal kandungan [`gas/appsscript.json`](gas/appsscript.json).
7. Semak bahagian atas `Code.gs`:
   ```js
   var CONFIG = {
     PLATFORM_NAME: 'Sistem Tempahan Bilik Khas',
     WEB_URL: 'https://booking.akmalsys.com',   // alamat sistem (dipaparkan kepada admin sekolah & dalam e-mel)
   };
   ```
   Jika tidak menggunakan domain sendiri, tetapkan `WEB_URL: ''`. URL Web App akan digunakan sebagai alamat sistem.
8. Pilih fungsi **`setup`** dan klik **▶ Run**, kemudian benarkan akses apabila diminta. Kebenaran ini membolehkan skrip mencipta Google Sheet untuk setiap sekolah.
9. Buka **Deploy → New deployment → ⚙️ Web app**, kemudian tetapkan:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
10. Salin **URL Web App**. URL ini berakhir dengan `/exec`.

> 💡 Gunakan **akaun Gmail biasa** untuk memiliki Sheet dan skrip ini. Sesetengah akaun DELIMa menyekat pilihan "Anyone".

## Langkah 2 — Firebase Hosting + domain `booking.akmalsys.com`

1. Isi [`public/config.js`](public/config.js):
   ```js
   window.APP_CONFIG = { gasUrl: 'https://script.google.com/macros/s/…/exec' };
   ```
2. Dalam [`.firebaserc`](.firebaserc), tukar `ISI_PROJECT_ID` kepada ID projek Firebase anda.
3. Deploy. Langkah ini memerlukan [Node.js](https://nodejs.org).
   ```bash
   npm install -g firebase-tools
   firebase login
   cd firebase-gas
   firebase deploy --only hosting
   ```
4. Sambungkan domain di **Firebase Console → Hosting → Add custom domain**:
   - Masukkan `booking.akmalsys.com`.
   - Firebase memberikan rekod DNS: rekod **TXT** untuk pengesahan, dan rekod **A** atau **CNAME**.
   - Tambah rekod tersebut di panel DNS tempat anda membeli `akmalsys.com`. Gunakan nama hos **`booking`**.
   - Tunggu status bertukar menjadi *Connected*. Ini biasanya mengambil beberapa minit hingga beberapa jam.
   - SSL (https) disediakan secara percuma dan automatik.

[`firebase.json`](firebase.json) sudah menghantar semua laluan (contohnya `/platform`) ke `index.html`.

## Langkah 3 — Super Admin & cipta sekolah

1. Buka **`https://booking.akmalsys.com/platform`**, atau `URL-web-app?page=platform`.
2. **Kali pertama sahaja:** cipta akaun Super Admin anda. Kata laluan mesti sekurang-kurangnya 10 aksara.
3. Klik **Tambah Sekolah** dan isi maklumat berikut:
   - Nama sekolah.
   - **Kod sekolah KPM**, contohnya `PEA1234`. Kod ini tidak boleh ditukar kemudian.
   - Nama admin sekolah.
4. Salin maklumat yang dipaparkan dan hantar kepada admin sekolah. Kata laluan sementara hanya dipaparkan **sekali**.
   ```
   Pautan sistem: https://booking.akmalsys.com/
   Kod sekolah: PEA1234
   Nama admin: Pn. Siti (Penyelaras ICT)
   Kata laluan sementara: xxxxxxxxxx
   ```
5. Admin sekolah log masuk dan menukar kata laluan di **Profil Saya**. Selepas itu admin mendaftarkan guru dan bilik khas, dan mengesahkan guru selepas log masuk pertama mereka.

Panel Super Admin juga boleh melakukan perkara berikut:
- **Gantung atau aktifkan sekolah**, contohnya apabila langganan tamat. Pengguna sekolah itu akan melihat mesej "digantung".
- **Set semula kata laluan admin sekolah**, atau tambah admin kedua.
- **Padam sekolah.**
  - Anda perlu menaip kod sekolah untuk mengesahkan.
  - Google Sheet sekolah itu tidak dibuang. Ia dinamakan semula "[DIPADAM] …" supaya data boleh dipulihkan.
- **Buka Google Sheet** mana-mana sekolah.
- **Lihat Log Audit** platform.
- **Guna Google Sheet sedia ada.** Jika sekolah pernah menggunakan versi satu-sekolah, tampal pautan Sheet lamanya semasa mencipta sekolah. Data lama akan terus digunakan.

## Had percuma Google Apps Script (penting)

Semua sekolah berkongsi satu skrip, jadi had Google untuk akaun anda turut dikongsi.
- **Permintaan serentak:** kira-kira 30 bagi setiap skrip. Setiap tempahan mengambil masa 1–2 saat.
- **Satu kunci (lock) untuk semua simpanan:**
  - Tempahan dari sekolah berlainan diproses satu demi satu.
  - Ini selamat, tetapi boleh menjadi perlahan jika ramai menempah pada saat yang sama.
- **Kuota e-mel harian:**
  - Akaun Gmail biasa: kira-kira 100 e-mel.
  - Google Workspace: kira-kira 1,500 e-mel.

Secara praktikal, had ini **sesuai untuk sekitar 10–30 sekolah** dengan penggunaan biasa. Untuk skala lebih besar, gunakan versi PHP di VPS, atau pecahkan kepada beberapa salinan skrip.

---

## Import pukal nama guru
Di **Daftar & Urus Guru → Import Pukal**, tampal satu guru bagi setiap baris. Anda boleh salin terus dari Excel atau Google Sheets.
```
Siti Aminah binti Ali, Bahasa Melayu
Lim Wei Ming, Matematik, lim@contoh.com
Rahman bin Yusof
```
Format: `Nama, Panitia (pilihan), E-mel (pilihan)`. E-mel hanya digunakan untuk notifikasi.

## Kemas kini sistem kemudian
- **Jika `Code.gs` diubah:** buka **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL tidak berubah.
- **Jika fail dalam `public/` diubah:**
  1. Jalankan `node tools/build-gas.js` untuk menjana semula `gas/Index.html` dan `gas/Display.html`.
  2. Tampal semula kedua-dua fail itu dalam Apps Script.
  3. Deploy *New version*.
  4. Jalankan `firebase deploy`.

## Sandaran data
- **Data sekolah:** setiap sekolah ada Google Sheet sendiri dalam Drive anda. Pautannya boleh dibuka dari panel Super Admin.
- **Cara sandaran:** gunakan **File → Version history** atau **File → Make a copy**.
- **Jangan ubah nama helaian atau baris tajuk.**

## Masalah lazim
| Masalah | Penyelesaian |
|---|---|
| "Kod sekolah tidak dijumpai" | Semak ejaan kod, atau semak senarai di panel Super Admin |
| Guru "menunggu pengesahan" | Admin sekolah klik **Sahkan** di **Daftar & Urus Guru** |
| Guru kata "akaun sudah didaftarkan" tetapi bukan dia | Admin klik **Tolak** (jika masih menunggu) atau **Set semula kata laluan** |
| Sekolah "digantung" | Aktifkan semula di panel Super Admin |
| Admin sekolah lupa kata laluan | Panel Super Admin → Urus → **Set semula** |
| Nama guru tiada dalam dropdown | Pastikan guru didaftarkan dan berstatus **Aktif** |
| "Terlalu banyak cubaan" | Tunggu 15 minit, atau minta admin set semula kata laluan |
| Perubahan kod tidak berkesan | Deploy **New version** (bukan sekadar Save) |
| Domain belum berfungsi | Semak rekod DNS dan tunggu sehingga status *Connected* di Firebase |
| Sistem agak perlahan (1–2 saat) | Ini normal untuk Apps Script |

## Ujian tempatan (untuk pembangun)
```bash
node test/gas-mock-server.js 8090 &   # jalankan Code.gs sebenar dengan tiruan Google Sheets
node test/e2e.js                      # ujian pelayar (Playwright): platform, 2 sekolah, kedua-dua mod
```

## Struktur
```
firebase-gas/
  gas/Code.gs            Backend: API platform & sekolah, log masuk, logik tempahan
  gas/Index.html         Aplikasi untuk Apps Script (dijana oleh tools/build-gas.js)
  gas/Display.html       Paparan TV untuk Apps Script (dijana)
  gas/appsscript.json    Manifest Apps Script
  public/                Sumber frontend + laman untuk Firebase Hosting
  public/assets/js/platform.js   Panel Super Admin
  tools/build-gas.js     Jana gas/*.html daripada public/
  test/                  Pelayan tiruan & ujian pelayar
```
