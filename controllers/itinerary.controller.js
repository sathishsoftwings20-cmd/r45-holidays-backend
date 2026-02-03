// backend/controllers/itinerary.controller.js
const Itinerary = require("../models/itinerary.model");
const Activity = require("../models/activities.model");
const Cities = require("../models/cities.model");

/**
 * Activity weight:
 * Qurate Day -> quarter day (0.25)
 * Half Day -> 0.5
 * Full Day / Overnight -> 1
 */
function getActivityWeight(badge) {
  switch (badge) {
    case "Qurate Day":
      return 0.25;
    case "Half Day":
      return 0.5;
    case "Full Day":
    case "Overnight":
      return 1;
    default:
      return 0.25;
  }
}

/**
 * Distribute activities city-by-city, finishing all activities in a city before moving
 * to the next city. Activities are consumed once (no duplicates).
 *
 * - cities: array of city documents (in desired visiting order)
 * - activitiesMap: { [cityIdString]: [activityDoc, ...] }
 * - totalDays: total days available
 */
function distributeActivities(cities, activitiesMap, totalDays) {
  const days = [];
  let dayNumber = 1;

  for (const city of cities) {
    const cityActivities = activitiesMap[city._id.toString()] || [];
    let activityIndex = 0;

    while (activityIndex < cityActivities.length && dayNumber <= totalDays) {
      let dayCost = 0;
      let usedDayFraction = 0;
      const activitiesForDay = [];

      while (activityIndex < cityActivities.length) {
        const act = cityActivities[activityIndex];

        // Determine duration
        const duration =
          act.badge === "Full Day"
            ? 1
            : act.badge === "Quarter Day"
              ? 0.25
              : 0.5;

        // If day is full, break
        if (usedDayFraction + duration > 1) break;

        activitiesForDay.push({
          activityId: act._id,
          name: act.name,
          badge: act.badge,
          price: act.price,
          startTime: act.startTime,
          duration,
        });

        usedDayFraction += duration;
        dayCost += act.price;
        activityIndex++;
      }

      days.push({
        day: dayNumber,
        city: city._id, // ✅ ALWAYS present
        cityName: city.name,
        activities: activitiesForDay,
        totalDayCost: dayCost,
      });

      dayNumber++;
    }
  }

  return days;
}

// POST /api/itinerary/build
exports.buildItinerary = async (req, res) => {
  try {
    // incoming payload may include userId (admin) or not (app user)
    let { userId: bodyUserId, destinationId, cityIds, totalDays } = req.body;

    // req.user is set by auth middleware (JWT)
    const caller = req.user;
    if (!caller) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Basic validation
    if (!Array.isArray(cityIds) || cityIds.length === 0 || !totalDays) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // If caller is admin/staff/superadmin they can specify `userId`, otherwise ignore body userId and use caller
    const isAdminCaller =
      typeof caller.role === "string" &&
      ["SuperAdmin", "Admin", "Staff"].includes(caller.role);

    const ownerUserId = isAdminCaller && bodyUserId ? bodyUserId : caller._id;

    // Fetch cities (published)
    const cities = await Cities.find({
      _id: { $in: cityIds },
      status: "published",
    });

    if (!cities.length) {
      return res.status(400).json({ message: "No valid cities found" });
    }

    // If destinationId wasn't provided, attempt to infer from first city
    if (!destinationId) {
      const firstCity = cities[0];
      if (firstCity && firstCity.destination) {
        destinationId = firstCity.destination;
      }
    }

    if (!destinationId) {
      return res
        .status(400)
        .json({ message: "destinationId is required or cannot be inferred" });
    }

    // Fetch activities for the selected cities (published)
    const activities = await Activity.find({
      city: { $in: cityIds },
      status: "published",
    });

    // Map activities by city id string (so keys are consistent)
    const activitiesMap = {};
    activities.forEach((act) => {
      const key = String(act.city);
      if (!activitiesMap[key]) activitiesMap[key] = [];
      activitiesMap[key].push(act);
    });

    // Optional: sort activities per city by badge (Full day first, then half, then quarter) or any business rule.
    Object.keys(activitiesMap).forEach((k) => {
      activitiesMap[k].sort((a, b) => {
        const wA = getActivityWeight(a.badge);
        const wB = getActivityWeight(b.badge);
        return wB - wA; // larger weights first
      });
    });

    // Ensure cities are ordered as user selected (cityIds order)
    const orderedCities = cityIds
      .map((id) => cities.find((c) => c._id.toString() === String(id)))
      .filter(Boolean);

    // Distribute activities
    const days = distributeActivities(orderedCities, activitiesMap, totalDays);

    // Calculate total cost
    const totalCost = days.reduce(
      (sum, day) => sum + (day.totalDayCost || 0),
      0,
    );

    // Create and persist itinerary (draft)
    const itinerary = new Itinerary({
      user: ownerUserId,
      destination: destinationId,
      cities: cityIds,
      totalDays,
      days,
      totalCost,
      status: "draft",
      createdBy: caller._id,
      updatedBy: caller._id,
    });

    await itinerary.save();

    return res.json({
      message: "Itinerary built successfully",
      itinerary,
    });
  } catch (err) {
    console.error("buildItinerary error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message || err });
  }
};

// PUT /api/itinerary/:id
exports.updateItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const itinerary = await Itinerary.findById(id);
    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });

    Object.assign(itinerary, updates);
    itinerary.updatedAt = new Date();
    await itinerary.save();

    return res.json({ message: "Itinerary updated", itinerary });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// GET /api/itinerary/:id
exports.getItinerary = async (req, res) => {
  try {
    const itinerary = await Itinerary.findById(req.params.id)
      .populate("user", "fullName email")
      .populate("destination", "name")
      .populate("cities", "name");
    if (!itinerary)
      return res.status(404).json({ message: "Itinerary not found" });
    return res.json(itinerary);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// GET /api/itinerary
exports.getAllItineraries = async (req, res) => {
  const query = req.user.role === "User" ? { user: req.user.id } : {};

  const itineraries = await Itinerary.find(query)
    .populate("destination", "name")
    .populate("cities", "name")
    .sort({ createdAt: -1 });

  res.json(itineraries);
};
