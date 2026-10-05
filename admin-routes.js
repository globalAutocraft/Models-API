// Write API for trusted server-side callers (e.g. the Sales Apps Script), protected by the
// ADMIN_API_SECRET env var sent in the "x-admin-secret" header. Writes go straight to Firestore
// with the service account, so the public read API picks them up within seconds.
//
// Every write runs in a transaction on the raw model document (no image fallbacks applied),
// and replaces the whole document. That keeps names containing "." or "/" (e.g. "T.GREY")
// safe, and two edits to the same model can't overwrite each other.
const crypto = require("crypto");
const express = require("express");
const { connect, COLLECTION, docId } = require("./firebase");

const normalise = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const modelKey = (s) => normalise(s).replace(/^tvs/, "");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

// ---------- input checks ----------
function cleanName(v, required) {
  if (v === undefined && !required) return undefined;
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new HttpError(400, "name is required");
  if (s.length > 100) throw new HttpError(400, "name must be 100 characters or less");
  return s;
}
function cleanImage(v) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return "";
  if (typeof v !== "string" || !/^https?:\/\/\S+$/i.test(v.trim())) {
    throw new HttpError(400, "image must be an http(s) URL or empty");
  }
  return v.trim();
}
function cleanActive(v) {
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new HttpError(400, "active must be true or false");
  return v;
}
function cleanOrder(v) {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < 0) throw new HttpError(400, "order must be a whole number, 0 or more");
  return v;
}

// Finds a key in a map by normalised name; returns the exact stored key or null.
const findKey = (obj, name, keyFn = normalise) => Object.keys(obj || {}).find((k) => keyFn(k) === keyFn(name)) || null;

const shape = (id, data) => ({ id, ...data });

function createRouter() {
  const router = express.Router();
  router.use(express.json({ limit: "100kb" }));

  router.use((req, res, next) => {
    const secret = process.env.ADMIN_API_SECRET || "";
    if (!secret) return res.status(503).json({ error: "Admin API not configured: ADMIN_API_SECRET is not set" });
    if (!safeEqual(req.get("x-admin-secret") || "", secret)) return res.status(401).json({ error: "Unauthorized" });
    next();
  });

  const db = () => {
    const d = connect();
    if (!d) throw new HttpError(503, "Database not configured: FIREBASE_SERVICE_ACCOUNT is not set");
    return d;
  };
  const col = () => db().collection(COLLECTION);

  // Model document matching a name (case/punctuation-insensitive, "TVS" optional) or its id.
  async function findModelDoc(nameOrId, tx) {
    const snap = tx ? await tx.get(col()) : await col().get();
    const hit = snap.docs.find((d) => d.id === nameOrId || modelKey(d.data().name) === modelKey(nameOrId));
    if (!hit) throw new HttpError(404, "Model not found");
    return hit;
  }

  // Runs fn(data) on a model inside a transaction and saves the result.
  async function editModel(modelName, fn) {
    return db().runTransaction(async (tx) => {
      const doc = await findModelDoc(modelName, tx);
      const data = { variants: {}, ...doc.data() };
      fn(data);
      tx.set(doc.ref, data);
      return shape(doc.id, data);
    });
  }
  function getVariantKey(data, name) {
    const key = findKey(data.variants, name);
    if (!key) throw new HttpError(404, "Variant not found");
    return key;
  }
  function getColorKey(variant, name) {
    const key = findKey(variant.colors, name);
    if (!key) throw new HttpError(404, "Colour not found");
    return key;
  }
  // Renames a map key while keeping the original key order.
  function renameKey(obj, oldKey, newKey, value) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k === oldKey ? newKey : k] = k === oldKey ? value : v;
    return out;
  }

  const wrap = (fn) => (req, res) =>
    fn(req, res).catch((err) => {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error("[admin]", err);
      res.status(500).json({ error: "Server error: " + err.message });
    });

  // ---------- read (raw, without image fallbacks, with document ids) ----------
  router.get("/models", wrap(async (req, res) => {
    const snap = await col().get();
    const models = snap.docs
      .map((d) => shape(d.id, { variants: {}, ...d.data() }))
      .sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || String(a.name).localeCompare(String(b.name)));
    res.json({ models });
  }));

  // ---------- models ----------
  router.post("/models", wrap(async (req, res) => {
    const name = cleanName(req.body.name, true);
    const image = cleanImage(req.body.image) ?? "";
    const active = cleanActive(req.body.active) ?? true;
    const result = await db().runTransaction(async (tx) => {
      const snap = await tx.get(col());
      if (snap.docs.some((d) => modelKey(d.data().name) === modelKey(name))) throw new HttpError(409, "A model with this name already exists");
      const ids = new Set(snap.docs.map((d) => d.id));
      const base = docId(name) || "model";
      let id = base;
      for (let n = 2; ids.has(id); n++) id = `${base}-${n}`;
      const order = snap.docs.reduce((m, d) => Math.max(m, d.data().order ?? -1), -1) + 1;
      const data = { name, order, active, image, variants: {} };
      tx.set(col().doc(id), data);
      return shape(id, data);
    });
    res.status(201).json(result);
  }));

  router.patch("/models/:model", wrap(async (req, res) => {
    const name = cleanName(req.body.name, false);
    const image = cleanImage(req.body.image);
    const active = cleanActive(req.body.active);
    const order = cleanOrder(req.body.order);
    const result = await db().runTransaction(async (tx) => {
      const doc = await findModelDoc(req.params.model, tx);
      if (name !== undefined && modelKey(name) !== modelKey(doc.data().name)) {
        const all = await tx.get(col());
        if (all.docs.some((d) => d.id !== doc.id && modelKey(d.data().name) === modelKey(name))) throw new HttpError(409, "A model with this name already exists");
      }
      const data = { variants: {}, ...doc.data() };
      if (name !== undefined) data.name = name;
      if (image !== undefined) data.image = image;
      if (active !== undefined) data.active = active;
      if (order !== undefined) data.order = order;
      tx.set(doc.ref, data);
      return shape(doc.id, data);
    });
    res.json(result);
  }));

  router.delete("/models/:model", wrap(async (req, res) => {
    const doc = await findModelDoc(req.params.model);
    await doc.ref.delete();
    res.json({ deleted: true, id: doc.id, name: doc.data().name });
  }));

  // ---------- variants ----------
  router.post("/models/:model/variants", wrap(async (req, res) => {
    const name = cleanName(req.body.name, true);
    const image = cleanImage(req.body.image) ?? "";
    const active = cleanActive(req.body.active) ?? true;
    const result = await editModel(req.params.model, (data) => {
      if (findKey(data.variants, name)) throw new HttpError(409, "A variant with this name already exists");
      data.variants[name] = { active, image, colors: {} };
    });
    res.status(201).json(result);
  }));

  router.patch("/models/:model/variants/:variant", wrap(async (req, res) => {
    const name = cleanName(req.body.name, false);
    const image = cleanImage(req.body.image);
    const active = cleanActive(req.body.active);
    const result = await editModel(req.params.model, (data) => {
      const key = getVariantKey(data, req.params.variant);
      const v = { colors: {}, ...data.variants[key] };
      if (image !== undefined) v.image = image;
      if (active !== undefined) v.active = active;
      if (name !== undefined && name !== key) {
        const clash = findKey(data.variants, name);
        if (clash && clash !== key) throw new HttpError(409, "A variant with this name already exists");
        data.variants = renameKey(data.variants, key, name, v);
      } else {
        data.variants[key] = v;
      }
    });
    res.json(result);
  }));

  router.delete("/models/:model/variants/:variant", wrap(async (req, res) => {
    const result = await editModel(req.params.model, (data) => {
      delete data.variants[getVariantKey(data, req.params.variant)];
    });
    res.json(result);
  }));

  // ---------- colours ----------
  router.post("/models/:model/variants/:variant/colors", wrap(async (req, res) => {
    const name = cleanName(req.body.name, true);
    const image = cleanImage(req.body.image) ?? "";
    const active = cleanActive(req.body.active) ?? true;
    const result = await editModel(req.params.model, (data) => {
      const v = data.variants[getVariantKey(data, req.params.variant)];
      v.colors = v.colors || {};
      if (findKey(v.colors, name)) throw new HttpError(409, "A colour with this name already exists");
      v.colors[name] = { active, image };
    });
    res.status(201).json(result);
  }));

  router.patch("/models/:model/variants/:variant/colors/:color", wrap(async (req, res) => {
    const name = cleanName(req.body.name, false);
    const image = cleanImage(req.body.image);
    const active = cleanActive(req.body.active);
    const result = await editModel(req.params.model, (data) => {
      const v = data.variants[getVariantKey(data, req.params.variant)];
      v.colors = v.colors || {};
      const key = getColorKey(v, req.params.color);
      const c = { ...v.colors[key] };
      if (image !== undefined) c.image = image;
      if (active !== undefined) c.active = active;
      if (name !== undefined && name !== key) {
        const clash = findKey(v.colors, name);
        if (clash && clash !== key) throw new HttpError(409, "A colour with this name already exists");
        v.colors = renameKey(v.colors, key, name, c);
      } else {
        v.colors[key] = c;
      }
    });
    res.json(result);
  }));

  router.delete("/models/:model/variants/:variant/colors/:color", wrap(async (req, res) => {
    const result = await editModel(req.params.model, (data) => {
      const v = data.variants[getVariantKey(data, req.params.variant)];
      delete v.colors[getColorKey(v, req.params.color)];
    });
    res.json(result);
  }));

  return router;
}

module.exports = { createRouter };
