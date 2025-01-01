const fs = require("fs");
const path = require("path");
const interval = 60 * 60 * 1000;

const upload = (req, res) => {
  try {
    const { dataUrl, name, type } = req.body;
    let data = null;
    let dataType = "base64";
    if (type == "png") {
      data = dataUrl.replace(/^data:image\/png;base64,/, "");
    } else if (type == "jpg" || type == "jpeg") {
      data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
    } else {
      return res.status(400).send("Unsupported file type");
    }
    const url = `/${name}.${type}`;
    const folderPath = path.join(__dirname, "../public");
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
    const filePath = path.join(__dirname, `../public${url}`);
    fs.writeFileSync(filePath, data, dataType);

    let uploadQueue = [];
    if (fs.existsSync(path.join(__dirname, "../uploadQueue.json"))) {
      uploadQueue = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../uploadQueue.json"))
      );
    }

    uploadQueue.push({
      url,
      created_at: new Date().getTime(),
    });

    fs.writeFileSync(
      path.join(__dirname, "../uploadQueue.json"),
      JSON.stringify(uploadQueue, null, 2)
    );

    res.json({
      success: true,
      message: "File uploaded successfully",
      url,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const autouploadQueue = () => {
  let uploadQueue = [];

  if (fs.existsSync(path.join(__dirname, "../uploadQueue.json"))) {
    uploadQueue = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../uploadQueue.json"))
    );
  }

  const timeNow = new Date().getTime();
  uploadQueue = uploadQueue.filter((data) => {
    if (timeNow - data.created_at >= interval) {
      fs.unlinkSync(path.join(__dirname, `../public${data.url}`));
      return false;
    }
    return true;
  });
  fs.writeFileSync(
    path.join(__dirname, "../uploadQueue.json"),
    JSON.stringify(uploadQueue, null, 2)
  );
};

setInterval(autouploadQueue, interval);

module.exports = {
  upload,
  autouploadQueue,
};
