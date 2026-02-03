const mongoose = require("mongoose");
const Counter = require("./counter.model");
const generateUniqueSlug = require("../utils/slugifyUnique");

const GalleryImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String, trim: true },
});

const ActivitySchema = new mongoose.Schema({
  activityId: { type: String, unique: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, unique: true, index: true },
  startTime: { type: String, trim: true },
  duration: { type: String, trim: true },
  description: { type: String, trim: true },
  inclusion: {
    type: [String],
    default: [],
    trim: true,
  },

  exclusion: {
    type: [String],
    default: [],
    trim: true,
  },
  price: { type: Number, default: 0 },

  badge: {
    type: String,
    enum: ["Half Day", "Full Day", "Overnight", "Qurate Day"],
    default: "Qurate Day",
  },
  coverImage: {
    type: String,
    default: "/uploads/defaults/default-activity.png",
  },
  gallery: { type: [GalleryImageSchema], default: [] },
  status: {
    type: String,
    enum: ["draft", "published", "deleted"],
    default: "draft",
    index: true,
  },
  publishedAt: { type: Date },
  city: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cities",
    required: true,
    index: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// pre-save: lazy require Counter inside the hook
ActivitySchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    if (!this.activityId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "activityId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.activityId = `ACT${String(counter.seq).padStart(4, "0")}`;
    }

    if (this.isModified("name")) {
      this.slug = await generateUniqueSlug({
        modelName: "Activity",
        value: this.name,
        excludeId: this._id,
      });
    }

    if (this.isModified("status") && this.status === "published") {
      this.publishedAt = new Date();
    }

    next();
  } catch (err) {
    next(err);
  }
});

ActivitySchema.index({ city: 1, status: 1 });

module.exports = mongoose.model("Activity", ActivitySchema);
