// backend/controllers/auth.controller.js
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

// Generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      role: user.role,
      email: user.email,
      userName: user.userName,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    },
  );
};

// ---------------- Login ----------------
exports.login = async (req, res) => {
  try {
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ message: "Login and password required" });
    }

    const user = await User.findOne({
      $or: [{ email: login }, { userName: login }],
    });

    if (!user) {
      return res.status(400).json({ message: "User not registered" });
    }

    // ⛔ BLOCK inactive & deleted users
    if (user.status !== "active") {
      return res.status(403).json({
        message:
          user.status === "inactive"
            ? "Your account is inactive. Please contact admin."
            : "Your account has been deleted.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Password incorrect" });
    }

    const token = generateToken(user);

    res.json({
      token,
      user: {
        _id: user._id,
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        userName: user.userName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Server error" });
  }
};
