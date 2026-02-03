const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const cityId = req.dbCities?.cityId;
        if (!cityId) return cb(new Error("cityId not found"));

        const uploadPath = path.join("uploads", "cities", cityId, "gallery");
        fs.mkdirSync(uploadPath, { recursive: true });

        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `gallery_${Date.now()}_${Math.random()}${ext}`);
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
