// backend/controllers/cities.controller.js
const path = require("path");
const fs = require("fs");
const Cities = require("../models/cities.model");
const Destination = require("../models/destination.model");

/**
 * Helper: safely extract destination _id from input which might be:
 * - a string id
 * - an object like { _id: '...' }
 * - undefined (then fallbackId is used)
 */
function resolveDestId(input, fallbackId = null) {
  if (!input) return fallbackId;
  if (typeof input === "string") return input;
  if (typeof input === "object" && (input._id || input.id)) {
    return String(input._id || input.id);
  }
  return fallbackId;
}

// ---------------------- Get All Cities ----------------------
exports.getAllCities = async (req, res, next) => {
  try {
    const cities = await Cities.find({
      status: { $ne: "deleted" }, // include draft + published (exclude deleted)
    })
      .populate({
        path: "destination",
        match: { status: { $ne: "deleted" } }, // exclude deleted destinations
        select: "name destinationId status",
      })
      .sort({ createdAt: -1 });

    return res.json(cities);
  } catch (err) {
    return next(err);
  }
};

// ---------------------- Get City By ID ----------------------
exports.getCityById = async (req, res, next) => {
  try {
    const city = await Cities.findById(req.params.id)
      .populate("destination", "name destinationId status")
      .populate("createdBy", "name")
      .populate("updatedBy", "name");

    if (!city || city.status === "deleted") {
      return res.status(404).json({ error: "City not found" });
    }

    return res.json(city);
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

// ---------------------- Create City ----------------------
exports.createCity = async (req, res, next) => {
  try {
    const {
      name,
      destination, // may be string or object
      badge,
      shortDescription,
      status,
      packages,
      gallery,
    } = req.body;

    if (!name || !destination) {
      return res.status(400).json({
        message: "City name and destination are required",
      });
    }

    // Resolve destination id safely
    const destId = resolveDestId(destination);
    if (!destId) {
      return res.status(400).json({ message: "Invalid destination provided" });
    }

    // Validate destination exists and is published
    const dest = await Destination.findById(destId);
    if (!dest || dest.status !== "published") {
      return res.status(400).json({
        message: "City can be created only under published destinations",
      });
    }

    // Unique city per destination
    const existing = await Cities.findOne({ name, destination: destId });
    if (existing) {
      return res.status(400).json({
        message: "City with this name already exists for this destination",
      });
    }

    const city = new Cities({
      name,
      destination: destId,
      badge: badge || "Affordable",
      shortDescription: shortDescription || "",
      status: ["published", "draft", "deleted"].includes(status)
        ? status
        : "draft",
      packages: packages || [],
      gallery: gallery || [],
      createdBy: req.user.id,
    });

    await city.save();

    res.status(201).json({
      message: "City created successfully",
      city,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------- Update City ----------------------
exports.updateCity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      status,
      badge,
      shortDescription,
      packages,
      gallery,
      destination, // may be string or object (optional)
    } = req.body;

    const city = await Cities.findById(id);
    if (!city || city.status === "deleted") {
      return res.status(404).json({ message: "City not found" });
    }

    // Resolve destination id safely
    const destId = resolveDestId(destination);
    if (!destId) {
      return res.status(400).json({ message: "Invalid destination provided" });
    }

    // Validate destination exists and is published
    const dest = await Destination.findById(destId);
    if (!dest || dest.status !== "published") {
      return res.status(400).json({
        message: "City can be updated only under published destinations",
      });
    }

    // Name uniqueness check against the target destination
    if (name && name !== city.name) {
      const conflict = await Cities.findOne({
        _id: { $ne: city._id },
        name,
        destination: destId,
      });
      if (conflict) {
        return res.status(400).json({
          message: "City name already in use for this destination",
        });
      }
    }

    // Update fields
    if (name !== undefined) city.name = name;
    if (badge !== undefined) city.badge = badge;
    if (shortDescription !== undefined)
      city.shortDescription = shortDescription;
    if (packages !== undefined) city.packages = packages;
    if (gallery !== undefined) city.gallery = gallery;

    if (destination !== undefined) {
      city.destination = destId;
    }

    if (
      status !== undefined &&
      ["published", "draft", "deleted"].includes(status)
    ) {
      city.status = status;
    }

    city.updatedBy = req.user.id;
    await city.save();

    res.json({
      message: "City updated successfully",
      city,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------- Update City Cover Image ----------------------
exports.updateCityCoverImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const city = await Cities.findById(id);
    if (!city) {
      return res.status(404).json({ message: "City not found" });
    }

    // Determine destination id: prefer payload if present, otherwise use city's current destination
    const payloadDest = req.body.destination;
    const destId = resolveDestId(payloadDest, String(city.destination));

    const destinationDoc = await Destination.findById(destId);
    if (!destinationDoc || destinationDoc.status !== "published") {
      return res.status(400).json({
        message:
          "City cover can only be updated for cities under published destinations",
      });
    }

    // Delete old image if exists and not default
    if (city.coverImage && !city.coverImage.includes("default-cities.png")) {
      const oldPath = path.join(
        process.cwd(),
        city.coverImage.replace(/^\//, ""),
      );
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    city.coverImage = `/uploads/cities/${city.cityId}/${req.file.filename}`;
    await city.save();

    res.json({
      message: "City cover image updated",
      coverImage: city.coverImage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- Soft Delete City ----------------------
exports.deleteCity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const city = await Cities.findById(id);
    if (!city || city.status === "deleted") {
      return res.status(404).json({ message: "City not found" });
    }

    // Soft delete by setting status to "deleted"
    city.status = "deleted";
    city.updatedBy = req.user.id;

    await city.save();

    return res.json({ message: "City moved to deleted successfully" });
  } catch (err) {
    next(err);
  }
};

exports.uploadCityGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const city = await Cities.findById(id);
    if (!city) return res.status(404).json({ message: "City not found" });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    // Save image URLs in DB
    const newImages = req.files.map((file) => ({
      url: `/uploads/cities/${city.cityId}/gallery/${file.filename}`,
      caption: "",
    }));

    city.gallery.push(...newImages);
    await city.save();

    res.json({
      message: "Gallery images uploaded",
      gallery: city.gallery,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCityGalleryImage = async (req, res) => {
  try {
    const { id, index } = req.params;

    const city = await Cities.findById(id);
    if (!city) return res.status(404).json({ message: "City not found" });

    const image = city.gallery[index];
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // delete file from disk
    const imgPath = path.join(process.cwd(), image.url.replace(/^\//, ""));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

    city.gallery.splice(index, 1);
    await city.save();

    res.json({
      message: "Gallery image deleted",
      gallery: city.gallery,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
