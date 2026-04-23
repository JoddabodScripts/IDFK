const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

let db;

function initFirebase() {
  if (db) return db;
  
  let serviceAccount;
  
  const envVar = process.env.FIREBASE_CREDENTIALS;
  if (envVar) {
    try {
      serviceAccount = JSON.parse(envVar);
    } catch (e) {
      console.error('Failed to parse FIREBASE_CREDENTIALS:', e.message);
    }
  }
  
  if (!serviceAccount) {
    const credPath = process.env.FIREBASE_CREDENTIALS_PATH || '/app/firebase-credentials.json';
    if (fs.existsSync(credPath)) {
      serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    }
  }
  
  if (!serviceAccount) {
    throw new Error('Firebase credentials not found. Set FIREBASE_CREDENTIALS env var or upload firebase-credentials.json');
  }
  
  initializeApp({
    credential: cert(serviceAccount),
  });
  
  db = getFirestore();
  return db;
}

function getDb() {
  if (!db) {
    return initFirebase();
  }
  return db;
}

module.exports = { getDb, initFirebase };