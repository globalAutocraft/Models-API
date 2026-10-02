const express = require("express");
const cors = require("cors");
const models = require("./models");

const app = express();
app.use(cors());

// Lookup key: case-insensitive, ignores extra spaces/punctuation differences
const normalise = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const bySlug = new Map(models.map((m) => [m.slug, m]));
const byName = new Map(models.map((m) => [normalise(m.name), m]));

function findModel(key) {
  return bySlug.get(String(key).toLowerCase()) || byName.get(normalise(key)) || null;
}

app.get("/", (req, res) => {
  res.json({
    name: "Vehicle Images API",
    total: models.length,
    endpoints: {
      "GET /api/models": "List all models. Query: ?search=jupiter  ?hasImage=true",
      "GET /api/models/:slugOrName": "Get one model (slug like 'tvs-raider-disc' or exact name)",
      "GET /api/image?model=NAME": "Get image URL for a model name (JSON)",
      "GET /api/models/:slugOrName/image": "Redirects to the image — use directly in <img src>",
    },
  });
});

app.get("/health", (req, res) => res.send("ok"));

app.get("/api/models", (req, res) => {
  let result = models;
  if (req.query.search) {
    const q = normalise(req.query.search);
    result = result.filter((m) => normalise(m.name).includes(q));
  }
  if (req.query.hasImage === "true") result = result.filter((m) => m.image);
  if (req.query.hasImage === "false") result = result.filter((m) => !m.image);
  res.json({ count: result.length, data: result });
});

app.get("/api/models/:key", (req, res) => {
  const model = findModel(req.params.key);
  if (!model) return res.status(404).json({ error: "Model not found" });
  res.json(model);
});

app.get("/api/image", (req, res) => {
  if (!req.query.model) return res.status(400).json({ error: "Query parameter 'model' is required" });
  const model = findModel(req.query.model);
  if (!model) return res.status(404).json({ error: "Model not found" });
  res.json({ name: model.name, image: model.image });
});

app.get("/api/models/:key/image", (req, res) => {
  const model = findModel(req.params.key);
  if (!model || !model.image) return res.status(404).json({ error: "Image not found" });
  res.set("Cache-Control", "public, max-age=86400");
  res.redirect(302, model.image);
});

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vehicle Images API running on port ${PORT}`));
