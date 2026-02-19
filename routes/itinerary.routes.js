const express = require("express");
const router = express.Router();
const itineraryController = require("../controllers/itinerary.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");

// All itinerary routes require authentication
router.use(auth);

// Initialize a new itinerary (step 5)
router.post(
  "/initialize",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"), // adjust roles
  itineraryController.initializeItinerary,
);

router.get(
  "/user",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"), // all authenticated users
  itineraryController.getMyItineraries,
);

// Get itinerary by ID
router.get(
  "/:id",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  itineraryController.getItinerary,
);

// Update activities for a specific day
router.put(
  "/:id/activities",
  authorizeRoles("User", "SuperAdmin", "Admin", "User"),
  itineraryController.updateActivities,
);

// Recalculate price
router.post(
  "/:id/calculate-price",
  authorizeRoles("User", "SuperAdmin", "Admin", "User"),
  itineraryController.recalculatePrice,
);

// Book itinerary (final step)
router.post(
  "/:id/book",
  authorizeRoles("User", "SuperAdmin", "Admin", "User"),
  itineraryController.bookItinerary,
);

/**
 * GET /api/itinerary
 * Get all itineraries – Admin only (or own for regular users)
 */
router.get(
  "/",
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"), // User sees only theirs
  itineraryController.getAllItineraries,
);


// Mark itinerary as booked
router.post(
  "/:id/booked",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  itineraryController.markAsBooked,
);

// Soft delete itinerary
router.delete(
  "/:id",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  itineraryController.deleteItinerary,
);

module.exports = router;
