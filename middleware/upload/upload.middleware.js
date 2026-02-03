const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Helper to ensure directory exists
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const destinationStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      // Determine destination slug from request
      let slug = "temp";

      if (req.body.slug) {
        slug = req.body.slug;
      } else if (req.body.name) {
        // Generate slug from name if creating new destination
        slug = req.body.name
          .toLowerCase()
          .replace(/[^\w\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/--+/g, "-");
      } else if (req.params.id) {
        // For updates, get slug from existing destination
        // We'll handle this in the controller, but for now use ID
        slug = req.params.id;
      }

      // Determine folder based on field name
      let baseFolder = `uploads/destinations/${slug}`;

      if (file.fieldname === "coverImage") {
        baseFolder = path.join(baseFolder, "cover");
      } else if (file.fieldname === "gallery") {
        baseFolder = path.join(baseFolder, "gallery");
      }

      // Create folder if it doesn't exist
      ensureDir(baseFolder);

      cb(null, baseFolder);
    } catch (error) {
      cb(error);
    }
  },

  filename: (req, file, cb) => {
    // Generate unique filename
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images are allowed."), false);
  }
};

// Multer instances
const destinationUpload = multer({
  storage: destinationStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1, // Single file for cover
  },
});

const galleryUpload = multer({
  storage: destinationStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files for gallery
  },
});

// Export middleware instances
exports.destinationUpload = destinationUpload.single("coverImage");
exports.galleryUpload = galleryUpload.array("gallery", 10);
exports.anyImageUpload = multer({
  storage: destinationStorage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).any();
