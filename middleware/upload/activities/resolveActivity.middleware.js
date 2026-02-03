// backend/middleware/upload/activities/resolveActivity.middleware.js
const Activity = require("../../../models/activities.model");

module.exports = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id);
    if (!activity)
      return res.status(404).json({ message: "Activity not found" });

    req.dbActivity = activity;
    next();
  } catch (err) {
    next(err);
  }
};
