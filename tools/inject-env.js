#!/usr/bin/env node
/* Inject environment variables directly into HTML files during build */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');

// Get environment variables
const env = {};
const keys = [
  'FIREBASE_API_KEY','FIREBASE_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_STORAGE_BUCKET','FIREBASE_MESSAGING_SENDER_ID','FIREBASE_APP_ID',
  'FIREBASE_CHAT_API_KEY','FIREBASE_CHAT_AUTH_DOMAIN','FIREBASE_CHAT_PROJECT_ID','FIREBASE_CHAT_STORAGE_BUCKET','FIREBASE_CHAT_MESSAGING_SENDER_ID','FIREBASE_CHAT_APP_ID',
  'GOOGLE_MAPS_API_KEY','USE_GOOGLE_MAPS'
];

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath);
  let src = raw.toString('utf8');

  // Handle UTF-16 encoded .env files (common on Windows editors).
  if (src.includes('\u0000')) {
    src = raw.toString('utf16le');
  }

  const parsed = {};
  src.replace(/^\uFEFF/, '').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      parsed[key] = val;
    }
  });

  return parsed;
}

const fileEnv = readEnvFile(envPath);

keys.forEach((k) => {
  if (fileEnv[k]) {
    env[k] = fileEnv[k];
    return;
  }
  if (process.env[k]) {
    env[k] = process.env[k];
  }
});

// Create the inline script content
const envScript = `window.env = window.__env = ${JSON.stringify(env, null, 2)};`;

// Find all HTML files and inject the script
const htmlFiles = [
  'index.html',
  'master-admin.html', 
  'user-dashboard.html',
  'admin-map.html'
];

htmlFiles.forEach(file => {
  const filePath = path.join(root, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace the env-loader.js script with inline environment variables
    content = content.replace(
      '<script src="env-loader.js"></script>',
      `<script>${envScript}</script>`
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`Injected environment variables into ${file}`);
  }
});

console.log(`Environment variables injected: ${Object.keys(env).length} variables`);
