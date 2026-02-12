#!/usr/bin/env node
/* Generates `env-config.js` from `.env` (writes `window.env = window.__env = {...}`). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'env-config.js');

let env = {};

if (fs.existsSync(envPath)) {
  const src = fs.readFileSync(envPath, 'utf8');
  src.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) {
      let key = m[1].trim();
      let val = m[2].trim();
      // remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  });
} else {
  // Fall back to process.env (useful in CI)
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
}

const fileContent = 'window.env = window.__env = ' + JSON.stringify(env, null, 2) + ';\n';
fs.writeFileSync(outPath, fileContent);
console.log(`Written ${outPath} (${Object.keys(env).length} keys)`);
