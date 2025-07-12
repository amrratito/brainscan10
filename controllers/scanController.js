const fs = require('fs');
const path = require('path');
const sendEmail = require('../utils/sendEmail');
const mongoose = require('mongoose');
const axios = require("axios");
const FormData = require("form-data");
const ScanModel = require("../models/Scan");
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');





exports.uploadScan = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  try {
    const userId = req.user._id;

    // Generate unique file name
    const filename = `${uuidv4()}_${req.file.originalname}`;
    const savePath = path.join(__dirname, '../uploads', filename);

    // Save the image locally
    fs.writeFileSync(savePath, req.file.buffer);

    // Copy to Flask project folder
    const flaskPath = path.join(
      'E:/AI_Cancer/Khaled_CancerChat/Khaled_CancerChat/static',
      filename
    );

    // Ensure destination folder exists (optional but recommended)
    fs.copyFileSync(savePath, flaskPath);

    // 📤 Send to Flask for prediction
    const formData = new FormData();
    formData.append("image", fs.createReadStream(savePath)); // Send from disk instead of buffer

    const flaskResponse = await axios.post(
      "http://127.0.0.1:5001/predict",
      formData,
      {
        headers: formData.getHeaders(),
      }
    );

    const result = flaskResponse.data;

    const createdScan = await ScanModel.create({
      user: userId,
      image_path: filename,
      ...result,
    });

    res.status(200).json({
      message: "You Scan Diagnosis is Ready",
      scan: createdScan,
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ message: "Failed to process image", error: err.message });
  }
};

// Get All Scans of the Logged-in User
exports.getMyScans = async (req, res) => {
  try {
    const scans = await ScanModel.find({ user: req.user._id })
      .select("-__v")
      .sort({ createdAt: -1 });
    res
      .status(200)
      .json({ message: "Here's The All Scans", data: scans });
  } catch (error) {
    res.status(500).json(err);
  }
};

// Delete a Scan by ID
exports.deleteScan = async (req, res) => {
  try {
    const { id } = req.params;

    // Optional: Validate the ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid scan ID." });
    }

    const scan = await ScanModel.findById(id);

    // If no scan found
    if (!scan) {
      return res.status(404).json({ message: "Scan not found." });
    }

    // Ensure req.user is defined and has _id
    if (!req.user || !req.user._id) {
      return res
        .status(401)
        .json({ message: "Unauthorized. User info missing." });
    }

    // Check if user owns the scan
    if (scan.user.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Not authorized to delete this scan." });
    }

    await scan.deleteOne();

    res.status(200).json({ message: "Your Scan Deleted Successfully", data: null });
  } catch (error) {
    console.error("Delete scan error:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
};

// Export Scans To PDF
exports.exportScanToPDF = async (req, res) => {
  try {
    const scan = await ScanModel.findById(req.params.id).populate('user');

    if (!scan) {
      return res.status(404).json({ message: 'Scan not found' });
    }

    if (scan.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const filename = `ScanReport_${scan._id}.pdf`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/pdf');

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Register font
    const fontPath = path.join(__dirname, '../fonts/DejaVuSans.ttf');
    doc.registerFont('CustomFont', fontPath);
    doc.font('CustomFont');

    // Title
    doc
      .fontSize(22)
      .fillColor('#1a237e')
      .text('BrainScan Diagnosis Report', { align: 'center' })
      .moveDown(1.5);

    // User Info
    doc
      .fontSize(14)
      .fillColor('black')
      .text(`Name: ${scan.user.userName}`)
      .text(`Email: ${scan.user.email}`)
      .text(`Date: ${scan.createdAt.toDateString()}`)
      .moveDown();

    // Diagnosis Result
    doc
      .fontSize(16)
      .fillColor('#0d47a1')
      .text('Diagnosis Result', { underline: true })
      .moveDown(0.5);

    doc
      .fontSize(14)
      .fillColor('black')
      .text(`Diagnosis: ${scan.label || 'Not available'}`)
      .text(`Probability: ${scan.probability || 'Not available'}`)
      .moveDown();

    // Scan Image Section
    doc
      .fontSize(16)
      .fillColor('#0d47a1')
      .text('Scan Image', { align: 'center' })
      .moveDown();

    if (scan.image_path) {
      console.log('🧾 scan.image_path from DB:', scan.image_path);

      const imageFileName = scan.image_path.replace(/^uploads[\\/]/, '');
      console.log('📂 Final file name:', imageFileName);

      const imagePath = path.resolve(path.join(__dirname, `../uploads/${imageFileName}`));
      console.log('📁 Final full path:', imagePath);

      if (fs.existsSync(imagePath)) {
        console.log('✅ Image found, adding to PDF');
        doc.image(imagePath, {
          fit: [450, 350],
          align: 'center',
          valign: 'center',
        });
      } else {
        console.warn('❌ Image NOT found at:', imagePath);
        doc
          .fontSize(14)
          .fillColor('red')
          .text('⚠️ Image file not found on the server.', { align: 'center' });
      }
    } else {
      doc
        .fontSize(14)
        .fillColor('red')
        .text('⚠️ No image path provided for this scan.', { align: 'center' });
    }

    await new Promise((resolve, reject) => {
      doc.end();
      doc.on('end', () => {
        console.log('✅ PDF generation finished');
        resolve();
      });
      doc.on('error', (err) => {
        console.error('❌ PDF generation error:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('❌ PDF export error:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message });
    }
  }
};





