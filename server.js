const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require("path");
const multer = require("multer");

// Load environment variables
dotenv.config();

// Database connection
const connectDB = require("./config/db");
connectDB();

const app = express();

// CORS Configuration
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:8080",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Check without trailing slash
      const normalizedOrigin = origin.endsWith("/")
        ? origin.slice(0, -1)
        : origin;

      const isAllowed = allowedOrigins.some((allowed) => {
        const normalizedAllowed = allowed.endsWith("/")
          ? allowed.slice(0, -1)
          : allowed;
        return normalizedAllowed === normalizedOrigin;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      console.log(`CORS blocked: ${origin}`);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

// Body parser middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Welcome route
app.get("/", (req, res) => {
  res.json({
    message: "Travel API Server",
    version: "1.0.0",
  });
});

// API Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/destinations", require("./routes/destination.routes"));
app.use("/api/cities", require("./routes/cities.routes"));
app.use("/api/activities", require("./routes/activities.routes"));
app.use("/api/itinerary", require("./routes/itinerary.routes"));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Multer file size error
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB",
      });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files uploaded",
      });
    }
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${path.join(__dirname, "uploads")}`);
  console.log(`🌍 CORS allowed origins: ${allowedOrigins.join(", ")}`);
});
