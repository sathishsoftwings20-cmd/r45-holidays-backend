const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const {
  permitOwnerOrRole,
} = require("../middleware/auth/ownership.middleware");
const uploadProfile = require("../middleware/upload/user/userProfile.middleware");
const {
  resolveSelfUser,
  resolveTargetUser,
} = require("../middleware/upload/user/resolveUploadUser.middleware");

// Anyone can register
router.post("/", userController.createUser);

// Get all users - Admin or SuperAdmin
router.get(
  "/",
  auth,
  authorizeRoles("SuperAdmin", "Admin"),
  userController.getAllUsers,
);

// Get single user - owner or admin
router.get(
  "/:id",
  auth,
  permitOwnerOrRole("SuperAdmin", "Admin"),
  userController.getUserById,
);

// update - owner or admin
router.put(
  "/:id",
  auth,
  permitOwnerOrRole("SuperAdmin", "Admin"),
  userController.updateUser,
);

// delete - only SuperAdmin
router.delete(
  "/:id",
  auth,
  authorizeRoles("SuperAdmin", "Admin"),
  userController.deleteUser,
);

// post - Anyone can upload their Profile
router.post(
  "/profile-image",
  auth,
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  resolveSelfUser, // 👈 MUST be before multer
  uploadProfile.single("profileImage"),
  userController.uploadProfileImage,
);

router.post(
  "/:id/profile-image",
  auth,
  authorizeRoles("Admin", "SuperAdmin"),
  resolveTargetUser, // 👈 MUST be before multer
  uploadProfile.single("profileImage"),
  userController.uploadUserProfileImageByAdmin,
);

module.exports = router;
