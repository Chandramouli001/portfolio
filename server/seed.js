// One-time import: JSON files -> MongoDB, local images -> Cloudinary.
// Re-running wipes each collection and re-imports (it re-uploads local images too).
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { models, IMAGE_COLLECTIONS } = require("./models");
const { cloudinary } = require("./cloudinary");

const DATA_DIR = path.resolve(__dirname, process.env.DATA_DIR || "../src/data");
const PUBLIC_DIR = path.resolve(__dirname, process.env.PUBLIC_DIR || "../public");

const FILES = {
  publications: "publications.json",
  experience: "experience.json",
  education: "education.json",
  awards: "achievements.json",
  certificates: "certificates.json",
  gallery: "gallery.json",
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const [col, file] of Object.entries(FILES)) {
    const fp = path.join(DATA_DIR, file);
    if (!fs.existsSync(fp)) { console.warn(`skip ${col}: ${fp} not found`); continue; }
    const items = JSON.parse(fs.readFileSync(fp, "utf8"));
    const docs = [];

    for (let i = 0; i < items.length; i++) {
      const doc = { ...items[i], order: i };

      if (IMAGE_COLLECTIONS.includes(col)) {
        const raw = doc.src || doc.image || "";
        delete doc.image;
        if (col === "gallery" && !doc.caption) doc.caption = doc.description || doc.issuer || "";
        doc.src = raw;

        if (raw && !/^https?:\/\//.test(raw)) {
          const local = path.join(PUBLIC_DIR, raw.replace(/^\//, ""));
          if (fs.existsSync(local)) {
            const r = await cloudinary.uploader.upload(local, { folder: `portfolio/${col}` });
            doc.src = r.secure_url;
            doc.publicId = r.public_id;
            console.log(`uploaded ${raw}`);
          } else {
            console.warn(`image not found locally, keeping path: ${raw}`);
          }
        }
      }
      docs.push(doc);
    }

    await models[col].deleteMany({});
    await models[col].insertMany(docs);
    console.log(`${col}: ${docs.length} imported`);
  }

  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
