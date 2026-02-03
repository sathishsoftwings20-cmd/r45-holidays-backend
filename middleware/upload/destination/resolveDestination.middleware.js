const Destination = require("../../../models/destination.model");

module.exports = async (req, res, next) => {
  try {
    const destination = await Destination.findById(req.params.id);

    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    req.dbDestination = destination; // ✅ multer will read this
    next();
  } catch (err) {
    next(err);
  }
};
