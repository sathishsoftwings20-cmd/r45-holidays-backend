const CurrencyConfig = require("../models/currencyConfig.model");

exports.updateConversionPercentage = async (req, res) => {
  try {
    const { conversionPercentage } = req.body;

    if (typeof conversionPercentage !== "number" || Number.isNaN(conversionPercentage)) {
      return res.status(400).json({
        success: false,
        message: "conversionPercentage must be a number",
      });
    }

    const cfg = await CurrencyConfig.findOneAndUpdate(
      {},
      { conversionPercentage },
      { upsert: true, new: true }
    );

    // 🔥 REMOVED: recalculateAllPrices() – no longer needed

    return res.json({
      success: true,
      message: "Conversion percentage updated",
      config: cfg,
    });
  } catch (err) {
    console.error("updateConversionPercentage error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCurrencyConfig = async (req, res) => {
  try {
    const config = (await CurrencyConfig.findOne({})) || {};
    res.json(config);
  } catch (err) {
    console.error("getCurrencyConfig error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};