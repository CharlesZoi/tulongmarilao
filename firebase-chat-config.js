const firebaseChatConfig = {
    apiKey: window.env?.FIREBASE_CHAT_API_KEY || "AIzaSyBrUVlDopNEdWXuieioSeJmNA1fJ1HDHio",
    authDomain: window.env?.FIREBASE_CHAT_AUTH_DOMAIN || "tulong-marilao.firebaseapp.com",
    projectId: window.env?.FIREBASE_CHAT_PROJECT_ID || "tulong-marilao",
    storageBucket: window.env?.FIREBASE_CHAT_STORAGE_BUCKET || "tulong-marilao.firebasestorage.app",
    messagingSenderId: window.env?.FIREBASE_CHAT_MESSAGING_SENDER_ID || "402382701255",
    appId: window.env?.FIREBASE_CHAT_APP_ID || "1:402382701255:web:40699deee80997aa6bb4e2"
};

export { firebaseChatConfig };