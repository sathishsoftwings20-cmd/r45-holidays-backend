const Booking = require("../models/booking.model");
const Itinerary = require("../models/itinerary.model");
const User = require("../models/user.model");
const { convertINRtoUSD } = require("./currency.service");

exports.createBookingFromItinerary = async ({
  userId,
  itineraryId,
  travelers = [],
}) => {
  // 1. Fetch itinerary with status and totalTravelers
  const itinerary = await Itinerary.findById(itineraryId)
    .select("user totalTravelers pricing totalCost status")
    .lean();

  if (!itinerary) throw new Error("Itinerary not found");
  if (itinerary.user.toString() !== userId.toString())
    throw new Error("Unauthorized: itinerary does not belong to this user");

  // ✅ NEW: Check itinerary status
  if (itinerary.status !== "confirmed") {
    throw new Error(
      `Cannot create booking for itinerary with status "${itinerary.status}". Itinerary must be confirmed first.`
    );
  }

  // Optional: prevent booking if already deleted (though deleted itineraries are filtered out elsewhere)
  if (itinerary.status === "deleted") {
    throw new Error("Cannot create booking for a deleted itinerary");
  }

  // 2. Check that the number of travelers (if provided) matches expected total
  if (travelers.length > 0 && travelers.length !== itinerary.totalTravelers) {
    throw new Error(
      `Traveler count mismatch: expected ${itinerary.totalTravelers}, got ${travelers.length}`
    );
  }

  // 3. Try to create the booking – unique index on itinerary will prevent duplicates
  const totalCostINR = itinerary.pricing?.totalCost || 0;
  const { usd, rate, percentage } = await convertINRtoUSD(totalCostINR);

  try {
    const booking = await Booking.create({
      user: userId,
      itinerary: itineraryId,
      travelers: travelers || [],
      totalCost: totalCostINR,
      totalCostUSD: usd,
      exchangeRate: rate,
      conversionPercentage: percentage,
      bookingStatus: "draft",
      paymentStatus: "pending",
      createdBy: userId,
      updatedBy: userId,
    });
    return booking;
  } catch (err) {
    // 11000 = duplicate key error (unique index on itinerary)
    if (err.code === 11000) {
      throw new Error("A booking already exists for this itinerary");
    }
    throw err;
  }
};

exports.updateTravelers = async (bookingId, travelers, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  const user = await User.findById(userId).select("role").lean();
  const isOwner = booking.user.toString() === userId.toString();
  const isAdmin = ["SuperAdmin", "Admin"].includes(user?.role);
  if (!isOwner && !isAdmin) throw new Error("Unauthorized");

  if (!["draft", "cancelled"].includes(booking.bookingStatus)) {
    throw new Error("Cannot modify travelers after booking is confirmed");
  }

  booking.travelers = travelers;
  booking.updatedBy = userId;
  await booking.save();
  return booking;
};

exports.updateBookingStatus = async (bookingId, newStatus, userId) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  const user = await User.findById(userId).select("role").lean();
  const isOwner = booking.user.toString() === userId.toString();
  const isAdmin = ["SuperAdmin", "Admin"].includes(user?.role);
  if (!isOwner && !isAdmin) throw new Error("Unauthorized");

  const allowed = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["cancelled", "draft"],
    cancelled: ["draft"],
  };
  if (!allowed[booking.bookingStatus]?.includes(newStatus)) {
    throw new Error(`Cannot transition from ${booking.bookingStatus} to ${newStatus}`);
  }

  booking.bookingStatus = newStatus;
  booking.updatedBy = userId;
  await booking.save();
  return booking;
};
exports.updatePaymentStatus = async (
  bookingId,
  paymentStatus,
  userId,
  transactionId = null
) => {
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new Error("Booking not found");

  const user = await User.findById(userId).select("role").lean();
  const isOwner = booking.user.toString() === userId.toString();
  const isAdmin = ["SuperAdmin", "Admin"].includes(user?.role);
  if (!isOwner && !isAdmin) throw new Error("Unauthorized");

  const allowed = {
    pending: ["success", "failed"],
    failed: ["pending", "success"],
    success: ["refunded"],
    refunded: [],
  };
  if (!allowed[booking.paymentStatus]?.includes(paymentStatus)) {
    throw new Error(
      `Cannot change payment status from ${booking.paymentStatus} to ${paymentStatus}`
    );
  }

  if (paymentStatus === "success" && !booking.transactionId && !transactionId) {
    throw new Error("Transaction ID is required for successful payment");
  }

  if (transactionId) booking.transactionId = transactionId;
  booking.paymentStatus = paymentStatus;
  booking.updatedBy = userId;

  // On successful payment, confirm the booking and mark itinerary as booked
  if (paymentStatus === "success") {
    booking.bookingStatus = "confirmed";
    await Itinerary.findByIdAndUpdate(booking.itinerary, { status: "booked" });
  }

  await booking.save();
  return booking;
};