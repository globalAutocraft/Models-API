// Uploads models.js into the Firestore "models" collection (one document per model).
// Usage: npm run seed -- path/to/service-account.json
// Existing documents with the same model name are overwritten; others are left alone.
const { connect, COLLECTION, docId } = require("../firebase");
const catalog = require("../models");

async function main() {
  const db = connect(process.argv[2]);
  if (!db) throw new Error("Pass the service-account JSON path, or set FIREBASE_SERVICE_ACCOUNT");

  const batch = db.batch();
  Object.entries(catalog).forEach(([name, model], order) => {
    batch.set(db.collection(COLLECTION).doc(docId(name)), { name, order, ...model });
  });
  await batch.commit();
  console.log(`Uploaded ${Object.keys(catalog).length} models to Firestore collection "${COLLECTION}"`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
