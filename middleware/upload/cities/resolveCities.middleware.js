const Cities = require("../../../models/cities.model");

module.exports = async (req, res, next) => {
  try {
    const cities = await Cities.findById(req.params.id);
    if (!cities) return res.status(404).json({ message: "City not found" });

    req.dbCities = cities; // multer reads this
    next();
  } catch (err) {
    next(err);
  }
};
