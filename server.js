const express   = require("express");
const mongoose  = require("mongoose");
const fs        = require("fs");
const cors      = require("cors");
const helmet    = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// ── Validate required env vars ─────────────────────────────
const REQUIRED_ENV = ["MONGO_URI", "SECRET_KEY", "API_KEY", "ADMIN_API_KEY"];
const missingEnv   = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`❌ Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

const datasetRoutes  = require("./routes/datasetRoutes");
const accessRoutes   = require("./routes/accessRoutes");
const disasterRoutes = require("./routes/disasterRoutes");
const systemRoutes   = require("./routes/systemRoutes");
const { apiKey }     = require("./middleware/apiKey");

const app = express();

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
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "50kb" }));

// ── Rate limiting ─────────────────────────────────────────
//
// WHY the old limits were wrong:
//   The frontend has 5 components polling simultaneously:
//     - DatasetTable:  every 3s  → 20 req/min
//     - BlockchainLog: every 3s  → 20 req/min
//     - DataRequester: every 3s  → 20 req/min (categories)
//     - Analytics:     every 5s  → 12 req/min
//     - DisasterCenter:every 5s  → 12 req/min
//   Total: 84 req/min = 1,260 req per 15-min window
//   Old limit was 100 per 15 min — hit the wall in ~72 seconds.
//
// NEW limits are set generously for a prototype with 1-2 users.
// They still protect against real abuse (scrapers, brute-force)
// while letting normal UI polling work without interruption.

// Global: 2,000 per 15 min (~133/min) — covers normal UI usage
// with headroom for spikes (e.g. Live Data Generator running)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please try again later" }
});
app.use(globalLimiter);

// Access requests: stricter — 100 per 15 min
// Prevents brute-forcing role/attribute combinations.
// Normal use: user clicks "Request Access" a handful of times per session.
const accessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many access requests — please wait before trying again" }
});

// Write operations: 200 per 15 min
// Covers CSV imports (many rows) + manual uploads + live generator writes
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many write requests — please slow down" }
});

// ── MongoDB ───────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// ── Health check (public) ─────────────────────────────────
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

// ── API key protection on all /api routes ─────────────────
app.use("/api", apiKey);

// ── Routes with targeted rate limits ─────────────────────
app.use("/api/dataset",  datasetRoutes);
app.use("/api/access",   accessLimiter, accessRoutes);
app.use("/api/disaster", disasterRoutes);
app.use("/api/system",   systemRoutes);

// Write limiter on upload/import specifically
app.use("/api/dataset/upload", writeLimiter);
app.use("/api/dataset/import", writeLimiter);

// ── 404 ───────────────────────────────────────────────────
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
  console.log(`📍 API: http://localhost:${PORT}/api`);
  console.log(`🔒 API key protection active`);
  console.log(`⚡ Rate limits: 2000/15min global, 100/15min access, 200/15min writes`);
});