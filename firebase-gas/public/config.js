/*
 * Konfigurasi sistem — ISI SEBELUM DEPLOY.
 * Lihat firebase-gas/README.md untuk cara mendapatkan setiap nilai.
 */
window.APP_CONFIG = {
  // Firebase Console → Project settings → General → Your apps → SDK setup and configuration (Config)
  firebase: {
    apiKey: 'ISI_API_KEY',
    authDomain: 'ISI_PROJECT_ID.firebaseapp.com',
    projectId: 'ISI_PROJECT_ID',
    appId: 'ISI_APP_ID',
  },
  // URL Web App Google Apps Script (Deploy → New deployment → Web app), berakhir dengan /exec
  gasUrl: 'https://script.google.com/macros/s/ISI_DEPLOYMENT_ID/exec',
};
