const fs = require("fs");
const path = require("path");
const interval = 60 * 60 * 1000;

const upload = (req, res) => {
  const { dataUrl, name, type } = req.body;
  let data = null;
  let dataType = "base64";
  if (type == "svg") {
    data = dataUrl;
    dataType = "utf8";
  } else if (type == "png") {
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

  let removeQueue = [];
  if (fs.existsSync(path.join(__dirname, "../removeQueue.json"))) {
    removeQueue = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../removeQueue.json"))
    );
  }

  removeQueue.push({
    url,
    created_at: new Date().getTime(),
  });

  fs.writeFileSync(
    path.join(__dirname, "../removeQueue.json"),
    JSON.stringify(removeQueue, null, 2)
  );

  res.json({
    success: true,
    message: "File uploaded successfully",
    url,
  });
};

const autoRemoveQueue = () => {
  let removeQueue = [];

  if (fs.existsSync(path.join(__dirname, "../removeQueue.json"))) {
    removeQueue = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../removeQueue.json"))
    );
  }

  const timeNow = new Date().getTime();
  removeQueue = removeQueue.filter((data) => {
    if (timeNow - data.created_at >= interval) {
      fs.unlinkSync(path.join(__dirname, `../public${data.url}`));
      return false;
    }
    return true;
  });
  fs.writeFileSync(
    path.join(__dirname, "../removeQueue.json"),
    JSON.stringify(removeQueue, null, 2)
  );
};

setInterval(autoRemoveQueue, interval);

module.exports = {
  upload,
  autoRemoveQueue,
};
