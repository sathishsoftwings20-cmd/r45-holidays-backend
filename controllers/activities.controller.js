const path = require("path");
const fs = require("fs");
const Activity = require("../models/activities.model");
const City = require("../models/cities.model");

/**
 * Helper: Resolve City ID safely
 */
function resolveCityId(input, fallbackId = null) {
  if (!input) return fallbackId;
  if (typeof input === "string") return input;
  if (typeof input === "object" && (input._id || input.id)) {
    return String(input._id || input.id);
  }
  return fallbackId;
}

// ---------------------- Get All Activities ----------------------
exports.getAllActivities = async (req, res, next) => {
  try {
    const activities = await Activity.find({
      status: { $ne: "deleted" },
    })
      .populate({
        path: "city",
        match: { status: { $ne: "deleted" } },
        select: "name cityId status destination",
        populate: {
          path: "destination",
          select: "name status",
        },
      })
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    next(err);
  }
};

// ---------------------- Get Activity By ID ----------------------
exports.getActivityById = async (req, res, next) => {
  try {
    const activity = await Activity.findById(req.params.id)
      .populate({
        path: "city",
        select: "name cityId status destination",
        populate: {
          path: "destination",
          select: "name status",
        },
      })
      .populate("createdBy", "name")
      .populate("updatedBy", "name");

    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    res.json(activity);
  } catch (err) {
    next(err);
  }
};

// ---------------------- Create Activity ----------------------
exports.createActivity = async (req, res, next) => {
  try {
    const {
      name,
      city,
      price,
      status,
      startTime,
      duration,
      description,
      badge,
      gallery,
      inclusion,
      exclusion,
    } = req.body;

    if (!name || !city) {
      return res.status(400).json({
        message: "Activity name and city are required",
      });
    }

    // Resolve City ID
    const cityId = resolveCityId(city);
    if (!cityId) {
      return res.status(400).json({ message: "Invalid city provided" });
    }

    // Validate City
    const cityDoc = await City.findById(cityId);
    if (!cityDoc || cityDoc.status !== "published") {
      return res.status(400).json({
        message: "Activity can be created only under published cities",
      });
    }

    // Unique activity per city
    const existing = await Activity.findOne({
      name,
      city: cityId,
      status: { $ne: "deleted" },
    });

    if (existing) {
      return res.status(400).json({
        message: "Activity with this name already exists for this city",
      });
    }

    const activity = new Activity({
      name,
      city: cityId,
      price: Number(price) || 0,
      startTime,
      duration,
      description: description || "",
      badge: badge || "Curated Day",
      gallery: Array.isArray(gallery) ? gallery : [],
      inclusion: Array.isArray(inclusion) ? inclusion : [],
      exclusion: Array.isArray(exclusion) ? exclusion : [],
      status: ["published", "draft", "deleted"].includes(status)
        ? status
        : "draft",
      createdBy: req.user.id,
    });

    await activity.save();

    res.status(201).json({
      message: "Activity created successfully",
      activity,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------- Update Activity ----------------------
exports.updateActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      city,
      price,
      status,
      startTime,
      duration,
      description,
      badge,
      gallery,
      inclusion,
      exclusion,
    } = req.body;

    const activity = await Activity.findById(id);
    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    // Change City (if provided)
    if (city !== undefined) {
      const cityId = resolveCityId(city);
      const cityDoc = await City.findById(cityId);

      if (!cityDoc || cityDoc.status !== "published") {
        return res.status(400).json({
          message: "Activity can be moved only to published cities",
        });
      }

      activity.city = cityId;
    }

    // Name uniqueness check
    if (name && name !== activity.name) {
      const conflict = await Activity.findOne({
        _id: { $ne: activity._id },
        name,
        city: activity.city,
        status: { $ne: "deleted" },
      });

      if (conflict) {
        return res.status(400).json({
          message: "Activity name already exists for this city",
        });
      }

      activity.name = name;
    }

    if (price !== undefined) activity.price = Number(price) || 0;
    if (startTime !== undefined) activity.startTime = startTime;
    if (duration !== undefined) activity.duration = duration;
    if (description !== undefined) activity.description = description;
    if (badge !== undefined) activity.badge = badge;
    if (gallery !== undefined) activity.gallery = gallery;
    if (inclusion !== undefined) activity.inclusion = inclusion;
    if (exclusion !== undefined) activity.exclusion = exclusion;

    if (
      status !== undefined &&
      ["published", "draft", "deleted"].includes(status)
    ) {
      activity.status = status;
    }

    activity.updatedBy = req.user.id;
    await activity.save();

    res.json({
      message: "Activity updated successfully",
      activity,
    });
  } catch (err) {
    next(err);
  }
};

// ---------------------- Soft Delete Activity ----------------------
exports.deleteActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    activity.status = "deleted";
    activity.updatedBy = req.user.id;

    await activity.save();

    res.json({ message: "Activity deleted successfully" });
  } catch (err) {
    next(err);
  }
};

// ---------------------- Update Activity Cover Image ----------------------
exports.updateActivityCoverImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const activity = await Activity.findById(id).populate("city");
    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    // City must be published
    if (!activity.city || activity.city.status !== "published") {
      return res.status(400).json({
        message: "Activity cover can be updated only under published cities",
      });
    }

    // Delete old cover image
    if (
      activity.coverImage &&
      !activity.coverImage.includes("default-activity.png")
    ) {
      const oldPath = path.join(
        process.cwd(),
        activity.coverImage.replace(/^\//, ""),
      );
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    activity.coverImage = `/uploads/activities/${activity.activityId}/${req.file.filename}`;
    activity.updatedBy = req.user.id;

    await activity.save();

    res.json({
      message: "Activity cover image updated",
      coverImage: activity.coverImage,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- Upload Activity Gallery ----------------------
exports.uploadActivityGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findById(id);
    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No images uploaded" });
    }

    const newImages = req.files.map((file) => ({
      url: `/uploads/activities/${activity.activityId}/gallery/${file.filename}`,
      caption: "",
    }));

    activity.gallery.push(...newImages);
    activity.updatedBy = req.user.id;

    await activity.save();

    res.json({
      message: "Activity gallery images uploaded",
      gallery: activity.gallery,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ---------------------- Delete Activity Gallery Image ----------------------
exports.deleteActivityGalleryImage = async (req, res) => {
  try {
    const { id, index } = req.params;

    const activity = await Activity.findById(id);
    if (!activity || activity.status === "deleted") {
      return res.status(404).json({ message: "Activity not found" });
    }

    const image = activity.gallery[index];
    if (!image) {
      return res.status(404).json({ message: "Image not found" });
    }

    // Delete file from disk
    const imgPath = path.join(process.cwd(), image.url.replace(/^\//, ""));
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

    activity.gallery.splice(index, 1);
    activity.updatedBy = req.user.id;

    await activity.save();

    res.json({
      message: "Activity gallery image deleted",
      gallery: activity.gallery,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
