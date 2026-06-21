const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const config = require("../config.json");

const getBrowserPath = () => {
  const paths = [
    // Windows
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    // Linux / Ubuntu / Debian
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/snap/bin/chromium",
    "/usr/bin/microsoft-edge",
    "/usr/bin/microsoft-edge-stable",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};


const generate = async (req, res) => {
  let browser = null;
  try {
    const template = req.query.template || req.body.template;
    if (!template) {
      return res.status(400).json({
        success: false,
        message: "Template parameter is required"
      });
    }

    if (!config[template]) {
      return res.status(400).json({
        success: false,
        message: `Invalid template: '${template}'`
      });
    }

    const browserPath = getBrowserPath();
    if (!browserPath) {
      return res.status(500).json({
        success: false,
        message: "No compatible browser (Chrome or Edge) found on the server"
      });
    }

    // Prepare query parameters to pass to the template page
    const params = { ...req.query, ...req.body };
    delete params.template; // Remove template from query string

    // Also default download parameter to false so we don't trigger download in puppeteer window
    params.download = "false";

    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      searchParams.set(key, params[key]);
    });

    const port = process.env.PORT || 3003;
    const targetUrl = `http://localhost:${port}/${template}?${searchParams.toString()}`;

    // Get wrapper ID and output type from config
    const templateConfig = config[template];
    const wrapperId = (templateConfig.data && templateConfig.data.wrapper) || "wrapper";
    const defaultType = (templateConfig.data && templateConfig.data.type) || "png";
    const type = req.query.type || req.body.type || defaultType;

    // Check if output directory exists
    const publicDir = path.join(__dirname, "../public");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir);
    }

    // Launch puppeteer
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    
    // Set a viewport size (good to make it large enough so elements don't get squished)
    await page.setViewport({ width: 1280, height: 1024 });

    // Navigate to local template rendering URL
    await page.goto(targetUrl, { waitUntil: "networkidle0" });

    // Find the wrapper element
    const element = await page.$(`#${wrapperId}`);
    if (!element) {
      return res.status(500).json({
        success: false,
        message: `Wrapper element #${wrapperId} not found on the page`
      });
    }

    // Take screenshot of the wrapper element
    // puppeteer's screenshot supports type: 'png' or 'jpeg' (not jpg, mapping jpg/jpeg to jpeg)
    let ssType = "png";
    if (type === "jpg" || type === "jpeg") {
      ssType = "jpeg";
    }

    const timeNow = new Date().getTime();
    const fileName = `hti-${timeNow}-image.${type}`;
    const filePath = path.join(publicDir, fileName);

    await element.screenshot({
      path: filePath,
      type: ssType,
      quality: ssType === "jpeg" ? 100 : undefined
    });

    // Write to uploadQueue.json for autodelete
    let uploadQueue = [];
    const queuePath = path.join(__dirname, "../uploadQueue.json");
    if (fs.existsSync(queuePath)) {
      try {
        uploadQueue = JSON.parse(fs.readFileSync(queuePath));
      } catch (err) {
        uploadQueue = [];
      }
    }

    const url = `/${fileName}`;
    uploadQueue.push({
      url,
      created_at: timeNow
    });

    fs.writeFileSync(queuePath, JSON.stringify(uploadQueue, null, 2));

    if (req.query.json === "true" || req.body.json === true) {
      return res.json({
        success: true,
        type,
        url
      });
    } else {
      return res.sendFile(filePath);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

module.exports = {
  generate
};
