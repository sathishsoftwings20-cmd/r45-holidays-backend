const jwt = require("jsonwebtoken");
const User = require("../../models/user.model");

module.exports = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) return res.status(401).json({ message: "User not found" });

    req.user = {
      id: user._id.toString(),
      userId: user.userId,
      role: user.role,
      email: user.email,
      fullName: user.fullName,
    };

    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid or expired token" });
  }
};
