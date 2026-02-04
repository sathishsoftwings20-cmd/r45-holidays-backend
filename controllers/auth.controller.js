const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      userId: user.userId,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );
};

// Admin / Web login (email + password)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not registered" });

    if (user.status !== "active")
      return res.status(403).json({ message: "Account inactive or deleted" });

    const match = await user.comparePassword(password);
    if (!match) return res.status(400).json({ message: "Password incorrect" });

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};
