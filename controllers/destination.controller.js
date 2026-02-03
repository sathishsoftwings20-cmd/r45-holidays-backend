// backend/controllers/destination.controller.js
const bcrypt = require("bcryptjs");
const Destination = require("../models/destination.model");
const path = require("path");
const fs = require("fs");

// Get all destinations
exports.getAllDestination = async (req, res, next) => {
  try {
    const destinations = await Destination.find();
    return res.json(destinations);
  } catch (error) {
    return next(error);
  }
};

// Get destination by ID
exports.getDestinationById = async (req, res, next) => {
  try {
    const destination = await Destination.findById(req.params.id);
    if (!destination)
      return res.status(404).json({ error: "destination not found" });
    return res.json(destination);
  } catch (error) {
    return res.status(500).json({ error: error.message || "Server error" });
  }
};

// Create Destination
exports.createDestination = async (req, res, next) => {
  try {
    const { name, status, badge, shortDescription } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Destination name is required" });
    }

    const existing = await Destination.findOne({ name });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Destination name already in use" });
    }

    // Create destination first (to generate destinationId)
    const destination = new Destination({
      name,
      badge: badge || "In Season",
      shortDescription: req.body.shortDescription || "",
      status: status || "draft",
      createdBy: req.user.id,
    });

    await destination.save(); // destinationId generated here

    return res.status(201).json({
      message: "Destination created successfully",
      destination,
    });
  } catch (err) {
    next(err);
  }
};

// Update destination by ID
exports.updateDestination = async (req, res, next) => {
  try {
    const { id } = req.params;
    const requester = req.user;

    if (!requester) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const requesterId = requester.id?.toString();
    const targetId = id.toString();

    // Permission check
    if (
      requesterId !== targetId &&
      !["Admin", "SuperAdmin", "Staff"].includes(requester.role)
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const destination = await Destination.findById(id);
    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    // Destination name uniqueness check
    if (req.body.name && req.body.name !== destination.name) {
      const conflict = await Destination.findOne({ name: req.body.name });
      if (conflict) {
        return res
          .status(400)
          .json({ message: "Destination name already in use" });
      }
    }

    // ✅ Allowed updates
    if (req.body.name !== undefined) destination.name = req.body.name;
    if (req.body.status !== undefined) destination.status = req.body.status;
    if (req.body.badge !== undefined) destination.badge = req.body.badge;
    if (req.body.shortDescription !== undefined)
      destination.shortDescription = req.body.shortDescription;
    destination.updatedBy = requester.id;

    await destination.save();

    return res.json({
      message: "Destination updated successfully",
      destination,
    });
  } catch (error) {
    return next(error);
  }
};

exports.updateCoverImage = async (req, res) => {
  try {
    const { id } = req.params; // target user id

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const destination = await Destination.findById(id);
    if (!destination) {
      return res.status(404).json({ message: "Destination not found" });
    }

    // delete old image
    if (destination.coverImage) {
      const oldPath = path.join(
        process.cwd(),
        destination.coverImage.replace(/^\//, ""),
      );
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    destination.coverImage = `/uploads/destination/${destination.destinationId}/${req.file.filename}`;
    await destination.save();

    res.json({
      message: "Destination cover image updated by admin",
      coverImage: destination.coverImage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- Soft Delete Destination ----------------------
exports.deleteDestination = async (req, res, next) => {
  try {
    const { id } = req.params;

    const destination = await Destination.findById(id);
    if (!destination || destination.status === "deleted") {
      return res.status(404).json({ message: "Destination not found" });
    }

    // Soft delete by setting status to "deleted"
    destination.status = "deleted";
    destination.updatedBy = req.user.id;

    await destination.save();

    return res.json({ message: "Destination moved to deleted successfully" });
  } catch (err) {
    next(err);
  }
};
