const express = require("express");
const router = express.Router();
const upload = require("../controllers/upload");
const generate = require("../controllers/generate");

router.route("/api/upload").post(upload.upload);
router.route("/api/generate").get(generate.generate).post(generate.generate);


router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "route not found",
  });
});

module.exports = router;
