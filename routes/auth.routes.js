const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller"); // must exist
// NOTE: protect/authorize not needed here for public auth routes

// Public auth routes
router.post("/login", authController.login);

module.exports = router;
