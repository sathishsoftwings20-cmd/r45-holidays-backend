// backend/middleware/ownership.middleware.js
const permitOwnerOrRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    const requesterId = req.user.id;
    const targetId = req.params.id?.toString();

    if (requesterId === targetId) return next();
    if (roles.includes(req.user.role)) return next();

    return res.status(403).json({ message: "Forbidden" });
  };
};

module.exports = { permitOwnerOrRole };
