const path = require("path");
const express = require("express");
const app = express();
var config = require("./config.json");
const router = require("./routes");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.render("home");
});

Object.keys(config).forEach((key) => {
  const methodHandlers = {
    get: app.get.bind(app),
    post: app.post.bind(app),
  };

  (config[key].method || []).forEach((method) => {
    methodHandlers[method](`/${key}`, function (req, res) {
      const dataHandlers = {
        get: req.query,
        post: req.body,
      };

      let data = {};
      Object.keys(config[key].data || {}).forEach((dataKey) => {
        data[dataKey] =
          dataHandlers[method][dataKey] || config[key].data[dataKey];
      });

      res.render(config[key].view || key, data);
    });
  });
});

app.use(router);

app.listen(3201);
console.log("run at: http://localhost:3201");
