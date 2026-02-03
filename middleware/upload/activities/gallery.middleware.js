// backend/middleware/upload/activities/gallery.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const activityId = req.dbActivity?.activityId;
    if (!activityId) return cb(new Error("activityId not resolved for upload"));

    const uploadPath = path.join(
      "uploads",
      "activities",
      activityId,
      "gallery",
    );
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `gallery_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/"))
    return cb(new Error("Only images allowed"), false);
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
});
