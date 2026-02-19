const express = require("express");
const router = express.Router();
const destinationController = require("../controllers/destination.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const coverImage = require("../middleware/upload/destination/coverImage.middleware");
const resolveDestination = require("../middleware/upload/destination/resolveDestination.middleware");

// Get All destination - Super Admin, Admin and Staff
router.get(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  destinationController.getAllDestination,
);
// Get single destination - Super Admin, Admin and Staff
router.get(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  destinationController.getDestinationById,
);

// Create new destination - Super Admin, Admin and Staff
router.post(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  destinationController.createDestination,
);

// update destination - Super Admin, Admin and Staff
router.put(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  destinationController.updateDestination,
);

// delete destination - only Super Admin and Admin
router.delete(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin"),
  destinationController.deleteDestination,
);

router.post(
  "/:id/cover-image",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  resolveDestination, // ✅ MUST be before multer
  coverImage.single("coverImage"), // ✅ now multer knows destinationId
  destinationController.updateCoverImage,
);

module.exports = router;
