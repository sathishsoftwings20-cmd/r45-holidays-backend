const multer = require("multer");
const path = require("path");
const fs = require("fs");

// helper to create folder if not exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Multer configuration
const destinationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const raw = req.body.slug || req.body.name || "temp";
    const slug = raw
      .toString()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/--+/g, "-");

    let basePath = `uploads/destinations/${slug}`;
    basePath =
      file.fieldname === "coverImage"
        ? `${basePath}/cover`
        : `${basePath}/gallery`;
    ensureDir(basePath);
    cb(null, basePath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files allowed"), false);
  }
  cb(null, true);
};

exports.destinationUpload = multer({
  storage: destinationStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.galleryUpload = exports.destinationUpload;
