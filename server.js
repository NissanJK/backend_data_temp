const express = require("express");
const mongoose = require("mongoose");
const fs = require("fs");
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");
const cors = require("cors");
require("dotenv").config();

const datasetRoutes = require("./routes/datasetRoutes");
const accessRoutes = require("./routes/accessRoutes");
const disasterRoutes = require("./routes/disasterRoutes");
const systemRoutes = require("./routes/systemRoutes"); // NEW

const app = express();

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

app.use(express.json());

// MongoDB connection (without deprecated options for v5+ compatibility)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/dataset", datasetRoutes);
app.use("/api/access", accessRoutes);
app.use("/api/disaster", disasterRoutes);
app.use("/api/system", systemRoutes); // NEW: System management routes

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date(),
    services: {
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      disasterMonitoring: "active"
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", err);
  res.status(500).json({ 
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 API available at http://localhost:${PORT}/api`);
  console.log(`🚨 Disaster monitoring enabled at http://localhost:${PORT}/api/disaster`);
});
