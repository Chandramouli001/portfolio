const mongoose = require("mongoose");

const make = (name, fields) =>
  mongoose.model(
    name,
    new mongoose.Schema({ order: { type: Number, default: 0 }, ...fields }, { timestamps: true })
  );

const models = {
  publications: make("Publication", {
    title: { type: String, required: true },
    type: String, description: String, year: String, doi: String, url: String,
  }),
  experience: make("Experience", {
    role: { type: String, required: true },
    organization: String, year: String, desc: String,
  }),
  education: make("Education", {
    degree: { type: String, required: true },
    institution: String, year: String,
  }),
  awards: make("Award", {
    title: { type: String, required: true },
    description: String, src: String, publicId: String,
  }),
  certificates: make("Certificate", {
    title: { type: String, required: true },
    issuer: String, src: String, publicId: String,
  }),
  gallery: make("GalleryItem", {
    title: String, caption: String, src: String, publicId: String,
  }),
  interests: make("Interest", {
    label: { type: String, required: true },
    icon: String,
  }),
  links: make("Link", {
    label: { type: String, required: true },
    url: { type: String, required: true },
    icon: String,
    style: String, // "", "li", "orcid", "rg"  (CSS class suffix)
  }),
};

// Single document: name, about text, sidebar stats, photo...
const Profile = mongoose.model(
  "Profile",
  new mongoose.Schema(
    {
      name: String, initials: String, title: String, subtitle: String, location: String,
      about: [String],
      stats: [new mongoose.Schema({ value: String, label: String }, { _id: false })],
      photo: String, photoPublicId: String,
    },
    { timestamps: true }
  )
);

const IMAGE_COLLECTIONS = ["awards", "certificates", "gallery"];

module.exports = { models, Profile, IMAGE_COLLECTIONS };