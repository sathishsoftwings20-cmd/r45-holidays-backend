const Itinerary = require("../models/itinerary.model");
const Cities = require("../models/cities.model");
const Activity = require("../models/activities.model");
const itineraryService = require("../services/itinerary.service");
const { getActivityWeight } = require("../services/itinerary.service");
const { convertINRtoUSDForDisplay } = require("../services/currency.service");

/**
 * POST /api/itinerary/initialize
 */
exports.initializeItinerary = async (req, res, next) => {
  try {
    const {
      destination,
      travelType,
      rooms,
      totalTravelers,
      departureCity,
      departureDate,
      selectedPackage,
      cityIds,
    } = req.body;

    if (
      !destination ||
      !travelType ||
      !departureDate ||
      !selectedPackage ||
      !cityIds?.length
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const packageDaysMap = { "7-8": 8, "9-10": 10, "11-12": 12, "13-14": 14 };
    const totalDays = packageDaysMap[selectedPackage];
    if (!totalDays) return res.status(400).json({ message: "Invalid package" });

    // Compute total travelers if not provided
    const computedTotalTravelers = totalTravelers || rooms.reduce(
      (sum, room) => sum + room.adults + (room.children || 0),
      0
    );
    const cityAllocations = await itineraryService.allocateDays(
      totalDays,
      cityIds,
    );
    const days = await itineraryService.generateFlightActivities(
      cityAllocations,
      new Date(departureDate),
    );

    const itinerary = new Itinerary({
      user: req.user.id,
      destination,
      travelType,
      rooms: rooms || [],
      totalTravelers: computedTotalTravelers,
      departureCity,
      departureDate: new Date(departureDate),
      selectedPackage,
      totalDays,
      cityAllocations,
      days,
      status: "draft",
    });

    // ✅ Calculate pricing before saving
    itinerary.pricing = await itineraryService.calculatePricing(itinerary);

    // ✅ Save to database
    await itinerary.save();

    // ✅ Now populate (document exists)
    const populated = await Itinerary.findById(itinerary._id)
      .populate("destination", "name destinationId")
      .populate("cityAllocations.city", "name cityId")
      .populate("days.activities.activity");

    const itObj = populated.toObject();

    // Add USD pricing fields
    itObj.totalCostUSD = await convertINRtoUSDForDisplay(
      itObj.pricing.totalCost,
    );
    itObj.perPersonCostUSD = await convertINRtoUSDForDisplay(
      itObj.pricing.perPersonCost,
    );

    res.status(201).json({
      message: "Itinerary initialized successfully",
      itinerary: itObj,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/itinerary/:id
 */
exports.getItinerary = async (req, res, next) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id)
      .populate("destination", "name destinationId")
      .populate("cityAllocations.city", "name cityId")
      .populate("days.activities.activity");

    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });

    const itObj = itinerary.toObject();

    // ✅ Add USD price fields
    itObj.totalCostUSD = await convertINRtoUSDForDisplay(
      itObj.pricing.totalCost,
    );
    itObj.perPersonCostUSD = await convertINRtoUSDForDisplay(
      itObj.pricing.perPersonCost,
    );

    res.json(itObj);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/itinerary/:id/activities
 * Update activities for a specific day (add/remove/reorder) – flights are preserved.
 */
exports.updateActivities = async (req, res, next) => {
  try {
    const { dayNumber, activities } = req.body;
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });

    const day = itinerary.days.find((d) => d.dayNumber === dayNumber);
    if (!day) return res.status(404).json({ message: "Day not found" });

    // -----------------------------------------------------------------
    // 1. Preserve flight activities
    // -----------------------------------------------------------------
    const existingFlights = day.activities.filter(
      (act) => act.isFlight === true,
    );
    const requestedActivityIds = activities.map((a) => a.activityId.toString());

    // Fetch requested activities to validate
    const requestedActivities = await Activity.find({
      _id: { $in: requestedActivityIds },
    }).lean();

    // 2. Prevent manual modification of flights
    const requestedFlightIds = requestedActivities
      .filter((a) => a.isFlight === true)
      .map((a) => a._id.toString());

    if (requestedFlightIds.length > 0) {
      return res.status(400).json({
        message:
          "Flight activities cannot be added, removed, or modified manually.",
      });
    }

    // 3. Duplicate checks within same day
    if (new Set(requestedActivityIds).size !== requestedActivityIds.length) {
      return res.status(400).json({
        message:
          "Duplicate non‑flight activities detected in your request for the same day.",
      });
    }

    // 4. Duplicate checks across other days
    const otherDaysNonFlightIds = itinerary.days
      .filter((d) => d.dayNumber !== dayNumber)
      .flatMap((d) =>
        d.activities
          .filter((act) => act.isFlight !== true)
          .map((act) => act.activity.toString()),
      );

    for (const actId of requestedActivityIds) {
      if (otherDaysNonFlightIds.includes(actId)) {
        const act = await Activity.findById(actId).lean();
        return res.status(400).json({
          message: `Activity "${act?.name || actId}" is already scheduled on another day.`,
        });
      }
    }

    // 5. Build new non‑flight activities from request
    let totalNonFlightWeight = 0;
    const newNonFlights = [];

    for (const item of activities) {
      const activity = requestedActivities.find(
        (a) => a._id.toString() === item.activityId.toString(),
      );
      if (!activity) continue;

      // City validation
      if (activity.city.toString() !== day.city.toString()) {
        return res.status(400).json({
          message: `Activity "${activity.name}" does not belong to the city assigned to this day.`,
        });
      }

      const weight = getActivityWeight(activity.badge);
      const flightCapacityUsed = existingFlights.reduce(
        (sum, f) => sum + (f.durationWeight || 0.25),
        0,
      );

      if (flightCapacityUsed + totalNonFlightWeight + weight > 1.0) {
        return res.status(400).json({
          message: `Cannot add activity "${activity.name}" – exceeds day capacity.`,
        });
      }

      newNonFlights.push({
        activity: activity._id,
        name: activity.name,
        durationWeight: weight,
        startTime: item.startTime || activity.startTime || "09:00",
        price: activity.price || 0,
        transferCharge: activity.transferCharge || 0, // ✅ FIX: correct field name
        city: activity.city,
        isFlight: false,
        flightType: null,
        order: item.order || newNonFlights.length + 1 + existingFlights.length,
      });

      totalNonFlightWeight += weight;
    }

    // 6. Combine flights + new non‑flights, reorder
    const orderedFlights = existingFlights.sort((a, b) => a.order - b.order);
    const finalActivities = [];

    orderedFlights.forEach((f, idx) => {
      finalActivities.push({ ...f, order: idx + 1 });
    });
    newNonFlights.forEach((nf, idx) => {
      nf.order = orderedFlights.length + idx + 1;
      finalActivities.push(nf);
    });

    day.activities = finalActivities;
    day.capacityUsed =
      orderedFlights.reduce((sum, f) => sum + (f.durationWeight || 0.25), 0) +
      totalNonFlightWeight;

    // 7. Recalculate pricing
    itinerary.pricing = await itineraryService.calculatePricing(itinerary);
    await itinerary.save();

    // ✅ POPULATE before sending to frontend
    const populated = await Itinerary.findById(itinerary._id)
      .populate("destination", "name destinationId")
      .populate("cityAllocations.city", "name cityId")
      .populate("days.activities.activity");

    res.json({
      message: "Activities updated (flights preserved)",
      itinerary: populated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/itinerary/:id/calculate-price
 * Recalculate price (useful after any change)
 */
exports.recalculatePrice = async (req, res, next) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });

    itinerary.pricing = await itineraryService.calculatePricing(itinerary);
    await itinerary.save();

    res.json({ pricing: itinerary.pricing });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/itinerary/:id/book
 * Final step – confirm booking
 */
exports.bookItinerary = async (req, res, next) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });

    itinerary.status = "confirmed";
    await itinerary.save();

    res.json({
      message: "Itinerary confirmed",
      itineraryId: itinerary.itineraryId,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/itinerary
 * Get all itineraries – Admin only (or filtered by user) – excludes deleted
 */
exports.getAllItineraries = async (req, res, next) => {
  try {
    let query = { status: { $ne: "deleted" } }; // Exclude deleted

    const userRole = req.user?.role;
    if (!["SuperAdmin", "Admin", "Staff"].includes(userRole)) {
      query.user = req.user.id;
    }

    const itineraries = await Itinerary.find(query)
      .populate("user", "name email")
      .populate("destination", "name")
      .populate("cityAllocations.city", "name")
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(
      itineraries.map(async (it) => {
        const obj = it.toObject();
        if (obj.pricing) {
          obj.totalCostUSD = await convertINRtoUSDForDisplay(
            obj.pricing.totalCost,
          );
          obj.perPersonCostUSD = await convertINRtoUSDForDisplay(
            obj.pricing.perPersonCost,
          );
        }
        return obj;
      }),
    );

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/itinerary/user
 * Get all itineraries for the currently logged-in user – excludes deleted
 */
exports.getMyItineraries = async (req, res, next) => {
  try {
    const itineraries = await Itinerary.find({
      user: req.user.id,
      status: { $ne: "deleted" }
    })
      .populate("destination", "name")
      .populate("cityAllocations.city", "name")
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(
      itineraries.map(async (it) => {
        const obj = it.toObject();
        if (obj.pricing) {
          obj.totalCostUSD = await convertINRtoUSDForDisplay(
            obj.pricing.totalCost,
          );
          obj.perPersonCostUSD = await convertINRtoUSDForDisplay(
            obj.pricing.perPersonCost,
          );
        }
        return obj;
      }),
    );

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/itinerary/:id/booked
 * Mark itinerary as booked (after booking record created)
 */
exports.markAsBooked = async (req, res, next) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Optional: check if user owns the itinerary or is admin
    if (itinerary.user.toString() !== req.user.id && !["SuperAdmin", "Admin", "Staff"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    itinerary.status = "booked";
    await itinerary.save();

    res.json({
      message: "Itinerary marked as booked",
      itineraryId: itinerary.itineraryId,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/itinerary/:id
 * Soft delete itinerary – set status to "deleted"
 */
exports.deleteItinerary = async (req, res, next) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id);
    if (!itinerary) {
      return res.status(404).json({ message: "Itinerary not found" });
    }

    // Check ownership or admin
    if (itinerary.user.toString() !== req.user.id && !["SuperAdmin", "Admin", "Staff"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    itinerary.status = "deleted";
    await itinerary.save();

    res.json({
      message: "Itinerary deleted successfully",
      itineraryId: itinerary.itineraryId,
    });
  } catch (err) {
    next(err);
  }
};