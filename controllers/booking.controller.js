const Booking = require("../models/booking.model");
const Itinerary = require("../models/itinerary.model");
const bookingService = require("../services/booking.service");

/**
 * POST /api/bookings
 * Create a booking from an itinerary ID
 */
exports.createBooking = async (req, res, next) => {
  try {
    const { itineraryId, travelers } = req.body;

    const booking = await bookingService.createBookingFromItinerary({
      userId: req.user.id,
      itineraryId,
      travelers: travelers || [],
    });

    res.status(201).json({
      message: "Booking created successfully",
      booking,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/bookings
 */
exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ user: req.user.id })
      .populate({
        path: "itinerary",
        select: "itineraryId destination totalDays departureDate pricing",
        populate: {
          path: "destination",
          select: "name",
        },
      })
      .sort("-createdAt");

    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

/** *Get All Bookings */
exports.getAllBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find()
      .populate("user", "name email")
      .populate({
        path: "itinerary",
        select: "itineraryId destination totalDays departureDate pricing",
        populate: {
          path: "destination",
          select: "name",
        },
      });

    res.json(bookings);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/bookings/:id
 */
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: "itinerary",
        populate: [
          { path: "destination", select: "name" },
          { path: "cityAllocations.city", select: "name cityId" },
          {
            path: "days.activities.activity",
            select: "name badge startTime price",
          },
        ],
      })
      .populate("user", "name email");

    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    if (
      booking.user._id.toString() !== req.user.id &&
      !["SuperAdmin", "Admin"].includes(req.user.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(booking);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/bookings/:id/travelers
 */
exports.updateTravelers = async (req, res, next) => {
  try {
    const { travelers } = req.body;

    const booking = await bookingService.updateTravelers(
      req.params.id,
      travelers,
      req.user.id
    );

    res.json({
      message: "Travelers updated",
      travelers: booking.travelers,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/bookings/:id/status
 */
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    const booking = await bookingService.updateBookingStatus(
      req.params.id,
      status,
      req.user.id
    );

    res.json({
      message: `Booking status updated to ${status}`,
      bookingStatus: booking.bookingStatus,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/bookings/:id/payment
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { paymentStatus, transactionId } = req.body;

    const booking = await bookingService.updatePaymentStatus(
      req.params.id,
      paymentStatus,
      req.user.id,
      transactionId
    );

    if (transactionId) {
      booking.transactionId = transactionId;
      await booking.save();
    }

    res.json({
      message: `Payment status updated to ${paymentStatus}`,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/bookings/:id
 * Cancel booking (reuse status update logic)
 */
exports.cancelBooking = async (req, res, next) => {
  req.body.status = "cancelled";
  return exports.updateBookingStatus(req, res, next);
};

/**
 * POST /api/bookings/:id/travelers/:travelerIndex/documents/:documentType
 */
exports.uploadTravelerDocument = async (req, res, next) => {
  try {
    const { travelerIndex, documentType } = req.params;
    const booking = req.dbBooking;

    if (!booking.travelers || !booking.travelers[travelerIndex]) {
      return res.status(400).json({ message: "Invalid traveler index" });
    }

    const isOwner = booking.user.toString() === req.user.id;
    const isAdmin = ["SuperAdmin", "Admin"].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const allowedTypes = ["passportFront", "passportBack", "panCard"];
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({ message: "Invalid document type" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:5000";
    const fileUrl = `${baseUrl}/uploads/bookings/${booking.bookingId}/documents/${req.file.filename}`;

    booking.travelers[travelerIndex].documents = {
      ...booking.travelers[travelerIndex].documents,
      [documentType]: fileUrl,
    };

    booking.updatedBy = req.user.id;
    await booking.save();

    res.json({
      message: "Document uploaded successfully",
      documentUrl: fileUrl,
      traveler: booking.travelers[travelerIndex],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE traveler document
 */
exports.deleteTravelerDocument = async (req, res, next) => {
  try {
    const { id, travelerIndex, documentType } = req.params;

    const booking = await Booking.findById(id);
    if (!booking)
      return res.status(404).json({ message: "Booking not found" });

    const isOwner = booking.user.toString() === req.user.id;
    const isAdmin = ["SuperAdmin", "Admin"].includes(req.user.role);
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Forbidden" });

    if (!booking.travelers || !booking.travelers[travelerIndex]) {
      return res.status(400).json({ message: "Invalid traveler index" });
    }

    const allowedTypes = ["passportFront", "passportBack", "panCard"];
    if (!allowedTypes.includes(documentType)) {
      return res.status(400).json({ message: "Invalid document type" });
    }

    if (booking.travelers[travelerIndex].documents) {
      delete booking.travelers[travelerIndex].documents[documentType];
    }

    booking.updatedBy = req.user.id;
    await booking.save();

    res.json({
      message: "Document removed successfully",
      traveler: booking.travelers[travelerIndex],
    });
  } catch (err) {
    next(err);
  }
};
