// backend/routes/itinerary.routes.js
const express = require("express");
const router = express.Router();
const itineraryController = require("../controllers/itinerary.controller");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const auth = require("../middleware/auth/auth.middleware");

// Get Itinerary
router.get(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  itineraryController.getItinerary,
);

// Update Itinerary
router.put(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  itineraryController.updateItinerary,
);

// Create new Itinerary - Super Admin, Admin and Staff
router.post(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  itineraryController.buildItinerary,
);

router.get(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  itineraryController.getAllItineraries,
);

module.exports = router;
