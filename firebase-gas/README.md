# Sistem Tempahan Bilik Khas — Versi Firebase + Google Apps Script

Versi ini tidak memerlukan pelayan PHP:

| Bahagian | Teknologi | Kos |
|---|---|---|
| Laman web (frontend) | **Firebase Hosting** | Percuma (pelan Spark) |
| Log masuk | **Firebase Authentication**: log masuk Google dengan akaun **DELIMa** | Percuma |
| Backend & logik tempahan | **Google Apps Script** (Web App) | Percuma |
| Pangkalan data | **Google Sheets** | Percuma |

> Versi PHP asal masih ada di root repo dan tidak diubah.

Ciri-cirinya sama dengan versi PHP: semakan pertembungan masa nyata, tempahan berulang, mod kelulusan (auto / manual / ikut bilik), jadual bulan/minggu/hari, grid kekosongan, penutupan & cuti, laporan, log audit, paparan TV, dan mod gelap. Ada juga beberapa tambahan:

- Guru **log masuk dengan akaun DELIMa**, jadi tiada kata laluan baharu.
- **Admin mendaftarkan nama & e-mel guru.** Hanya e-mel berdaftar boleh masuk. Guru boleh didaftarkan satu per satu atau diimport secara pukal dengan menampal senarai dari Excel.
- Guru yang belum berdaftar boleh **memohon akses**, dan admin mengesahkannya. Ciri ini boleh dimatikan.
- **Notifikasi e-mel** automatik apabila tempahan diluluskan atau ditolak (melalui Gmail).
- Data boleh dilihat terus dalam Google Sheets.

---

## Langkah 1 — Sediakan Google Sheets & Apps Script (backend)

1. Log masuk ke Google dengan akaun yang akan **memiliki data** (lihat nota ⚠️ di bawah), dan cipta **Google Sheet baharu**. Namakan contohnya "Data Tempahan Bilik Khas".
2. Klik **Extensions → Apps Script**.
3. Padam kandungan `Code.gs` yang ada, kemudian **salin seluruh kandungan** [`gas/Code.gs`](gas/Code.gs) ke dalamnya.
4. Klik ⚙️ **Project Settings**, tandakan **"Show appsscript.json manifest file in editor"**, kemudian gantikan kandungan `appsscript.json` dengan [`gas/appsscript.json`](gas/appsscript.json).
5. Di bahagian atas `Code.gs`, isi `CONFIG`:
   ```js
   var CONFIG = {
     FIREBASE_API_KEY: 'AIza....',                   // dari Langkah 2
     INITIAL_ADMINS: ['penyelaras.ict@moe-dl.edu.my'], // e-mel DELIMa pentadbir pertama
   };
   ```
6. Pilih fungsi **`setup`** dalam menu atas dan klik **Run**. Benarkan akses apabila diminta. Helaian (Users, Rooms, Bookings, …) dan data contoh akan dicipta.
7. Klik **Deploy → New deployment**, kemudian pilih jenis **Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**
8. Klik **Deploy** dan **salin URL Web App** (berakhir dengan `/exec`).

> ⚠️ **Akaun DELIMa & pilihan "Anyone":** sesetengah domain DELIMa tidak membenarkan Web App dikongsi kepada "Anyone". Jika pilihan itu tiada, gunakan **akaun Gmail sekolah (bukan DELIMa)** untuk memiliki Sheet dan Apps Script ini. Guru masih log masuk dengan akaun DELIMa masing-masing, kerana log masuk dikendalikan oleh Firebase dan bukan oleh Apps Script.

## Langkah 2 — Sediakan Firebase

1. Buka [console.firebase.google.com](https://console.firebase.google.com) dan pilih projek anda (atau cipta yang baharu).
2. **Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**
3. **Project settings (⚙️) → General → Your apps → ikon `</>` (Web)**. Daftar aplikasi web, kemudian salin nilai `firebaseConfig`.
4. Buka [`public/config.js`](public/config.js) dan isi:
   ```js
   window.APP_CONFIG = {
     firebase: { apiKey: 'AIza…', authDomain: 'projek-anda.firebaseapp.com', projectId: 'projek-anda', appId: '1:…' },
     gasUrl: 'https://script.google.com/macros/s/…/exec',   // URL dari Langkah 1
   };
   ```
5. Salin juga `apiKey` yang sama ke `CONFIG.FIREBASE_API_KEY` dalam Apps Script. Selepas itu, klik **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**.
6. Dalam fail [`.firebaserc`](.firebaserc), tukar `ISI_PROJECT_ID` kepada ID projek Firebase anda.

## Langkah 3 — Deploy ke Firebase Hosting

Anda perlukan [Node.js](https://nodejs.org) di komputer.

```bash
npm install -g firebase-tools
firebase login
cd firebase-gas
firebase deploy --only hosting
```

Sistem kini boleh dibuka di `https://projek-anda.web.app`.

> Jika anda menggunakan domain sendiri, contohnya `tempahan.sekolah.edu.my`, tambahkannya di **Hosting → Add custom domain**, dan di **Authentication → Settings → Authorized domains**.

## Langkah 4 — Mula guna

1. Buka URL sistem dan klik **Log masuk dengan Google** menggunakan e-mel dalam `INITIAL_ADMINS`. Anda akan masuk sebagai **Pentadbir**.
2. Pergi ke **Tetapan Sistem** dan kemas kini nama sekolah. Tetapkan juga **URL sistem** (untuk pautan dalam e-mel) dan pilih mod kelulusan.
3. Pergi ke **Daftar & Urus Guru** dan klik **Daftar Guru**, atau guna **Import Pukal**. Untuk import pukal, tampal senarai dalam format:
   ```
   Siti Aminah binti Ali, g-12345678@moe-dl.edu.my, Bahasa Melayu
   Lim Wei Ming, g-87654321@moe-dl.edu.my, Matematik
   ```
4. Kemas kini senarai bilik di **Urus Bilik Khas**, dan waktu persekolahan di **Waktu Persekolahan**.
5. Kongsikan URL sistem kepada guru. Mereka hanya perlu klik **Log masuk dengan Google**.

## Kemas kini sistem kemudian

- **Ubah frontend** (fail dalam `public/`): jalankan `firebase deploy --only hosting` sekali lagi.
- **Ubah `Code.gs`**: klik **Deploy → Manage deployments → ✏️ → New version**. URL Web App kekal sama.

## Sandaran data
Semua data berada dalam Google Sheet tersebut. Anda boleh guna **File → Version history**, atau **File → Make a copy** untuk sandaran. **Jangan ubah nama helaian atau baris tajuk.**

## Masalah lazim

| Masalah | Penyelesaian |
|---|---|
| "Konfigurasi belum lengkap" | Isi `public/config.js` dan deploy semula |
| "Access blocked" semasa log masuk Google | Pentadbir DELIMa negeri/sekolah menyekat aplikasi pihak ketiga. Minta domain Firebase anda dibenarkan, atau hubungi pentadbir DELIMa |
| "Sesi log masuk tamat" berulang kali | Pastikan `CONFIG.FIREBASE_API_KEY` sama dengan `apiKey` dalam `config.js`, dan anda telah deploy **New version** |
| "Hanya akaun @moe-dl.edu.my dibenarkan" | Tukar atau kosongkan *Domain e-mel* di Tetapan Sistem |
| "Helaian … tiada" | Jalankan fungsi `setup` dalam Apps Script |
| Sistem agak perlahan (1–2 saat) | Ini normal untuk Apps Script |

## Ujian tempatan (untuk pembangun)
`test/gas-mock-server.js` menjalankan `Code.gs` sebenar dalam Node, dengan tiruan Google Sheets dan perkhidmatan Apps Script. `test/e2e.js` pula menguji keseluruhan aliran dalam pelayar menggunakan Playwright.

```bash
node test/gas-mock-server.js 8090 &
node test/e2e.js
```

## Struktur
```
firebase-gas/
  gas/Code.gs            Backend Apps Script (API, pengesahan token, logik tempahan)
  gas/appsscript.json    Manifest Apps Script
  public/                Laman yang di-deploy ke Firebase Hosting
    index.html           Aplikasi (SPA)
    display.html         Paparan TV jadual hari ini
    config.js            Konfigurasi Firebase + URL Apps Script
    assets/js/core.js    Log masuk, API, penghala, susun atur
    assets/js/pages.js   Halaman guru
    assets/js/admin.js   Halaman pentadbir
  firebase.json, .firebaserc
  test/                  Pelayan tiruan & ujian pelayar
```
