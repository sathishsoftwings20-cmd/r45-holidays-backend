const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Base upload directory
const uploadDir = path.join("uploads", "bookings", "travelers");

// Ensure base directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { id, travelerIndex } = req.params;

    if (!id || travelerIndex === undefined) {
      return cb(new Error("Booking ID and traveler index are required"));
    }

    const destination = path.join(uploadDir, id, travelerIndex.toString());

    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    cb(null, destination);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG, and PDF files are allowed"));
  }
};

// Multer middleware
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
}).fields([
  { name: "passportFront", maxCount: 1 },
  { name: "passportBack", maxCount: 1 },
  { name: "panCard", maxCount: 1 },
]);

module.exports = upload;
