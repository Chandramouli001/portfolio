require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { models, Profile, IMAGE_COLLECTIONS } = require("./models");
const { uploadBuffer, destroy } = require("./cloudinary");
const { ensureDefaults } = require("./defaults");

["MONGODB_URI", "JWT_SECRET", "ADMIN_PASSWORD"].forEach((k) => {
  if (!process.env[k]) { console.error(`Missing ${k} in server/.env`); process.exit(1); }
});
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET)
  console.warn("WARNING: Cloudinary keys missing in server/.env - image uploads will fail.");

const app = express();

// CORS: listed origins + (when not in production) any localhost port
const allowed = (process.env.CLIENT_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
const isDev = process.env.NODE_ENV !== "production";
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowed.includes(origin) || (isDev && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))
      return cb(null, true);
    console.warn(`CORS blocked origin: ${origin} (add it to CLIENT_ORIGIN)`);
    cb(null, false);
  },
}));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const auth = (req, res, next) => {
  try {
    jwt.verify((req.headers.authorization || "").replace("Bearer ", ""), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired - please log in again" });
  }
};

const getModel = (req, res, next) => {
  const Model = models[req.params.col];
  if (!Model) return res.status(404).json({ error: "Unknown collection" });
  req.Model = Model;
  req.isImg = IMAGE_COLLECTIONS.includes(req.params.col);
  next();
};

const clean = (body) => {
  const b = { ...body };
  ["_id", "__v", "createdAt", "updatedAt", "publicId"].forEach((k) => delete b[k]);
  return b;
};

const sorted = (Model) => Model.find().sort({ order: 1, createdAt: -1 }).lean();

// ── Health + auth ──
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.post("/api/auth/login", (req, res) => {
  const pw = String(req.body.password || "");
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });
  res.json({ token: jwt.sign({ admin: true }, process.env.JWT_SECRET, { expiresIn: "12h" }) });
});

// ── Public: everything in one request (never cached, so edits show immediately) ──
app.get("/api/portfolio", wrap(async (req, res) => {
  const keys = Object.keys(models);
  const [profile, ...results] = await Promise.all([Profile.findOne().lean(), ...keys.map((k) => sorted(models[k]))]);
  res.set("Cache-Control", "no-cache");
  res.json({ profile, ...Object.fromEntries(keys.map((k, i) => [k, results[i]])) });
}));

// ── Profile (single document) ──
const PROFILE_FIELDS = ["name", "initials", "title", "subtitle", "location", "about", "stats"];

app.get("/api/profile", wrap(async (req, res) => res.json(await Profile.findOne().lean())));

app.put("/api/profile", auth, wrap(async (req, res) => {
  const update = {};
  PROFILE_FIELDS.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
  const doc = await Profile.findOneAndUpdate({}, update, {
    upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true,
  }).lean();
  res.json(doc);
}));

app.post("/api/profile/photo", auth, upload.single("image"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image received (must be an image file under 8 MB)" });
  const doc = (await Profile.findOne()) || new Profile();
  await destroy(doc.photoPublicId);
  const r = await uploadBuffer(req.file.buffer, "portfolio/profile");
  doc.photo = r.secure_url;
  doc.photoPublicId = r.public_id;
  res.json(await doc.save());
}));

// ── Generic CRUD for list collections ──
app.get("/api/:col", getModel, wrap(async (req, res) => res.json(await sorted(req.Model))));

app.post("/api/:col", auth, getModel, upload.single("image"), wrap(async (req, res) => {
  const body = clean(req.body);
  if (req.isImg && req.file) {
    const r = await uploadBuffer(req.file.buffer, `portfolio/${req.params.col}`);
    body.src = r.secure_url;
    body.publicId = r.public_id;
  }
  res.status(201).json(await req.Model.create(body));
}));

app.put("/api/:col/:id", auth, getModel, upload.single("image"), wrap(async (req, res) => {
  const doc = await req.Model.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  const body = clean(req.body);
  if (req.isImg && req.file) {
    await destroy(doc.publicId);
    const r = await uploadBuffer(req.file.buffer, `portfolio/${req.params.col}`);
    body.src = r.secure_url;
    body.publicId = r.public_id;
  }
  doc.set(body);
  res.json(await doc.save());
}));

app.delete("/api/:col/:id", auth, getModel, wrap(async (req, res) => {
  const doc = await req.Model.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: "Not found" });
  await destroy(doc.publicId);
  await doc.deleteOne();
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.name === "ValidationError" ? 400 : 500).json({ error: err.message });
});

mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    await ensureDefaults();
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`API running on http://localhost:${port}`));
  })
  .catch((e) => { console.error("Mongo connection failed:", e.message); process.exit(1); });