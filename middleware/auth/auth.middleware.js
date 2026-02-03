// backend/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const User = require("../../models/user.model");
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token)
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = {
      id: user._id.toString(),
      userId: user.userId,
      role: user.role,
      email: user.email,
      userName: user.userName,
      fullName: user.fullName,
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "JsonWebTokenError")
      return res.status(401).json({ message: "Token is not valid" });
    if (error.name === "TokenExpiredError")
      return res.status(401).json({ message: "Token has expired" });
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = authMiddleware;
