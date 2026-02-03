// backend/models/itinerary.model.js
const mongoose = require("mongoose");
const Counter = require("./counter.model");

const ItineraryActivitySchema = new mongoose.Schema({
  activityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Activity",
    required: true,
  },
  name: { type: String, required: true },
  badge: {
    type: String,
    enum: ["Half Day", "Full Day", "Overnight", "Qurate Day"],
    required: true,
  },
  price: { type: Number, default: 0 },
  startTime: { type: String },
  duration: { type: String },
});

const ItineraryDaySchema = new mongoose.Schema({
  day: { type: Number, required: true },
  city: { type: mongoose.Schema.Types.ObjectId, ref: "Cities", required: true },
  cityName: { type: String, required: true },
  activities: { type: [ItineraryActivitySchema], default: [] },
  totalDayCost: { type: Number, default: 0 },
});

const ItinerarySchema = new mongoose.Schema({
  itineraryId: { type: String, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  destination: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Destination",
    required: true,
  },
  cities: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Cities", required: true },
  ],
  totalDays: { type: Number, required: true },
  days: { type: [ItineraryDaySchema], default: [] },
  totalCost: { type: Number, default: 0 },
  status: { type: String, enum: ["draft", "confirmed"], default: "draft" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

// Pre-save: generate itineraryId
ItinerarySchema.pre("save", async function (next) {
  try {
    this.updatedAt = Date.now();

    if (!this.itineraryId) {
      const counter = await Counter.findByIdAndUpdate(
        { _id: "itineraryId" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.itineraryId = `ITN${String(counter.seq).padStart(4, "0")}`;
    }

    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("Itinerary", ItinerarySchema);
