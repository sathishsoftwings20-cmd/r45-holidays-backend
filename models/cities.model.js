const mongoose = require("mongoose");
const Counter = require("./counter.model");
const generateUniqueSlug = require("../utils/slugifyUnique");

// Subdocument schema for tour packages
const PackageSchema = new mongoose.Schema({
  days: { type: Number, required: true, min: 1, max: 14 },
  price: { type: Number, required: true, min: 0 },
});

// Subdocument schema for gallery images
const GalleryImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String, trim: true },
});

const CitiesSchema = new mongoose.Schema({
  cityId: { type: String, unique: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  slug: { type: String, unique: true, index: true },
  coverImage: { type: String, default: "/uploads/defaults/default-cities.png" },
  badge: {
    type: String,
    enum: ["Affordable", "Pricey"],
    default: "Affordable",
  },
  shortDescription: { type: String, trim: true },
  status: {
    type: String,
    enum: ["draft", "published", "deleted"],
    default: "draft",
    index: true,
  },
  publishedAt: { type: Date },
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Destination",
    required: true,
    index: true,
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // Packages array
  packages: {
    type: [PackageSchema],
    default: [],
  },

  // Gallery array
  gallery: [GalleryImageSchema],
});

CitiesSchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    // Generate cityId only once
    if (!this.cityId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "cityId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.cityId = `CITY${String(counter.seq).padStart(4, "0")}`;
    }

    // ✅ UNIQUE SLUG (same logic as Destination & Activity)
    if (this.isModified("name")) {
      this.slug = await generateUniqueSlug({
        modelName: "Cities",
        value: this.name,
        excludeId: this._id,
      });
    }

    // Set published date
    if (this.isModified("status") && this.status === "published") {
      this.publishedAt = new Date();
    }

    next();
  } catch (err) {
    next(err);
  }
});

CitiesSchema.index({ destination: 1, status: 1 });

module.exports = mongoose.model("Cities", CitiesSchema);
