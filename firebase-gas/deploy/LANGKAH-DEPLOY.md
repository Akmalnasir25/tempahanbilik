# Langkah Deploy — Sistem Tempahan Bilik Khas (GAS + Firebase + booking.akmalsys.com)

Panduan ini untuk dijalankan di komputer anda (Windows). Ada dua cara:

- **Cara A:** satu klik dengan `deploy.bat`.
- **Cara B:** arahan CLI satu per satu.

Kedua-dua cara menghasilkan sistem yang sama.

---

## 0. Persediaan (sekali sahaja)

1. Pasang **Node.js LTS** dari https://nodejs.org.
2. Dapatkan kod. Pilih salah satu:
   - GitHub → branch `claude/peaceful-planck-2aqhcd` (atau `main` jika sudah di-merge) → **Code → Download ZIP**, kemudian extract ke `C:\tempahanbilik`.
   - Atau guna git:
     ```
     git clone -b claude/peaceful-planck-2aqhcd https://github.com/Akmalnasir25/tempahanbilik.git C:\tempahanbilik
     ```
3. Sediakan projek Firebase di https://console.firebase.google.com. Catat **Project ID** (⚙️ Project settings), contohnya `tempahan-bilik-1a2b3`.

---

## Cara A — Satu klik

1. Klik dua kali `C:\tempahanbilik\firebase-gas\deploy\deploy.bat`.
2. Ikut arahan pada skrin:
   - Hidupkan suis **Google Apps Script API**, kemudian tekan Enter.
   - Klik **Allow** apabila pelayar meminta log masuk Google (clasp) dan log masuk Firebase.
   - Benarkan akses Web App sekali: **Review permissions → Advanced → Go to … (unsafe) → Allow**.
   - Taip **Project ID** Firebase.
3. Teruskan ke **Langkah 5 (Domain)** di bawah.

> Pemasangan clasp/firebase-tools boleh mengambil 1–3 minit tanpa paparan. Tunggu sahaja.

---

## Cara B — Arahan CLI satu per satu

Buka **Command Prompt** dan jalankan arahan mengikut turutan.

### 1. Pasang alat
```
npm install -g firebase-tools @google/clasp@2.4.2
```

### 2. Log masuk Apps Script
1. Buka https://script.google.com/home/usersettings dan hidupkan **Google Apps Script API**.
2. Jalankan:
   ```
   clasp login
   ```

### 3. Cipta projek Apps Script + Google Sheet platform (sekali sahaja)
```
cd C:\tempahanbilik\firebase-gas
node tools/build-gas.js

mkdir %TEMP%\tb-clasp
cd /d %TEMP%\tb-clasp
clasp create --type sheets --title "Platform Tempahan Bilik"
type .clasp.json
```
1. Salin nilai `scriptId` yang dipaparkan.
2. Kembali ke folder projek dan cipta `.clasp.json`. Gantikan `SCRIPT_ID_ANDA` dengan nilai tadi:
   ```
   cd /d C:\tempahanbilik\firebase-gas
   echo {"scriptId":"SCRIPT_ID_ANDA","rootDir":"gas"} > .clasp.json
   ```

> Projek dicipta dalam folder sementara supaya `gas\appsscript.json` (tetapan Web App & zon waktu Malaysia) tidak ditimpa.

### 4. Push kod & deploy Web App
```
clasp push --force
clasp deploy -d "Versi pertama"
```
1. Catat ID yang bermula dengan `AKfy...`. URL Web App anda ialah:
   `https://script.google.com/macros/s/AKfy.../exec`
2. **Buka URL itu sekali** dan benarkan akses: **Review permissions → Advanced → Go to … (unsafe) → Allow**. Anda sepatutnya nampak halaman "Masukkan kod sekolah". Helaian platform disediakan secara automatik.

### 5. Isi konfigurasi Firebase
1. Buka `public\config.js` dengan Notepad dan isi URL Web App:
   ```js
   window.APP_CONFIG = {
     gasUrl: 'https://script.google.com/macros/s/AKfy.../exec',
   };
   ```
2. Dalam `.firebaserc`, tukar `ISI_PROJECT_ID` kepada Project ID anda.

### 6. Deploy ke Firebase Hosting
```
firebase login
firebase deploy --only hosting
```
Laman sementara: `https://<project-id>.web.app`

---

## 5. Domain `booking.akmalsys.com` (sekali sahaja, untuk kedua-dua cara)

1. Firebase Console → projek → **Hosting** → **Add custom domain** → taip `booking.akmalsys.com`. Jangan tandakan redirect.
2. Salin rekod DNS yang dipaparkan ke panel DNS tempat anda membeli `akmalsys.com`:

   | Jenis | Nama / Host | Nilai |
   |---|---|---|
   | TXT | `booking` | seperti dipaparkan Firebase (`hosting-site=...`) |
   | A | `booking` | alamat IP yang dipaparkan Firebase |

   - Nama host ditulis **`booking`** sahaja, bukan `booking.akmalsys.com`.
   - Jika menggunakan **Cloudflare**, tetapkan awan kepada **kelabu (DNS only)**.
   - Padam rekod A atau CNAME lama untuk `booking` jika ada.
3. Tunggu status **Connected** (15 minit – 24 jam). SSL dipasang secara automatik.

---

## 6. Selepas siap

1. Buka `https://booking.akmalsys.com/platform` dan cipta akaun **Super Admin** (sekali sahaja).
2. Klik **Tambah Sekolah** dan isi:
   - nama sekolah;
   - kod sekolah KPM, contohnya `PEA1234`;
   - nama admin sekolah.
3. Hantar kepada admin sekolah: alamat `https://booking.akmalsys.com`, kod sekolah dan kata laluan sementara.
4. Guru akan:
   - buka `booking.akmalsys.com` dan masukkan kod sekolah;
   - pilih nama dan daftar No. KP;
   - log masuk selepas admin sekolah mengesahkan akaun mereka.

---

## Kemas kini sistem kemudian

- **Cara A:** klik dua kali `deploy.bat` sekali lagi. URL Web App dan projek Firebase yang sama akan digunakan.
- **Cara B:**
  ```
  cd /d C:\tempahanbilik\firebase-gas
  node tools/build-gas.js
  clasp push --force
  clasp deploy -i AKfy...ID_SAMA... -d "Kemas kini"
  firebase deploy --only hosting
  ```
  Gunakan `-i` dengan ID deployment yang sama supaya URL Web App tidak berubah.

---

## Masalah lazim

| Masalah | Penyelesaian |
|---|---|
| `'firebase' / 'clasp' is not recognized` | Tutup dan buka semula Command Prompt selepas `npm install -g` |
| `User has not enabled the Apps Script API` | Hidupkan suis di https://script.google.com/home/usersettings, tunggu 1 minit, kemudian cuba semula |
| Skrin "Konfigurasi belum lengkap" | `gasUrl` dalam `public\config.js` belum diisi. Isi, kemudian `firebase deploy` semula |
| "Authorization required" pada Web App | Buka URL `/exec` sebagai pemilik dan klik **Allow** |
| Domain lama "Pending" | Semak nama host `booking` dan tiada rekod lama yang bertembung. Jika guna Cloudflare, pastikan awan kelabu |
| Perubahan kod tidak kelihatan | Deploy semula dengan `clasp deploy -i <ID>` (bukan sekadar push), dan `firebase deploy` |

---

## Jika menggunakan Claude Code (CLI) di komputer anda

Buka Claude Code dalam folder `C:\tempahanbilik` dan minta:

> Ikut `firebase-gas/deploy/LANGKAH-DEPLOY.md` untuk deploy sistem ini. Project ID Firebase saya ialah `<project-id>`.

Log masuk Google/Firebase dan tetapan DNS tetap perlu anda lakukan sendiri di pelayar.
