const firebaseChatConfig = {
    apiKey: window.env?.FIREBASE_CHAT_API_KEY,
    authDomain: window.env?.FIREBASE_CHAT_AUTH_DOMAIN,
    projectId: window.env?.FIREBASE_CHAT_PROJECT_ID,
    storageBucket: window.env?.FIREBASE_CHAT_STORAGE_BUCKET,
    messagingSenderId: window.env?.FIREBASE_CHAT_MESSAGING_SENDER_ID,
    appId: window.env?.FIREBASE_CHAT_APP_ID
};

export { firebaseChatConfig };