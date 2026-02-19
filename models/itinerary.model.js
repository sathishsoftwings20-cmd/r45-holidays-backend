const mongoose = require("mongoose");
const Counter = require("./counter.model");

const ItinerarySchema = new mongoose.Schema(
  {
    itineraryId: { type: String, unique: true, index: true },

    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    destination: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Destination",
      required: true,
    },

    // Traveler configuration
    travelType: {
      type: String,
      enum: ["Solo", "Friends", "Family", "Couples"],
      required: true,
    },
    rooms: [{
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0, min: 0 },
      childAges: { type: [Number], default: [] }
    }],
    totalTravelers: { type: Number, required: true }, // computed

    // Departure info
    departureCity: { type: String, required: true }, // free text for now
    departureDate: { type: Date, required: true },

    // Package selection
    selectedPackage: {
      type: String,
      enum: ["7-8", "9-10", "11-12", "13-14"],
      required: true,
    },
    totalDays: { type: Number, required: true }, // 8,10,12,14

    // City allocations (result of day split)
    cityAllocations: [
      {
        city: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cities",
          required: true,
        },
        allocatedDays: { type: Number, required: true, min: 1 },
        order: { type: Number, required: true }, // visit order
      },
    ],

    // Daily itinerary
    days: [
      {
        dayNumber: { type: Number, required: true },
        city: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Cities",
          required: true,
        }, // ✅ ADD THIS
        capacityUsed: { type: Number, default: 0, min: 0, max: 1 },
        activities: [
          {
            activity: { type: mongoose.Schema.Types.ObjectId, ref: "Activity" },
            name: String,
            durationWeight: { type: Number, required: true },
            startTime: String,
            price: { type: Number, default: 0 },
            transferCharge: { type: Number, default: 0 },
            city: { type: mongoose.Schema.Types.ObjectId, ref: "Cities" },
            isFlight: { type: Boolean, default: false },
            flightType: {
              type: String,
              enum: ["arrival", "departure", "return", null],
            },
            order: Number,
          },
        ],
      },
    ],

    // Pricing summary
    pricing: {
      perPersonCost: { type: Number, default: 0 },
      totalCost: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
      breakdown: {
        cityPackageCost: { type: Number, default: 0 },
        cityTransferCharges: { type: Number, default: 0 },
        activityCost: { type: Number, default: 0 },
        activityTransferCharges: { type: Number, default: 0 },
      },
    },

    status: {
      type: String,
      enum: ["draft", "confirmed", "booked", "deleted"],
      default: "draft",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Generate itineraryId
ItinerarySchema.pre("save", async function (next) {
  if (!this.itineraryId) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "itineraryId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );
    this.itineraryId = `ITIN${String(counter.seq).padStart(6, "0")}`;
  }
  next();
});

module.exports = mongoose.model("Itinerary", ItinerarySchema);
