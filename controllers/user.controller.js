// backend/controllers/user.controller.js
const bcrypt = require("bcryptjs");
const User = require("../models/user.model");
const path = require("path");
const fs = require("fs");

// Helper — remove sensitive fields
const safeUserResponse = (userDoc) => {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete user.password;
  return user;
};

// Get all users
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");
    return res.json(users);
  } catch (error) {
    return next(error);
  }
};

// Get user by ID
exports.getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select("-password").lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

// Create User
exports.createUser = async (req, res, next) => {
  try {
    const { fullName, email, password, role, status } = req.body;

    const user = new User({
      fullName,
      email,
      password,
      role: role || "User",
      status: status || "active",
    });

    await user.save();
    res.status(201).json({
      message: "User created successfully",
      user: safeUserResponse(user),
    });
  } catch (err) {
    console.error("Create user error:", err);
    next(err);
  }
};

// Update user by ID
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const requesterId = requester.id?.toString();
    const targetId = id.toString();

    // Permission check
    if (
      requesterId !== targetId &&
      !["Admin", "SuperAdmin"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Prevent role escalation
    if (req.body.role === "SuperAdmin" && requester.role !== "SuperAdmin") {
      return res.status(403).json({
        message: "Only SuperAdmin can assign SuperAdmin role",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Email uniqueness check
    if (req.body.email && req.body.email !== user.email) {
      const conflict = await User.findOne({ email: req.body.email });
      if (conflict) {
        return res.status(400).json({ message: "Email already in use" });
      }
    }

    // ✅ Allowed updates
    if (req.body.fullName !== undefined) user.fullName = req.body.fullName;
    if (req.body.email !== undefined) user.email = req.body.email;
    if (req.body.role !== undefined) user.role = req.body.role;
    if (req.body.status !== undefined) user.status = req.body.status;

    // Password update (hashed by model)
    if (req.body.password?.trim()) {
      user.password = req.body.password;
    }

    await user.save();

    return res.json({
      message: "User updated successfully",
      user: safeUserResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Duplicate field value",
      });
    }

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }

    return next(error);
  }
};

// ---------------------- Soft Delete User ----------------------
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user || user.status === "deleted") {
      return res.status(404).json({ message: "User not found" });
    }

    // Soft delete by setting status to "deleted"
    user.status = "deleted";
    user.updatedBy = req.user.id;

    await user.save();

    return res.json({ message: "User moved to deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.uploadProfileImage = async (req, res) => {
  const user = req.dbUser; // already fetched

  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded" });
  }

  if (user.profileImage) {
    const oldPath = path.join(__dirname, "..", user.profileImage);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  user.profileImage = `/uploads/user/${user.userId}/${req.file.filename}`;
  await user.save();

  res.json({
    message: "Profile image updated successfully",
    profileImage: user.profileImage,
  });
};

exports.uploadUserProfileImageByAdmin = async (req, res) => {
  try {
    const { id } = req.params; // target user id

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // delete old image
    if (user.profileImage) {
      const oldPath = path.join(__dirname, "..", user.profileImage);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    user.profileImage = `/uploads/user/${user.userId}/${req.file.filename}`;
    await user.save();

    res.json({
      message: "User profile image updated by admin",
      profileImage: user.profileImage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
