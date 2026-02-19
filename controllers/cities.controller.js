// backend/controllers/cities.controller.js
const path = require("path");
const fs = require("fs");
const Cities = require("../models/cities.model");
const Destination = require("../models/destination.model");
const { convertINRtoUSDForDisplay } = require("../services/currency.service");

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
function validatePackageField(pkg, label = "package") {
  if (!pkg) return { ok: true };
  // sanitize numbers
  const minDays = Number(pkg.minDays);
  const maxDays = Number(pkg.maxDays);
  const price = Number(pkg.price || 0);

  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) {
    return { ok: false, message: `${label}: minDays/maxDays must be numbers` };
  }
  if (minDays < 1 || maxDays < 1) {
    return { ok: false, message: `${label}: minDays/maxDays must be >= 1` };
  }
  if (minDays >= maxDays) {
    return {
      ok: false,
      message: `${label}: minDays must be less than maxDays`,
    };
  }
  if (price < 0) {
    return { ok: false, message: `${label}: price must be >= 0` };
  }
  return { ok: true };
}

// ---------------------- Get All Cities ----------------------
exports.getAllCities = async (req, res, next) => {
  try {
    const cities = await Cities.find({
      status: { $ne: "deleted" },
    })
      .populate({
        path: "destination",
        match: { status: { $ne: "deleted" } },
        select: "name destinationId status",
      })
      .sort({ createdAt: -1 });

    const formatted = await Promise.all(
      cities.map(async (city) => {
        const cityObj = city.toObject();

        // Package fields list
        const pkgFields = [
          "package_7_8_Days",
          "package_9_10_Days",
          "package_11_12_Days",
          "package_13_14_Days",
        ];

        // Convert package prices
        for (const field of pkgFields) {
          if (cityObj[field] && cityObj[field].price !== undefined) {
            cityObj[field].usdPrice = await convertINRtoUSDForDisplay(
              cityObj[field].price,
            );
          }
        }

        // Convert transfer prices
        if (cityObj.transfer && cityObj.transfer.length > 0) {
          cityObj.transfer = await Promise.all(
            cityObj.transfer.map(async (t) => ({
              ...t,
              usdPrice: await convertINRtoUSDForDisplay(t.price),
            })),
          );
        }

        return cityObj;
      }),
    );

    return res.json(formatted);
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

    const cityObj = city.toObject();

    // Package fields
    const pkgFields = [
      "package_7_8_Days",
      "package_9_10_Days",
      "package_11_12_Days",
      "package_13_14_Days",
    ];

    // Convert package prices
    for (const field of pkgFields) {
      if (cityObj[field] && cityObj[field].price !== undefined) {
        cityObj[field].usdPrice = await convertINRtoUSDForDisplay(
          cityObj[field].price,
        );
      }
    }

    // Convert transfer prices
    if (cityObj.transfer && cityObj.transfer.length > 0) {
      cityObj.transfer = await Promise.all(
        cityObj.transfer.map(async (t) => ({
          ...t,
          usdPrice: await convertINRtoUSDForDisplay(t.price),
        })),
      );
    }

    return res.json(cityObj);
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
      // new package fields (optional)
      package_7_8_Days,
      package_9_10_Days,
      package_11_12_Days,
      package_13_14_Days,
      transfer,
      gallery,
      minimumRequiredDays,
      // optional if you use it
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

    // Build payload but don't override model defaults when field is omitted
    const payload = {
      name,
      destination: destId,
      badge: badge || "Affordable",
      shortDescription: shortDescription || "",
      status: ["published", "draft", "deleted"].includes(status)
        ? status
        : "draft",
      createdBy: req.user.id,
    };

    // Conditionally attach package fields only if provided by client
    if (package_7_8_Days !== undefined)
      payload.package_7_8_Days = package_7_8_Days;
    if (package_9_10_Days !== undefined)
      payload.package_9_10_Days = package_9_10_Days;
    if (package_11_12_Days !== undefined)
      payload.package_11_12_Days = package_11_12_Days;
    if (package_13_14_Days !== undefined)
      payload.package_13_14_Days = package_13_14_Days;

    if (transfer !== undefined) payload.transfer = transfer;
    if (gallery !== undefined) payload.gallery = gallery;
    if (minimumRequiredDays !== undefined)
      payload.minimumRequiredDays = minimumRequiredDays;

    const city = new Cities(payload);
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
      // new package fields (optional)
      package_7_8_Days,
      package_9_10_Days,
      package_11_12_Days,
      package_13_14_Days,
      gallery,
      transfer,
      destination, // may be string or object (optional)
      minimumRequiredDays,
    } = req.body;

    const city = await Cities.findById(id);
    if (!city || city.status === "deleted") {
      return res.status(404).json({ message: "City not found" });
    }

    // Resolve destination id safely (fallback to existing city.destination)
    const destId = resolveDestId(destination, String(city.destination));
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

    // Update fields only when provided (keeps defaults intact)
    if (name !== undefined) city.name = name;
    if (badge !== undefined) city.badge = badge;
    if (shortDescription !== undefined)
      city.shortDescription = shortDescription;
    if (gallery !== undefined) city.gallery = gallery;
    if (transfer !== undefined) city.transfer = transfer;
    if (minimumRequiredDays !== undefined)
      city.minimumRequiredDays = minimumRequiredDays;

    // Set package fields only if they were sent by client
    if (package_7_8_Days !== undefined)
      city.package_7_8_Days = package_7_8_Days;
    if (package_9_10_Days !== undefined)
      city.package_9_10_Days = package_9_10_Days;
    if (package_11_12_Days !== undefined)
      city.package_11_12_Days = package_11_12_Days;
    if (package_13_14_Days !== undefined)
      city.package_13_14_Days = package_13_14_Days;

    // Update destination only if payload included
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

// get Cities By Destination
exports.getCitiesByDestination = async (req, res, next) => {
  try {
    const { destinationId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 10);

    const filter = { destination: destinationId };
    if (status) {
      filter.status = status;
    } else {
      // By default exclude deleted
      filter.status = { $ne: "deleted" };
    }

    const cities = await Cities.find(filter)
      .populate("destination", "name") // use only fields that exist
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .sort({ createdAt: -1 });

    // Convert INR to USD for packages and transfers (like in getAllCities)
    const formatted = await Promise.all(
      cities.map(async (city) => {
        const cityObj = city.toObject();
        const pkgFields = [
          "package_7_8_Days",
          "package_9_10_Days",
          "package_11_12_Days",
          "package_13_14_Days",
        ];
        for (const field of pkgFields) {
          if (cityObj[field] && cityObj[field].price !== undefined) {
            cityObj[field].usdPrice = await convertINRtoUSDForDisplay(
              cityObj[field].price,
            );
          }
        }
        if (cityObj.transfer && cityObj.transfer.length > 0) {
          cityObj.transfer = await Promise.all(
            cityObj.transfer.map(async (t) => ({
              ...t,
              usdPrice: await convertINRtoUSDForDisplay(t.price),
            })),
          );
        }
        return cityObj;
      }),
    );

    const total = await Cities.countDocuments(filter);

    res.json({
      success: true,
      data: formatted,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    next(error); // use central error handler
  }
};
