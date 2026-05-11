const express  = require("express");
const mongoose = require("mongoose");
const fs       = require("fs");
const cors     = require("cors");
const helmet   = require("helmet");                        // SEC-04
const rateLimit = require("express-rate-limit");           // SEC-06
require("dotenv").config();

// ── Validate required env vars before anything else ────────
const REQUIRED_ENV = ["MONGO_URI", "SECRET_KEY", "API_KEY", "ADMIN_API_KEY"];
const missingEnv   = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(", ")}`);
  console.error("   Add them to your .env file and restart the server.");
  process.exit(1);
}

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const datasetRoutes  = require("./routes/datasetRoutes");
const accessRoutes   = require("./routes/accessRoutes");
const disasterRoutes = require("./routes/disasterRoutes");
const systemRoutes   = require("./routes/systemRoutes");
const { apiKey }     = require("./middleware/apiKey");    // SEC-01

const app = express();

// ── SEC-04: Security headers via Helmet ───────────────────
// Adds X-Frame-Options, Content-Security-Policy,
// X-Content-Type-Options, Strict-Transport-Security, etc.
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5000",
  process.env.FRONTEND_URL,
].filter(Boolean).map(o => o.replace(/\/$/, ""));

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, "");
    if (ALLOWED_ORIGINS.includes(cleanOrigin)) return callback(null, true);
    if (cleanOrigin.endsWith(".vercel.app")) return callback(null, true);
    console.warn(`🚫 CORS blocked origin: ${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods:     ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  // SEC-01: expose x-api-key as an allowed request header
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ── SEC-12: Explicit JSON body size limit ─────────────────
app.use(express.json({ limit: "50kb" }));

// ── SEC-06: Global rate limiter ───────────────────────────
// 100 requests per 15 minutes per IP across all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please try again later" }
});
app.use(globalLimiter);

// ── SEC-06: Stricter limiter for access requests ──────────
// Prevents brute-forcing which role/attribute combinations work
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many access requests — please wait before trying again" }
});

// ── MongoDB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ── Health check (public — no API key needed) ─────────────
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date(),
    services: {
      database:           mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      disasterMonitoring: "active"
    }
  });
});

// ── SEC-01: API key middleware applied to all /api routes ──
app.use("/api", apiKey);

// ── Routes ────────────────────────────────────────────────
app.use("/api/dataset",  datasetRoutes);
app.use("/api/access",   accessLimiter, accessRoutes);  // SEC-06: stricter limit on access
app.use("/api/disaster", disasterRoutes);
app.use("/api/system",   systemRoutes);

// ── 404 handler ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// ── Global error handler ──────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}/api`);
  console.log(`🔒 API key protection active on all /api/* routes`);
  console.log(`🚨 Disaster monitoring enabled at http://localhost:${PORT}/api/disaster`);
});