// Uploads a catalogue JSON file into the Firestore "models" collection (one document per model).
// Usage: npm run seed -- service-account.json path/to/catalogue.json
// Documents with the same model name are overwritten; other models in Firestore are left alone.
const fs = require("fs");
const { connect, COLLECTION, docId } = require("../firebase");

async function main() {
  const [keyFile, dataFile] = process.argv.slice(2);
  if (!dataFile) throw new Error("Usage: npm run seed -- service-account.json catalogue.json");
  const db = connect(keyFile);
  const catalog = JSON.parse(fs.readFileSync(dataFile, "utf8"));

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
