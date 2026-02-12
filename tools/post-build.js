#!/usr/bin/env node
/* Post-build script to generate env-config.js from Netlify environment variables */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPath = path.join(root, 'env-config.js');

// Only read from process.env (Netlify environment)
const env = {};
const keys = [
  'FIREBASE_API_KEY','FIREBASE_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_STORAGE_BUCKET','FIREBASE_MESSAGING_SENDER_ID','FIREBASE_APP_ID',
  'FIREBASE_CHAT_API_KEY','FIREBASE_CHAT_AUTH_DOMAIN','FIREBASE_CHAT_PROJECT_ID','FIREBASE_CHAT_STORAGE_BUCKET','FIREBASE_CHAT_MESSAGING_SENDER_ID','FIREBASE_CHAT_APP_ID',
  'GOOGLE_MAPS_API_KEY','USE_GOOGLE_MAPS'
];

keys.forEach(k => {
  if (process.env[k]) {
    env[k] = process.env[k];
  }
});

// Only generate if we have environment variables
if (Object.keys(env).length > 0) {
  const fileContent = 'window.env = window.__env = ' + JSON.stringify(env, null, 2) + ';\n';
  fs.writeFileSync(outPath, fileContent);
  console.log(`Generated ${outPath} with ${Object.keys(env).length} variables`);
} else {
  console.log('No environment variables found, skipping env-config.js generation');
}
