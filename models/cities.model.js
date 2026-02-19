const mongoose = require("mongoose");
const Counter = require("./counter.model");
const generateUniqueSlug = require("../utils/slugifyUnique");

const GalleryImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  caption: { type: String, trim: true },
});

// Transfer Schema – INR only
const TransferSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: [
      "Airport Pickup",
      "Airport Drop",
      "Intercity Transfer",
      "Local Transport",
    ],
    required: true,
  },
  vehicleType: {
    type: String,
    enum: ["Sedan", "SUV", "Tempo Traveller", "Bus", "Private Cab"],
    default: "Sedan",
  },
  price: { type: Number, default: 0 }, // INR only
});

// Package Field Schema – INR only
const PackageFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    minDays: { type: Number, required: true, min: 1, max: 14 },
    maxDays: { type: Number, required: true, min: 1, max: 14 },
    price: { type: Number, default: 0, min: 0 }, // INR only
  },
  { _id: false }
);

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

  // Four package fields (INR only)
  package_7_8_Days: {
    type: PackageFieldSchema,
    default: {
      label: "7-8 Days",
      minDays: 7,
      maxDays: 8,
      price: 0,
    },
  },
  package_9_10_Days: {
    type: PackageFieldSchema,
    default: {
      label: "9-10 Days",
      minDays: 9,
      maxDays: 10,
      price: 0,
    },
  },
  package_11_12_Days: {
    type: PackageFieldSchema,
    default: {
      label: "11-12 Days",
      minDays: 11,
      maxDays: 12,
      price: 0,
    },
  },
  package_13_14_Days: {
    type: PackageFieldSchema,
    default: {
      label: "13-14 Days",
      minDays: 13,
      maxDays: 14,
      price: 0,
    },
  },

  minimumRequiredDays: { type: Number, default: 1, min: 1, max: 14 },
  gallery: [GalleryImageSchema],
  transfer: { type: [TransferSchema], default: [] },
});

// Validation: minDays < maxDays
CitiesSchema.pre("validate", function (next) {
  const pkgFields = [
    "package_7_8_Days",
    "package_9_10_Days",
    "package_11_12_Days",
    "package_13_14_Days",
  ];
  for (const f of pkgFields) {
    const pkg = this[f];
    if (!pkg) continue;
    if (typeof pkg.minDays === "number" && typeof pkg.maxDays === "number") {
      if (pkg.minDays >= pkg.maxDays) {
        this.invalidate(
          `${f}.maxDays`,
          `${pkg.label}: maxDays must be greater than minDays`
        );
      }
    }
  }
  next();
});

CitiesSchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    // 🔥 REMOVED: currency conversion for packages and transfers

    if (!this.cityId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "cityId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.cityId = `CITY${String(counter.seq).padStart(4, "0")}`;
    }

    if (this.isModified("name")) {
      this.slug = await generateUniqueSlug({
        modelName: "Cities",
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

CitiesSchema.index({ destination: 1, status: 1 });
CitiesSchema.index({ cityId: 1 });

module.exports = mongoose.model("Cities", CitiesSchema);