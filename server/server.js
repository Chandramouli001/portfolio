require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const { models, Profile, IMAGE_COLLECTIONS } = require("./models");
const { uploadBuffer, destroy } = require("./cloudinary");
const { ensureDefaults } = require("./defaults");

// Environment validation
["MONGODB_URI", "JWT_SECRET", "ADMIN_PASSWORD"].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing ${key} in environment variables`);
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
const allowedOrigins = [
  "https://chandramouli001.vercel.app",
  ...(process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
];

const isDev = process.env.NODE_ENV !== "production";

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (isDev &&
          /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
      ) {
        return callback(null, true);
      }

      console.warn(`CORS blocked origin: ${origin}`);
      return callback(null, false);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: "1mb" }));

// Multer configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (/^image\//.test(file.mimetype)) {
      return callback(null, true);
    }

    callback(new Error("Only image files are allowed."));
  },
});

// Shared helpers
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const auth = (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({
      error: "Session expired or invalid. Please log in again",
    });
  }
};

const getModel = (req, res, next) => {
  const Model = models[req.params.col];

  if (!Model) {
    return res.status(404).json({ error: "Unknown collection" });
  }

  req.Model = Model;
  req.isImg = IMAGE_COLLECTIONS.includes(req.params.col);

  next();
};

const clean = (body) => {
  const result = { ...body };

  ["_id", "__v", "createdAt", "updatedAt", "publicId"].forEach(
    (key) => delete result[key]
  );

  return result;
};

const sorted = (Model) =>
  Model.find().sort({ order: 1, createdAt: -1 }).lean();

// Health check
app.get("/api/health", (req, res) => {
  res.set("Cache-Control", "no-store");

  res.json({
    ok: true,
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
  });
});

// Admin login
app.post("/api/auth/login", (req, res) => {
  const password = String(req.body?.password || "");

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password" });
  }

  const token = jwt.sign(
    { admin: true },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({ token });
});

// Complete portfolio
app.get(
  "/api/portfolio",
  wrap(async (req, res) => {
    const keys = Object.keys(models);

    const [profile, ...results] = await Promise.all([
      Profile.findOne().lean(),
      ...keys.map((key) => sorted(models[key])),
    ]);

    res.set("Cache-Control", "no-store");

    res.json({
      profile,
      ...Object.fromEntries(
        keys.map((key, index) => [key, results[index]])
      ),
    });
  })
);

// Profile routes
const PROFILE_FIELDS = [
  "name",
  "initials",
  "title",
  "subtitle",
  "location",
  "about",
  "stats",
];

app.get(
  "/api/profile",
  wrap(async (req, res) => {
    res.json(await Profile.findOne().lean());
  })
);

app.put(
  "/api/profile",
  auth,
  wrap(async (req, res) => {
    const update = {};

    PROFILE_FIELDS.forEach((key) => {
      if (req.body[key] !== undefined) {
        update[key] = req.body[key];
      }
    });

    const profile = await Profile.findOneAndUpdate({}, update, {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }).lean();

    res.json(profile);
  })
);

app.post(
  "/api/profile/photo",
  auth,
  upload.single("image"),
  wrap(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Upload an image under 8 MB",
      });
    }

    const profile = (await Profile.findOne()) || new Profile();

    const result = await uploadBuffer(
      req.file.buffer,
      "portfolio/profile"
    );

    const previousPublicId = profile.photoPublicId;

    profile.photo = result.secure_url;
    profile.photoPublicId = result.public_id;

    await profile.save();

    if (previousPublicId) {
      try {
        await destroy(previousPublicId);
      } catch (error) {
        console.error("Previous photo cleanup failed:", error.message);
      }
    }

    res.json(profile);
  })
);

// Generic collection routes
app.get(
  "/api/:col",
  getModel,
  wrap(async (req, res) => {
    res.json(await sorted(req.Model));
  })
);

app.post(
  "/api/:col",
  auth,
  getModel,
  upload.single("image"),
  wrap(async (req, res) => {
    const body = clean(req.body);

    if (req.isImg && req.file) {
      const result = await uploadBuffer(
        req.file.buffer,
        `portfolio/${req.params.col}`
      );

      body.src = result.secure_url;
      body.publicId = result.public_id;
    }

    res.status(201).json(await req.Model.create(body));
  })
);

app.put(
  "/api/:col/:id",
  auth,
  getModel,
  upload.single("image"),
  wrap(async (req, res) => {
    const document = await req.Model.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: "Not found" });
    }

    const body = clean(req.body);
    let previousPublicId = null;

    if (req.isImg && req.file) {
      const result = await uploadBuffer(
        req.file.buffer,
        `portfolio/${req.params.col}`
      );

      previousPublicId = document.publicId;
      body.src = result.secure_url;
      body.publicId = result.public_id;
    }

    document.set(body);
    const saved = await document.save();

    if (previousPublicId) {
      try {
        await destroy(previousPublicId);
      } catch (error) {
        console.error("Previous image cleanup failed:", error.message);
      }
    }

    res.json(saved);
  })
);

app.delete(
  "/api/:col/:id",
  auth,
  getModel,
  wrap(async (req, res) => {
    const document = await req.Model.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ error: "Not found" });
    }

    if (document.publicId) {
      try {
        await destroy(document.publicId);
      } catch (error) {
        console.error("Image cleanup failed:", error.message);
      }
    }

    await document.deleteOne();
    res.json({ ok: true });
  })
);

// Not-found handler
app.use((req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("API error:", err);

  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      error:
        err.code === "LIMIT_FILE_SIZE"
          ? "Image exceeds the 8 MB limit"
          : err.message,
    });
  }

  if (
    err.name === "ValidationError" ||
    err.name === "CastError" ||
    err.message === "Only image files are allowed."
  ) {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: "Internal server error" });
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI)
  .then(async () => {
    await ensureDefaults();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`API server listening on port ${PORT}`);
      console.log("Allowed frontend origins:", allowedOrigins);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
