// backend/routes/activities.routes.js
const express = require("express");
const router = express.Router();
const activitiesController = require("../controllers/activities.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const coverImage = require("../middleware/upload/activities/coverImage.middleware");
const galleryUpload = require("../middleware/upload/activities/gallery.middleware");
const resolveActivity = require("../middleware/upload/activities/resolveActivity.middleware");

// Get all activities (Admin panel)
router.get(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  activitiesController.getAllActivities,
);

// Get single activity
router.get(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  activitiesController.getActivityById,
);

// Create activity
router.post(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  activitiesController.createActivity,
);

// Update activity
router.put(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  activitiesController.updateActivity,
);

// Upload cover image
router.post(
  "/:id/cover-image",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  resolveActivity,
  coverImage.single("coverImage"),
  activitiesController.updateActivityCoverImage,
);

// Upload gallery
router.post(
  "/:id/gallery",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  resolveActivity,
  galleryUpload.array("gallery", 10),
  activitiesController.uploadActivityGallery,
);

// Delete gallery images
router.delete(
  "/:id/gallery/:index",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  activitiesController.deleteActivityGalleryImage,
);

// Soft delete
router.delete(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin"),
  activitiesController.deleteActivity,
);

module.exports = router;
