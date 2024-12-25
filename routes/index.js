const express = require("express");
const router = express.Router();
const upload = require("../controllers/upload");

router.route("/api/upload").post(upload.upload);

router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "route not found",
  });
});

module.exports = router;
