const express = require("express");
const router = express.Router();
const citiesController = require("../controllers/cities.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const coverImage = require("../middleware/upload/cities/coverImage.middleware");
const resolveCities = require("../middleware/upload/cities/resolveCities.middleware");
const galleryUpload = require("../middleware/upload/cities/gallery.middleware");

// Get All cities - Super Admin, Admin and Staff
router.get(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  citiesController.getAllCities,
);
// Get single city - Super Admin, Admin and Staff
router.get(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  citiesController.getCityById,
);

// Create new city- Super Admin, Admin and Staff
router.post(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  citiesController.createCity,
);

// update city - Super Admin, Admin and Staff
router.put(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  citiesController.updateCity,
);

router.post(
  "/:id/cover-image",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  resolveCities, // ✅ MUST be before multer
  coverImage.single("coverImage"), // ✅ now multer knows cityId
  citiesController.updateCityCoverImage,
);

// Upload gallery images
router.post(
  "/:id/gallery",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  resolveCities,
  galleryUpload.array("gallery", 10), // max 10 images
  citiesController.uploadCityGallery,
);

// Delete gallery images
router.delete(
  "/:id/gallery/:index",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  citiesController.deleteCityGalleryImage,
);
// Get cities by destination ID
router.get(
  "/destination/:destinationId",
  auth,
  authorizeRoles("SuperAdmin", "Admin", "Staff", "User"),
  citiesController.getCitiesByDestination,
);

module.exports = router;
