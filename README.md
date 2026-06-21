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

## ⚡ Server-Side Image Generation API

We support generating images directly from the server-side using a headless browser without any manual click from the frontend.

### Endpoint: `/api/generate` (GET & POST)

By default, this endpoint returns the binary image file directly (`image/png` or `image/jpeg`).

#### Parameters:
- `template` (string, required): The template key to render (e.g. `tweet`, `meme`, `wa`, `code`, etc.)
- `json` (boolean, optional): Set to `true` to return a JSON response containing the saved image URL instead of streaming the binary image.
- Any other template-specific variables (e.g. `username`, `content`, `textTop`, `textBottom`, `img`, etc.)

#### Examples:

**Direct Image (GET)**:
```http
GET /api/generate?template=tweet&username=John&content=Hello%20World!
```

**JSON Response (POST)**:
```http
POST /api/generate
Content-Type: application/json

{
  "template": "meme",
  "img": "https://i.imgflip.com/30b1gx.jpg",
  "textTop": "WHEN CODE WORKS",
  "textBottom": "FIRST TRY",
  "json": true
}
```

