const router = require("express").Router();
const multer = require("multer");
const ctrl   = require("../controllers/datasetController");

// SEC-05: File type whitelist + 10MB size cap
// Previously: multer({ dest: "uploads/" }) with no restrictions
// — any file type and unlimited size was accepted.
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024   // 10 MB maximum
  },
  fileFilter: (req, file, cb) => {
    const isCSV =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/vnd.ms-excel" ||  // some OS sends this for .csv
      file.originalname.toLowerCase().endsWith(".csv");

    if (isCSV) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  }
});

// Multer error handler — returns 400 with a clear message
// instead of a 500 internal server error
const handleUpload = (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ message: "File too large — maximum size is 10MB" });
      }
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

router.post("/upload", ctrl.upload);
router.post("/import", handleUpload, ctrl.importCSV);
router.get("/export", ctrl.exportCSV);
router.get("/", ctrl.getAll);

module.exports = router;