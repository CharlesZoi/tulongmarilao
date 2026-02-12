// Runtime environment loader - gets config from Netlify edge functions or fallback
(function() {
  // Try to get from Netlify environment (this won't work in browser, but we'll try)
  // For production, we need to use a different approach
  
  const defaultConfig = {
    FIREBASE_API_KEY: '',
    FIREBASE_AUTH_DOMAIN: '',
    FIREBASE_PROJECT_ID: '',
    FIREBASE_STORAGE_BUCKET: '',
    FIREBASE_MESSAGING_SENDER_ID: '',
    FIREBASE_APP_ID: '',
    
    FIREBASE_CHAT_API_KEY: '',
    FIREBASE_CHAT_AUTH_DOMAIN: '',
    FIREBASE_CHAT_PROJECT_ID: '',
    FIREBASE_CHAT_STORAGE_BUCKET: '',
    FIREBASE_CHAT_MESSAGING_SENDER_ID: '',
    FIREBASE_CHAT_APP_ID: '',
    
    GOOGLE_MAPS_API_KEY: '',
    USE_GOOGLE_MAPS: 'false'
  };
  
  // Make available globally
  window.env = window.__env = defaultConfig;
  
  console.log('Environment configuration loaded - using empty config');
})();
