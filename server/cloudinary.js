const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder, resource_type: "image" }, (err, r) => (err ? reject(err) : resolve(r)))
      .end(buffer);
  });

const destroy = (publicId) =>
  publicId ? cloudinary.uploader.destroy(publicId).catch(() => {}) : Promise.resolve();

module.exports = { cloudinary, uploadBuffer, destroy };
