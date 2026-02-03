// backend/middleware/auth/resolveUploadUser.middleware.js
const User = require("../../../models/user.model");

exports.resolveSelfUser = async (req, res, next) => {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    req.dbUser = user; // 👈 used by multer
    next();
};

exports.resolveTargetUser = async (req, res, next) => {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Target user not found" });

    req.targetUser = user; // 👈 used by multer
    next();
};
