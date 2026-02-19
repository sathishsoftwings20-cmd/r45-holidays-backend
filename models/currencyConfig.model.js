const mongoose = require("mongoose");

const CurrencyConfigSchema = new mongoose.Schema(
  {
    baseCurrency: { type: String, default: "INR" },
    targetCurrency: { type: String, default: "USD" },
    conversionPercentage: { type: Number, default: 0 }, // admin controlled
    lastRate: { type: Number, default: 0 }, // live INR → USD
    lastFetchedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CurrencyConfig", CurrencyConfigSchema);
