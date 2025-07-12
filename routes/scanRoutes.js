const express = require("express");
const router = express.Router();
const {
  uploadScan,
  getMyScans,
  getMyScanById,
  deleteScan,
  deleteAllUserScans,
  exportScanToPDF,
} = require("../controllers/scanController");
const { protect } = require("../middlewares/authMiddleware");
const upload = require("../middlewares/uploadMiddleware");
const resizeScanImage = require("../utils/cloudinaryStorage");
const uploadSingleImage = require("../middlewares/multerMiddleware");

router.post(
  "/upload",
  protect,
  uploadSingleImage("scanImage"),
  resizeScanImage,
  uploadScan
);


//Get All User's Scan
router.get('/my-scans', protect, getMyScans);


//Get Single Scan By ID
router.get("/my/:id", protect, getMyScanById);


// Delete user's scan By ID
router.delete('/delete/:id', protect, deleteScan);

//Delete All Scans
router.delete("/delete-all",protect, deleteAllUserScans);


// Exports user's scan to PDF
router.get('/export/:id', protect, exportScanToPDF);

module.exports = router;
