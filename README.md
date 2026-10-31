# html-to-img

Template-driven image generation, built as an engine plus a web app.

- **Engine.** Templates are JSON documents: a layout tree of boxes, text and images, plus typed params. The engine renders them to PNG, JPEG or SVG with [Satori](https://github.com/vercel/satori) and [resvg](https://github.com/yisibl/resvg-js), so there is no headless browser. A render takes roughly 40–300 ms.
- **API.** `POST /api/v1/render` returns the image bytes or a shareable URL. Callers can be guests (rate-limited, watermarked) or authenticate with an API key tied to a plan.
- **Web app.** A React studio with live preview, a user dashboard (usage, history, API keys) and an admin panel: a JSON template editor with live preview, plus users, plans and settings.

> Version 2 replaces the original EJS + Puppeteer app. See [Migrating from v1](#migrating-from-v1).

## Contents

- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Template format](#template-format)
- [API](#api)
- [Plans, quotas and guest mode](#plans-quotas-and-guest-mode)
- [Security notes](#security-notes)
- [Deployment](#deployment)
- [Migrating from v1](#migrating-from-v1)

## Architecture

```
html-to-img/
├── server/                 Node.js API + render engine (Express 5, ESM)
│   ├── src/engine/         JSON template → Satori element → SVG → PNG/JPEG
│   ├── src/routes/         /api/v1 routes (render, account, admin)
│   ├── src/services/       users, plans, templates, renders, settings, storage
│   ├── src/db/             node:sqlite connection, SQL migrations, seed
│   ├── templates/*.json    bundled templates, seeded into an empty database
│   └── test/               node:test suites (engine + API)
├── web/                    React 19 + Vite + Tailwind CSS 4 single-page app
├── ecosystem.config.cjs    PM2 process file
└── deploy.md               Ubuntu VPS guide (Nginx + PM2)
```

In production a single Node process serves the API, the rendered files (`/files/*`) and the built web app (`web/dist`). Data lives in `data/`: the SQLite database `app.db` and rendered images in `storage/`.

| Concern | Choice |
| --- | --- |
| Rendering | Satori (flexbox layout → SVG) + resvg (SVG → PNG), jpeg-js for JPEG |
| Fonts | Bundled via `@fontsource/*`: Inter, Poppins, Figtree, Playfair Display, Anton, JetBrains Mono |
| Emoji | Twemoji SVGs fetched from jsDelivr and cached in memory |
| Database | `node:sqlite` (built into Node ≥ 22.13), WAL mode, no native build step |
| Validation | zod schemas for templates, params, plans, settings and requests |
| Auth | scrypt password hashes, HttpOnly session cookies, hashed API keys (`hti_…`) |

## Quick start

Requirements: **Node.js 22.13 or newer**.

```bash
npm install
npm test                 # engine + API tests
npm run build            # builds web/dist
npm start                # http://127.0.0.1:3003
```

Create the first admin account (prints a generated password unless `ADMIN_PASSWORD` is set):

```bash
npm run create-admin -- --email you@example.com --name "Your Name"
```

For development, run the API and the Vite dev server in two terminals. Vite proxies `/api` and `/files` to port 3003:

```bash
npm run dev:server
npm run dev:web          # http://localhost:5173
```

## Configuration

All settings are optional environment variables, read from `.env` in the repo root (see [`.env.example`](.env.example)).

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` / `HOST` | `3003` / `127.0.0.1` | Listen address |
| `NODE_ENV` | — | `production` marks session cookies `Secure` |
| `PUBLIC_URL` | request origin | Origin used in returned image URLs |
| `TRUST_PROXY` | `loopback` | Express `trust proxy` (client IPs for quotas and rate limits) |
| `DATA_DIR` | `data` | Base directory for `app.db` and `storage/` |
| `DATABASE_PATH`, `STORAGE_DIR` | under `DATA_DIR` | Override individual paths |
| `MAX_IMAGE_BYTES` | `5242880` | Max size of a remote or uploaded image |
| `IMAGE_TIMEOUT_MS` | `5000` | Remote image fetch timeout |
| `ALLOW_PRIVATE_IMAGE_HOSTS` | `false` | Allow image URLs that resolve to private IPs (tests only) |
| `EMOJI_BASE_URL` | Twemoji on jsDelivr | Empty string disables emoji images |

Runtime settings (guest limits, watermark text, registration) are edited in **Admin → Settings**.

## Template format

A template has metadata (`slug`, `name`, `description`, `category`, `isActive`, `isPremium`) and a `definition`:

```json
{
  "width": 600,
  "height": 315,
  "params": {
    "title": { "type": "string", "label": "Title", "default": "Hello", "maxLength": 80 },
    "theme": { "type": "enum", "options": ["dark", "light"], "default": "dark" },
    "avatar": { "type": "image", "default": "" },
    "verified": { "type": "boolean", "default": true }
  },
  "root": {
    "type": "box",
    "style": {
      "padding": 32,
      "fontFamily": "Inter",
      "backgroundColor": { "$switch": "theme", "cases": { "dark": "#000" }, "default": "#fff" }
    },
    "children": [
      { "type": "image", "if": "avatar", "src": "{{avatar}}", "style": { "width": 64, "height": 64, "borderRadius": 32 } },
      { "type": "text", "text": "{{title}}", "style": { "fontSize": 48, "fontWeight": 700 } },
      { "type": "text", "if": "theme == dark", "text": "Dark mode ✨" }
    ]
  }
}
```

- **Nodes:** `box` (a flex container with `children`), `text` (`text`) and `image` (`src`). Any node can take an `if` condition: `"param"`, `"!param"`, `"param == value"` or `"param != value"`.
- **Values:** `{{param}}` placeholders work in text and style strings. A lone placeholder such as `"{{fontSize}}"` keeps its type. `{ "$switch": "param", "cases": {…}, "default": … }` picks a value per param.
- **Param types:** `string` (`maxLength`, `multiline`), `number` (`min`, `max`), `color` (hex, `rgb()`, `hsl()` or named), `boolean`, `enum` (`options`), and `image` (an http(s) URL or a base64 data URI; PNG, JPEG, GIF or WebP).
- **Styles:** camelCase CSS from the [subset Satori supports](https://github.com/vercel/satori#css): flexbox (no grid), absolute positioning, borders, radii, shadows, gradients and transforms. Nodes default to `box-sizing: border-box`. `url()` is rejected in styles; use an `image` node instead.
- **Validation:** definitions are validated when saved. Unknown param references, unknown fonts, invalid defaults and trees over 300 nodes are rejected with per-path messages.

Admins create and edit templates live in **Admin → Templates**. The 13 bundled templates in [`server/templates`](server/templates) are only seeded into an empty database.

## API

The base URL is `/api/v1`. Responses are `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details?" } }`. The full reference is served by the app at `/docs`.

```bash
# Image bytes
curl -X POST https://img.example.com/api/v1/render \
  -H "Authorization: Bearer $HTI_KEY" -H "Content-Type: application/json" \
  -d '{"template":"qc","format":"png","scale":2,"params":{"name":"Fikri","msg":"Hello!"}}' \
  -o qc.png

# Stored file + JSON with a URL (kept for the plan's retention period)
curl -X POST https://img.example.com/api/v1/render \
  -H "Authorization: Bearer $HTI_KEY" -H "Content-Type: application/json" \
  -d '{"template":"quote","output":"url","params":{"quote":"Stay hungry."}}'

# GET form for <img src> and bots; every non-reserved query key is a param
curl "https://img.example.com/api/v1/render?template=qc&name=Fikri&msg=Hi" -o qc.png
```

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET/POST /render` | guest, session or API key | Render (`template`, `params`, `format`, `scale`, `output`) |
| `POST /preview` | anyone (rate-limited) | Watermarked preview; admins can preview a draft `definition` |
| `GET /templates`, `/templates/:slug` | public | Template catalog with param specs |
| `GET /templates/:slug/thumbnail.png` | public | Cached thumbnail rendered with default params |
| `GET /plans` | public | Active plans |
| `POST /auth/register`, `/auth/login`, `/auth/logout`, `GET /auth/me` | — | Session auth; `me` also reports guest usage |
| `GET /me/renders`, `PATCH /me`, `POST /me/password` | session or API key | Account |
| `GET/POST/DELETE /me/api-keys` | session | API key management |
| `/admin/*` | admin session | Stats, templates, users, plans, settings |

Every render response carries `X-Quota-Limit`, `X-Quota-Remaining` and `X-Render-Id` headers.

## Free mode (default) and pricing

Pricing is **off by default**. In this free mode the API needs no account or API key. Renders are watermark-free, every template is available (including premium ones) and the scale goes up to 4×. The only limit is **5 images per minute per IP**, counted over a rolling 60-second window:

- Each render response carries `X-RateLimit-Limit` and `X-RateLimit-Remaining`.
- Over the limit, the API returns `429 rate_limited` with a `Retry-After` header.
- Failed renders and studio previews don't count.
- IPv6 clients are grouped per /64.

The limit and link retention are editable in **Admin → Settings**. The **Enable plans & pricing** switch on the same page turns on everything below and shows the pricing pages again.

## Plans, quotas and guest mode (pricing enabled)

| | Guest | Free | Pro | Business |
| --- | --- | --- | --- | --- |
| Quota | 10 / day per IP | 100 / month | 2,000 / month | 10,000 / month |
| Watermark | yes | no | no | no |
| Max scale | 1x | 1x | 2x | 3x |
| Link retention | 1 h | 24 h | 72 h | 7 days |
| Premium templates | — | — | ✓ | ✓ |

These are the seeded defaults; all of them are editable in the admin panel. Monthly quotas reset on the 1st (UTC). Online payment is not integrated yet, so admins assign plans manually in **Admin → Users**.

## Security notes

- Template text is rendered as glyphs and never parsed as HTML, so injection through params isn't possible.
- Every param is type-checked. Colors must match a strict pattern, and `url()` in resolved styles is rejected.
- Remote images are fetched by the server with DNS pinning. Private, loopback, link-local and metadata IP ranges are blocked, including IP-literal URLs and redirects. The fetch has a size cap and a timeout, and the file type is checked by magic bytes (SVG is not accepted).
- Rendered files get random names. SVG output is served with a restrictive `Content-Security-Policy`.
- Passwords use scrypt. Session tokens and API keys are stored as SHA-256 hashes.
- Cookie-authenticated writes are rejected when the `Origin` header names another site. This is on top of `SameSite=Lax` cookies and JSON-only bodies.
- Login and registration are rate-limited, and so are previews.

## Deployment

- **Docker + Coolify (recommended):** see [docs/deploy-coolify.md](docs/deploy-coolify.md). `deploy/coolify/setup.sh` checks the server, installs Coolify, then creates and deploys the app through the Coolify API.
- **Bare VPS with PM2 + Nginx:** see [deploy.md](deploy.md).

Any Docker host works too:

```bash
docker build -t html-to-img .
docker run -d --name html-to-img -p 3003:3003 -v hti-data:/app/data html-to-img
# or pass -e ADMIN_EMAIL=you@example.com -e ADMIN_PASSWORD=... to `docker run` to create the first admin on boot
docker exec html-to-img node --disable-warning=ExperimentalWarning scripts/create-admin.js --email you@example.com
```

Back up the database with `npm run backup-db` (or `node scripts/backup-db.js` inside the container).

## Migrating from v1

The EJS pages, Puppeteer and `/api/upload` were removed. The template name now goes in the payload:

| v1 | v2 |
| --- | --- |
| `GET /qc?name=…&msg=…` (HTML page + client-side capture) | `GET /api/v1/render?template=qc&name=…&msg=…` |
| `GET/POST /api/generate?template=qc&…` | `GET/POST /api/v1/render` with `template` in the query or body |
| `json=true` | `output=url` |
| `type=png\|jpg` | `format=png\|jpeg\|svg` |
| `POST /api/upload` | `output=url` stores the file server-side |

Template params kept their names where possible. `/api/v1/templates` lists the current ones.

## License & credits

ISC © Fikri Rivandi. Emoji graphics are [Twemoji](https://github.com/jdecked/twemoji) (CC-BY 4.0). Fonts are distributed through [Fontsource](https://fontsource.org) under the SIL Open Font License.
