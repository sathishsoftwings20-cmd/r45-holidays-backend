const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // bookingId is now available from resolveBooking middleware
    const bookingId = req.dbBooking?.bookingId;
    if (!bookingId) {
      return cb(new Error("Booking ID not resolved"));
    }

    // Build path relative to project root: uploads/bookings/BKGxxxx/documents
    const dest = path.join(
      process.cwd(),
      "uploads",
      "bookings",
      bookingId,
      "documents",
    );
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter – allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const mime = allowedTypes.test(file.mimetype);
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  if (mime && ext) return cb(null, true);
  cb(new Error("Only .jpg, .jpeg, .png, .pdf files are allowed"));
};

// Multer instance – single file upload with field name "document"
const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single("document");

module.exports = { uploadDocument };
