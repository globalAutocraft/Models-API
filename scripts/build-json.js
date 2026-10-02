// Writes models.json from models.js, so the catalogue can also be fetched
// straight from GitHub/jsDelivr without the server. Usage: npm run build:json
const fs = require("fs");
const path = require("path");
const catalog = require("../models");

fs.writeFileSync(path.join(__dirname, "..", "models.json"), JSON.stringify(catalog, null, 2) + "\n");
console.log(`Wrote ${Object.keys(catalog).length} models to models.json`);
