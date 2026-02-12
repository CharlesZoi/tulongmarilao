// Runtime environment loader - gets config from Netlify environment
(function() {
  // For local development, these might be available
  // For production, we'll use inline script in HTML
  
  const defaultConfig = {
    FIREBASE_API_KEY: 'AIzaSyBrUVlDopNEdWXuieioSeJmNA1fJ1HDHio',
    FIREBASE_AUTH_DOMAIN: 'tulong-marilao.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'tulong-marilao',
    FIREBASE_STORAGE_BUCKET: 'tulong-marilao.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: '402382701255',
    FIREBASE_APP_ID: '1:402382701255:web:40699deee80997aa6bb4e2',
    
    FIREBASE_CHAT_API_KEY: 'AIzaSyBrUVlDopNEdWXuieioSeJmNA1fJ1HDHio',
    FIREBASE_CHAT_AUTH_DOMAIN: 'tulong-marilao.firebaseapp.com',
    FIREBASE_CHAT_PROJECT_ID: 'tulong-marilao',
    FIREBASE_CHAT_STORAGE_BUCKET: 'tulong-marilao.firebasestorage.app',
    FIREBASE_CHAT_MESSAGING_SENDER_ID: '402382701255',
    FIREBASE_CHAT_APP_ID: '1:402382701255:web:40699deee80997aa6bb4e2',
    
    GOOGLE_MAPS_API_KEY: 'your_google_maps_api_key_here',
    USE_GOOGLE_MAPS: 'false'
  };
  
  // Make available globally
  window.env = window.__env = defaultConfig;
  
  console.log('Environment configuration loaded');
})();
