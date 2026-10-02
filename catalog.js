// Keeps the catalogue in memory. With Firebase configured it listens to Firestore,
// so edits made from the admin front end show up in the API within seconds.
// Without Firebase it serves models.js.
const { connect, COLLECTION } = require("./firebase");

let catalog = require("./models");
let source = "models.js";

function start() {
  const db = connect();
  if (!db) {
    console.log("FIREBASE_SERVICE_ACCOUNT not set — serving data from models.js");
    return;
  }
  db.collection(COLLECTION).onSnapshot(
    (snap) => {
      if (snap.empty) {
        console.warn(`Firestore collection "${COLLECTION}" is empty — still serving models.js (run npm run seed)`);
        return;
      }
      const docs = snap.docs.map((d) => d.data()).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
      const next = {};
      for (const { name, order, ...model } of docs) next[name] = model;
      catalog = next;
      source = "firestore";
      console.log(`Loaded ${docs.length} models from Firestore`);
    },
    (err) => console.error("Firestore listener error:", err.message)
  );
}

module.exports = { start, get: () => catalog, source: () => source };
