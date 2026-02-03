const mongoose = require("mongoose");
const Counter = require("./counter.model");
const generateUniqueSlug = require("../utils/slugifyUnique");

const DestinationSchema = new mongoose.Schema({
  destinationId: {
    type: String,
    unique: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },

  slug: {
    type: String,
    unique: true,
    index: true,
  },

  coverImage: {
    type: String,
    default: "/uploads/defaults/default-destination.png",
  },
  badge: {
    type: String,
    enum: ["In Season", "Honeymoon", "Family", "Trending"],
    default: "In Season",
  },
  shortDescription: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ["draft", "published", "deleted"],
    default: "draft",
    index: true,
  },

  publishedAt: { type: Date },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DestinationSchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    if (!this.destinationId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "destinationId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.destinationId = `DES${String(counter.seq).padStart(4, "0")}`;
    }

    if (this.isModified("name")) {
      this.slug = await generateUniqueSlug({
        modelName: "Destination",
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

module.exports = mongoose.model("Destination", DestinationSchema);
