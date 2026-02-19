const mongoose = require("mongoose");
const Counter = require("./counter.model");

const TravelerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    dateOfBirth: Date,
    passportNumber: String,
    issueDate: Date,
    expiryDate: Date,
    issueCountry: String,
    panNumber: String,
    foodPreference: { type: String, enum: ["Veg", "Non-Veg"] },
    documents: {
      passportFront: String,
      passportBack: String,
      panCard: String,
    },
  },
  { _id: false }
);

const BookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    itinerary: { type: mongoose.Schema.Types.ObjectId, ref: "Itinerary", required: true, index: true },
    travelers: { type: [TravelerSchema], required: true, default: [] },
    totalTravelers: { type: Number, default: 0 },
    bookingStatus: {
      type: String,
      enum: ["draft", "confirmed", "cancelled"],
      default: "draft",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "success", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    // 💰 Pricing – frozen at booking time
    totalCost: { type: Number, required: true }, // INR
    totalCostUSD: { type: Number, required: true }, // USD (after conversion + percentage)
    exchangeRate: { type: Number, required: true }, // raw rate at booking time
    conversionPercentage: { type: Number, required: true }, // admin margin at booking time

    transactionId: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

BookingSchema.pre("save", async function (next) {
  try {
    // Generate bookingId if not present
    if (!this.bookingId) {
      const Counter = mongoose.model("Counter");
      const counter = await Counter.findByIdAndUpdate(
        { _id: "bookingId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.bookingId = `BKG${String(counter.seq).padStart(4, "0")}`;
    }

    // Validate traveler count against itinerary
    const Itinerary = mongoose.model("Itinerary");
    const itinerary = await Itinerary.findById(this.itinerary).select("totalTravelers").lean();
    if (!itinerary) return next(new Error("Invalid itinerary reference"));

    const expected = itinerary.totalTravelers;
    const actual = this.travelers.length;

    if (this.bookingStatus !== "draft" && actual !== expected) {
      return next(new Error(`Traveler count mismatch. Expected ${expected}, got ${actual}`));
    }
    if (this.bookingStatus === "draft" && actual > 0 && actual !== expected) {
      return next(new Error(`Traveler count mismatch. Expected ${expected}, got ${actual}`));
    }

    this.totalTravelers = expected;
    next();
  } catch (err) {
    next(err);
  }
});

BookingSchema.index({ user: 1, bookingStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", BookingSchema);