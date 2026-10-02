const express = require("express");
const cors = require("cors");
const catalog = require("./catalog");

const app = express();
app.use(cors());

// Lookup key: case-insensitive, ignores spaces/punctuation; a leading "TVS" is optional for models
const normalise = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const modelKey = (s) => normalise(s).replace(/^tvs/, "");

const findIn = (obj, key, keyFn = normalise) => {
  const k = keyFn(key);
  const name = Object.keys(obj).find((n) => keyFn(n) === k);
  return name ? [name, obj[name]] : [null, null];
};
const findModel = (key) => findIn(catalog.get(), key, modelKey);

// Removes inactive models/variants/colours when ?active=true
function activeOnly(model) {
  const variants = {};
  for (const [vName, v] of Object.entries(model.variants)) {
    if (!v.active) continue;
    const colors = Object.fromEntries(Object.entries(v.colors).filter(([, c]) => c.active));
    variants[vName] = { ...v, colors };
  }
  return { ...model, variants };
}

// Resolves the most specific image available for model / variant / colour
function resolveImage({ model, variant, color }) {
  const [modelName, m] = findModel(model);
  if (!m) return null;
  const result = { model: modelName, variant: null, color: null, image: m.image, matched: "model" };
  if (!variant) return result;
  const [variantName, v] = findIn(m.variants, variant);
  if (!v) return result;
  Object.assign(result, { variant: variantName, image: v.image, matched: "variant" });
  if (!color) return result;
  const [colorName, c] = findIn(v.colors, color);
  if (!c) return result;
  return Object.assign(result, { color: colorName, image: c.image, matched: "color" });
}

app.get("/", (req, res) => {
  res.json({
    name: "Vehicle Images API",
    models: Object.keys(catalog.get()).length,
    dataSource: catalog.source(),
    endpoints: {
      "GET /api/models": "Full catalogue: model -> variants -> colours, each with an image. ?active=true hides inactive entries",
      "GET /api/models/:model": "One model with its variants and colours",
      "GET /api/models/:model/variants/:variant": "One variant with its colours",
      "GET /api/image?model=&variant=&color=": "Best image for the given model/variant/colour (variant and color optional)",
      "GET /api/image/redirect?model=&variant=&color=": "Same lookup, redirects to the image — use directly in <img src>",
    },
  });
});

app.get("/health", (req, res) => res.send("ok"));

app.get("/api/models", (req, res) => {
  if (req.query.active !== "true") return res.json(catalog.get());
  const filtered = {};
  for (const [name, m] of Object.entries(catalog.get())) if (m.active) filtered[name] = activeOnly(m);
  res.json(filtered);
});

app.get("/api/models/:model", (req, res) => {
  const [name, m] = findModel(req.params.model);
  if (!m) return res.status(404).json({ error: "Model not found" });
  res.json({ name, ...(req.query.active === "true" ? activeOnly(m) : m) });
});

app.get("/api/models/:model/variants/:variant", (req, res) => {
  const [modelName, m] = findModel(req.params.model);
  if (!m) return res.status(404).json({ error: "Model not found" });
  const [name, v] = findIn(m.variants, req.params.variant);
  if (!v) return res.status(404).json({ error: "Variant not found" });
  res.json({ model: modelName, name, ...v });
});

app.get("/api/image", (req, res) => {
  if (!req.query.model) return res.status(400).json({ error: "Query parameter 'model' is required" });
  const result = resolveImage(req.query);
  if (!result) return res.status(404).json({ error: "Model not found" });
  res.json(result);
});

app.get("/api/image/redirect", (req, res) => {
  const result = req.query.model && resolveImage(req.query);
  if (!result || !result.image) return res.status(404).json({ error: "Image not found" });
  res.set("Cache-Control", "public, max-age=86400");
  res.redirect(302, result.image);
});

app.use((req, res) => res.status(404).json({ error: "Route not found" }));

catalog.start();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Vehicle Images API running on port ${PORT}`));
