const mongoose = require("mongoose");

module.exports = async function generateUniqueSlug({
  modelName,
  value,
  excludeId,
}) {
  const baseSlug = value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();

  let slug = baseSlug;
  let counter = 0;

  while (
    await mongoose.models[modelName].exists({
      slug,
      _id: { $ne: excludeId },
    })
  ) {
    counter += 1;
    slug = `${baseSlug}-${counter}`;
  }

  return slug;
};
