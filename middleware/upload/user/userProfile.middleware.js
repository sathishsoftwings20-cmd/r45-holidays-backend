// backend/middleware/upload/userProfile.middleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // must be attached BEFORE multer runs
        const userId =
            req.targetUser?.userId || req.dbUser?.userId;

        if (!userId) {
            return cb(new Error("UserId not resolved for upload"));
        }

        const uploadPath = path.join("uploads", "user", userId);
        fs.mkdirSync(uploadPath, { recursive: true });

        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `profile_${Date.now()}${ext}`);
    },
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files allowed"), false);
    }
    cb(null, true);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 },
});
