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
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔹 Only Admin & SuperAdmin can view all users
    if (!["Admin", "SuperAdmin"].includes(requester.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const users = await User.find().select("-password");

    return res.json({
      count: users.length,
      users,
    });
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
    const { fullName, email, password, phone, role, status } = req.body;

    // Required field validations
    if (!fullName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }
    if (!/^\+\d{10,15}$/.test(phone)) {
      return res.status(400).json({ message: "Invalid phone number format" });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "Invalid email format",
      });
    }

    // Password length validation
    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        message: "Email already registered",
      });
    }
    // Check if Phone already exists
    const existingPhoneUser = await User.findOne({ phone });
    if (existingPhoneUser) {
      return res.status(409).json({
        message: "Phone number already registered",
      });
    }

    const user = new User({
      fullName,
      email,
      password,
      phone,
      role: role || "User",
      status: status || "active",
    });

    // If an admin (or any authenticated user) is creating this user, record who created it
    if (req.user && req.user.id) {
      user.createdBy = req.user.id;
      user.updatedBy = req.user.id; // initially same as createdBy
    }

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

    // 🔹 Permission check
    if (
      requesterId !== targetId &&
      !["Admin", "SuperAdmin"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 🔹 Prevent role escalation
    if (req.body.role === "SuperAdmin" && requester.role !== "SuperAdmin") {
      return res.status(403).json({
        message: "Only SuperAdmin can assign SuperAdmin role",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { fullName, email, phone, password, role, status } = req.body;

    // =========================
    // 🔹 Field-wise validations
    // =========================

    if (fullName !== undefined && !fullName.trim()) {
      return res.status(400).json({ message: "Full name cannot be empty" });
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({ message: "Email cannot be empty" });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Email uniqueness
      if (email !== user.email) {
        const conflict = await User.findOne({ email });
        if (conflict) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        return res
          .status(400)
          .json({ message: "Phone number cannot be empty" });
      }

      if (!/^\+\d{10,15}$/.test(phone)) {
        return res.status(400).json({ message: "Invalid phone number format" });
      }

      // Phone uniqueness
      if (phone !== user.phone) {
        const conflict = await User.findOne({ phone });
        if (conflict) {
          return res
            .status(400)
            .json({ message: "Phone number already in use" });
        }
      }
    }

    if (password !== undefined) {
      if (!password.trim()) {
        return res.status(400).json({ message: "Password cannot be empty" });
      }

      if (password.length < 6) {
        return res.status(400).json({
          message: "Password must be at least 6 characters long",
        });
      }
    }

    if (role !== undefined) {
      const allowedRoles = ["User", "Admin", "SuperAdmin"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role value" });
      }
    }

    if (status !== undefined) {
      const allowedStatus = ["active", "inactive", "blocked"];
      if (!allowedStatus.includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
    }

    // =========================
    // ✅ Apply allowed updates
    // =========================
    if (fullName !== undefined) user.fullName = fullName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (role !== undefined) user.role = role;
    if (status !== undefined) user.status = status;

    // Password update (hashed in model)
    if (password?.trim()) {
      user.password = password;
    }

    // Record who performed the update
    user.updatedBy = requester.id;

    await user.save();

    return res.json({
      message: "User updated successfully",
      user: safeUserResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Duplicate field value" });
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
    const requester = req.user;
    const { id } = req.params;

    // 🔹 Auth check
    if (!requester) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // 🔹 Only Admin & SuperAdmin can delete users
    if (!["Admin", "SuperAdmin"].includes(requester.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 🔹 Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // 🔹 Prevent self-delete
    if (requester.id === id) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    const user = await User.findById(id);

    if (!user || user.status === "deleted") {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔹 Prevent deleting SuperAdmin
    if (user.role === "SuperAdmin" && requester.role !== "SuperAdmin") {
      return res.status(403).json({
        message: "Only SuperAdmin can delete a SuperAdmin",
      });
    }

    // 🔹 Soft delete
    user.status = "deleted";
    user.updatedBy = requester.id;

    await user.save();

    return res.json({
      message: "User moved to deleted successfully",
    });
  } catch (err) {
    return next(err);
  }
};

// ---------------------- Upload Profile Image ----------------------
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

// ---------------------- Admin Upload User Profile Image ----------------------
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
