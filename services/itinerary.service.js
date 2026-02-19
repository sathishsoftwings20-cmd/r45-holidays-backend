const Cities = require("../models/cities.model");
const Activity = require("../models/activities.model");

/**
 * Split total days among cities in order of selection.
 */
async function allocateDays(totalDays, cityIds) {
  if (!cityIds?.length) throw new Error("No cities selected");

  // Fetch cities from DB
  const cities = await Cities.find({
    _id: { $in: cityIds },
    status: "published",
  }).lean();

  if (cities.length !== cityIds.length) {
    throw new Error("Some selected cities are invalid or unpublished");
  }

  // Map cityId → city object
  const cityMap = {};
  cities.forEach((c) => {
    cityMap[c._id.toString()] = c;
  });

  // Calculate total minimum required days
  let totalMinimumDays = 0;
  for (const cityId of cityIds) {
    const city = cityMap[cityId.toString()];
    const minDays = city.minimumRequiredDays || 1;
    totalMinimumDays += minDays;
  }

  // 🚨 If total minimum exceeds package days → throw error
  if (totalMinimumDays > totalDays) {
    throw new Error(
      `Selected cities require minimum ${totalMinimumDays} days, but package allows only ${totalDays} days. Please reduce number of cities.`,
    );
  }

  // Remaining days after minimum allocation
  let remainingDays = totalDays - totalMinimumDays;

  const allocations = [];

  // First assign minimum days
  for (let i = 0; i < cityIds.length; i++) {
    const cityId = cityIds[i];
    const city = cityMap[cityId.toString()];

    allocations.push({
      city: cityId,
      allocatedDays: city.minimumRequiredDays || 1,
      order: i + 1,
    });
  }

  // Distribute remaining days equally (round-robin)
  let index = 0;
  while (remainingDays > 0) {
    allocations[index].allocatedDays += 1;
    remainingDays--;
    index = (index + 1) % allocations.length;
  }

  return allocations;
}

/**
 * Convert activity badge to numerical weight.
 */
function getActivityWeight(badge) {
  switch (badge) {
    case "Quarter Day":
    case "Qurate Day":
      return 0.25;
    case "Half Day":
      return 0.5;
    case "Full Day":
    case "Overnight":
      return 1.0;
    default:
      return 0.25;
  }
}

/**
 * Auto‑assign default non‑flight activities to fill remaining day capacity.
 * Uses a greedy approach – largest activities first.
 * @param {Array} cityAllocations - [{ city, allocatedDays }]
 * @param {Array} days - array of day objects (mutated in‑place)
 * @param {Set} usedActivityIds - global set of already used activity IDs (prevents repeats)
 */
async function assignDefaultActivities(
  cityAllocations,
  days,
  usedActivityIds = new Set(),
) {
  // 1. Fetch all non‑flight published activities for all involved cities
  const cityIds = cityAllocations.map((a) => a.city);
  const allActivities = await Activity.find({
    city: { $in: cityIds },
    isFlight: false,
    status: "published",
  })
    .sort({ badge: -1 })
    .lean();

  // 2. Group activities by city
  const activitiesByCity = {};
  for (const act of allActivities) {
    const cityId = act.city.toString();
    if (!activitiesByCity[cityId]) activitiesByCity[cityId] = [];
    activitiesByCity[cityId].push(act);
  }

  // 3. Fill each day
  for (const day of days) {
    const cityId = day.city.toString();
    const available = activitiesByCity[cityId] || [];

    if (available.length === 0) continue;

    let remaining = 1.0 - day.capacityUsed;
    if (remaining <= 0) continue;

    // Exclude activities already used elsewhere in the itinerary
    const freshActivities = available.filter(
      (act) => !usedActivityIds.has(act._id.toString()),
    );

    // Sort by weight descending (largest first)
    const sorted = [...freshActivities].sort(
      (a, b) => getActivityWeight(b.badge) - getActivityWeight(a.badge),
    );

    for (const act of sorted) {
      if (remaining <= 0) break;

      const weight = getActivityWeight(act.badge);
      if (weight <= remaining) {
        const activityTransferCost = (act.transfer || []).reduce(
          (sum, t) => sum + (t.price || 0),
          0,
        );
        day.activities.push({
          activity: act._id,
          name: act.name,
          durationWeight: weight,
          startTime: act.startTime || "09:00",
          price: act.price || 0,
          transferCharge: activityTransferCost,
          city: act.city,
          isFlight: false,
          flightType: null,
          order: day.activities.length + 1,
        });
        day.capacityUsed += weight;
        remaining -= weight;
        usedActivityIds.add(act._id.toString());
      }
    }
  }
}

/**
 * Generate flight activities for an itinerary.
 * Each city gets:
 *   - departure flight on its first day (0.25)
 *   - return flight on its last day (0.25)
 * Then auto‑assign default non‑flight activities to fill the day.
 */
async function generateFlightActivities(cityAllocations, departureDate) {
  const days = [];
  let currentDay = 1;
  const usedActivityIds = new Set(); // tracks all activities added (flights + defaults)

  for (let i = 0; i < cityAllocations.length; i++) {
    const alloc = cityAllocations[i];
    const cityId = alloc.city;
    const cityDays = alloc.allocatedDays;

    // --- Fetch required flight activities for this city ---
    const departureFlight = await Activity.findOne({
      city: cityId,
      flightType: "departure",
      status: "published",
    }).lean();

    const returnFlight = await Activity.findOne({
      city: cityId,
      flightType: "return",
      status: "published",
    }).lean();

    // --- Build all days for this city ---
    for (let d = 1; d <= cityDays; d++) {
      const dayNumber = currentDay + d - 1;
      let day = days.find((day) => day.dayNumber === dayNumber);
      if (!day) {
        day = {
          dayNumber,
          city: cityId,
          capacityUsed: 0,
          activities: [],
        };
        days.push(day);
      }

      // --- First day: add departure flight (must be first activity) ---
      if (d === 1 && departureFlight) {
        // Prevent duplicate flight (should never happen, but safe)
        if (!usedActivityIds.has(departureFlight._id.toString())) {
          day.activities.push({
            activity: departureFlight._id,
            name: departureFlight.name,
            durationWeight: 0.25,
            startTime: departureFlight.startTime || "09:00",
            price: departureFlight.price || 0,
            transferCharge: departureFlight.activityTransferCharge || 0,
            city: cityId,
            isFlight: true,
            flightType: "departure",
            order: 1, // always first
          });
          day.capacityUsed += 0.25;
          usedActivityIds.add(departureFlight._id.toString());
        }
      }

      // --- Last day: add return flight (must be last activity) ---
      if (d === cityDays && returnFlight) {
        if (!usedActivityIds.has(returnFlight._id.toString())) {
          const order = day.activities.length + 1;
          day.activities.push({
            activity: returnFlight._id,
            name: returnFlight.name,
            durationWeight: 0.25,
            startTime: returnFlight.startTime || "18:00",
            price: returnFlight.price || 0,
            transferCharge: returnFlight.activityTransferCharge || 0,
            city: cityId,
            isFlight: true,
            flightType: "return",
            order,
          });
          day.capacityUsed += 0.25;
          usedActivityIds.add(returnFlight._id.toString());
        }
      }
    }

    currentDay += cityDays;
  }

  // --- Auto‑assign non‑flight activities, respecting already used activities ---
  await assignDefaultActivities(cityAllocations, days, usedActivityIds);

  return days;
}

/**
 * Calculate pricing for the itinerary.
 */
async function calculatePricing(itinerary) {
  const itin = itinerary.toObject ? itinerary.toObject() : itinerary;
  const {
    cityAllocations = [],
    days = [],
    totalTravelers = 1,
    selectedPackage,
    totalDays = 1,
  } = itin;

  const packageFieldMap = {
    "7-8": "package_7_8_Days",
    "9-10": "package_9_10_Days",
    "11-12": "package_11_12_Days",
    "13-14": "package_13_14_Days",
  };
  const packageField = packageFieldMap[selectedPackage];

  let totalCityPackageCost = 0;
  let totalCityTransferCost = 0;

  for (const alloc of cityAllocations) {
    const city = await Cities.findById(alloc.city).lean();
    if (!city) continue;

    // City package cost – per person per day
    const packagePrice = city[packageField]?.price || 0;
    const perDayCost = packagePrice / (totalDays || 1);
    const cityCost = perDayCost * (alloc.allocatedDays || 0);
    totalCityPackageCost += cityCost;

    // City transfer cost – assume it is per person (sum of transfer prices)
    const cityTransfer = (city.transfer || []).reduce(
      (s, t) => s + (t.price || 0),
      0,
    );
    totalCityTransferCost += cityTransfer;
  }

  let totalActivityCost = 0;
  let totalActivityTransferCharges = 0;

  for (const day of days || []) {
    for (const act of day.activities || []) {
      const populated =
        act.activity &&
        typeof act.activity === "object" &&
        act.activity.price != null;

      if (populated) {
        totalActivityCost += act.activity.price || 0;

        // Try to get transfer charge from populated activity
        let transfer = 0;
        if (Array.isArray(act.activity.transfer) && act.activity.transfer.length > 0) {
          transfer = act.activity.transfer.reduce((s, t) => s + (t.price || 0), 0);
        } else if (act.activity.transferCharge) {
          transfer = act.activity.transferCharge;
        } else if (act.activity.activityTransferCharge) {
          transfer = act.activity.activityTransferCharge;
        }
        totalActivityTransferCharges += transfer;
      } else {
        // Not populated – use the subdocument's stored values
        totalActivityCost += act.price || 0;
        totalActivityTransferCharges += act.transferCharge || 0;
      }
    }
  }

  // ✅ PER PERSON COST now includes city transfers
  const perPersonCost =
    totalCityPackageCost +
    totalCityTransferCost +          // <-- ADDED
    totalActivityCost +
    totalActivityTransferCharges;

  // ✅ TOTAL COST = per person × number of travelers
  const totalCost = perPersonCost * totalTravelers;

  return {
    perPersonCost,
    totalCost,
    currency: "INR",
    breakdown: {
      cityPackageCost: totalCityPackageCost,
      cityTransferCharges: totalCityTransferCost,   // now part of perPersonCost
      activityCost: totalActivityCost,
      activityTransferCharges: totalActivityTransferCharges,
    },
  };
}
module.exports = {
  allocateDays,
  generateFlightActivities,
  assignDefaultActivities,
  calculatePricing,
  getActivityWeight, // exported for reuse in controller
};
