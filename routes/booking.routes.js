const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/booking.controller");
const auth = require("../middleware/auth/auth.middleware");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");
const resolveBooking = require("../middleware/upload/bookings/resolveBooking.middleware");
const {
  uploadDocument,
} = require("../middleware/upload/bookings/document.middleware");

// All booking routes require authentication
router.use(auth);

// Create booking (user)
router.post(
  "/",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.createBooking,
);

// Get my bookings
router.get(
  "/",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.getMyBookings,
);

// Get All bookings (Admin only)
router.get(
  "/all",
  authorizeRoles("SuperAdmin", "Admin", "Staff"),
  bookingController.getAllBookings,
);

// Get single booking
router.get(
  "/:id",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.getBookingById,
);

// Update travelers
router.put(
  "/:id/travelers",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.updateTravelers,
);

// Update booking status
router.patch(
  "/:id/status",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.updateBookingStatus,
);

// Update payment status
router.patch(
  "/:id/payment",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.updatePaymentStatus,
);

// Cancel booking
router.delete(
  "/:id",
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  bookingController.cancelBooking,
);

router.post(
  "/:id/travelers/:travelerIndex/documents/:documentType",
  auth,
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  resolveBooking,
  uploadDocument, // ✅ already configured as .single("document")
  bookingController.uploadTravelerDocument,
);

// Optional: Delete traveler document
router.delete(
  "/:id/travelers/:travelerIndex/documents/:documentType",
  auth,
  authorizeRoles("User", "SuperAdmin", "Admin", "Staff"),
  resolveBooking,
  bookingController.deleteTravelerDocument, // you can implement this similarly
);

module.exports = router;
