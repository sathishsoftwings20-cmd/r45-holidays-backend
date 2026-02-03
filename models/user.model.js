// backend/models/user.model.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Counter = require("./counter.model");

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    index: true,
  },
  fullName: { type: String, required: true, trim: true },
  email: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    lowercase: true,
    match: [/.+@.+\..+/, "Please fill a valid email address"],
  },
  userName: {
    type: String,
    unique: true,
    required: true,
    trim: true,
    minlength: 3,
  },
  password: { type: String, required: true, minlength: 6 },
  role: {
    type: String,
    enum: ["SuperAdmin", "Admin", "Staff", "User"],
    default: "User",
  },
  profileImage: {
    type: String,
    default: "/uploads/defaults/profile-image.wepb",
  },
  status: {
    type: String,
    enum: ["active", "inactive", "deleted"],
    default: "active",
    index: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: String, trim: true },
  updatedBy: { type: String, trim: true },
});

userSchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    // Generate userId only once
    if (!this.userId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "userId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );

      this.userId = `USR${String(counter.seq).padStart(4, "0")}`;
    }

    // Hash password only when modified
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
