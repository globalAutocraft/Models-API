// Keeps the catalogue in memory, loaded from the Firestore "models" collection.
// It listens for changes, so edits made in Firebase show up in the API within seconds.
const { connect, COLLECTION } = require("./firebase");

let catalog = null; // null until the first Firestore snapshot arrives
let configured = false;

function start() {
  const db = connect();
  if (!db) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not set — the API has no data to serve");
    return;
  }
  configured = true;
  db.collection(COLLECTION).onSnapshot(
    (snap) => {
      const docs = snap.docs.map((d) => d.data()).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
      const next = {};
      for (const { name, order, ...model } of docs) next[name] = withImageFallbacks(model);
      catalog = next;
      console.log(`Loaded ${docs.length} models from Firestore`);
    },
    (err) => console.error("Firestore listener error:", err.message)
  );
}

// The admin site lets variant/colour images be left empty; the API then shows the
// parent's image (colour -> variant -> model), so every entry always has an image.
function withImageFallbacks(model) {
  const variants = {};
  for (const [vName, v] of Object.entries(model.variants || {})) {
    const vImage = v.image || model.image || null;
    const colors = {};
    for (const [cName, c] of Object.entries(v.colors || {})) colors[cName] = { ...c, image: c.image || vImage };
    variants[vName] = { ...v, image: vImage, colors };
  }
  return { ...model, image: model.image || null, variants };
}

module.exports = { start, get: () => catalog, ready: () => catalog !== null, configured: () => configured };
