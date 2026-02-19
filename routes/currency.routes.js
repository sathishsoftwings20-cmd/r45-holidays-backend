// routes/currency.routes.js
const express = require("express");
const router = express.Router();
const currencyController = require("../controllers/currency.controller");
const { authorizeRoles } = require("../middleware/auth/roles.middleware");

router.get(
  "/",
  authorizeRoles("SuperAdmin", "Admin"),
  currencyController.getCurrencyConfig,
); // GET  /api/currency
router.post(
  "/percentage",
  authorizeRoles("SuperAdmin", "Admin"),
  currencyController.updateConversionPercentage,
); // POST /api/currency/percentage

module.exports = router;
