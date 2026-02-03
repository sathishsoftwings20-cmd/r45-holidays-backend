// backend/middleware/upload/activities/coverImage.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const activityId = req.dbActivity?.activityId;
    if (!activityId) return cb(new Error("activityId not resolved for upload"));

    const uploadPath = path.join("uploads", "activities", activityId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `cover_${Date.now()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/"))
    return cb(new Error("Only image files allowed"), false);
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
