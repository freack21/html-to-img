# HTML-to-img

## 📑 Description

The project to create an HTML page that the element in it can be used as an image. This project is utilized by [html-to-image](https://www.npmjs.com/package/html-to-image) library to convert element HTML to image.

## 📚 Libraries

This project utilizes several [Node.js](https://nodejs.org/en) libraries:

| Library         | Purpose                                                                                             |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `express`       | Acts as the primary framework for building the backend, managing routes, and serving API endpoints. |
| `html-to-image` | Generates an image from a DOM node using HTML5 canvas and SVG.                                      |
| `ejs`           | View engine for create HTML pages                                                                   |

## 🏃‍➡️ How To Run

1. Clone this GitHub Repository

   ```https
   git clone https://github.com/freack21/html-to-img.git
   ```

   or

   ```ssh
   git clone git@github.com:freack21/html-to-img.git
   ```

2. Change directory to `html-to-img` folder

   ```
   cd html-to-img
   ```

3. You can configure your `config.json` with your own preferences

4. Install dependencies

   ```
   npm install
   ```

5. Run the project by execute this command

   ```
   npm run start
   ```

## ⚙️ Configuration and Customization

The `config.json` contains several configuration, such as:

```
{
  "path": {
    "data": {object of properties that used for the EJS file},
    "method": [array of http method allowed for this path ("get" | "post")],
    "view": "the view / EJS file name in views folder for this path"
  }
}
```

The `path` is user-defined, so you can make your own HTML to image page!
