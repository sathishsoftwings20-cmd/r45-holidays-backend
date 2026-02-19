const Booking = require("../../../models/booking.model");

module.exports = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        req.dbBooking = booking;
        next();
    } catch (err) {
        next(err);
    }
};