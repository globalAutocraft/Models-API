// Firebase / Firestore connection shared by the server and scripts.
// Credentials come from a service-account JSON, given either as:
//   - FIREBASE_SERVICE_ACCOUNT env var holding the whole JSON (used on Render), or
//   - a path to the downloaded .json file (used by local scripts).
const fs = require("fs");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const COLLECTION = "models";

function loadServiceAccount(filePath) {
  if (filePath) return JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  return null;
}

let db = null;
function connect(filePath) {
  if (db) return db;
  const account = loadServiceAccount(filePath);
  if (!account) return null;
  initializeApp({ credential: cert(account) });
  db = getFirestore();
  return db;
}

// Firestore document ID for a model name ("APACHE RTR 160 4V" -> "apache-rtr-160-4v")
const docId = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

module.exports = { connect, COLLECTION, docId };
