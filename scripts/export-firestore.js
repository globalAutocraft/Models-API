// Downloads the Firestore "models" collection into a local JSON file as a backup.
// Usage: npm run export -- service-account.json [output.json]
// The output can be uploaded again with: npm run seed -- service-account.json output.json
const fs = require("fs");
const { connect, COLLECTION } = require("../firebase");

async function main() {
  const [keyFile, outFile = `backup-${new Date().toISOString().slice(0, 10)}.json`] = process.argv.slice(2);
  const db = connect(keyFile);
  if (!db) throw new Error("Usage: npm run export -- service-account.json [output.json]");

  const snap = await db.collection(COLLECTION).get();
  const docs = snap.docs.map((d) => d.data()).sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9));
  const catalog = {};
  for (const { name, order, ...model } of docs) catalog[name] = model;
  fs.writeFileSync(outFile, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`Saved ${docs.length} models to ${outFile}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
