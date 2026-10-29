# Deploying with Docker and Coolify

This guide deploys html-to-img to a server managed by [Coolify](https://coolify.io) v4. The repository already contains everything Coolify needs:

| File | Purpose |
| --- | --- |
| `Dockerfile` | Multi-stage image: builds the React app, installs server production dependencies, runs as the unprivileged `node` user, health check on `/healthz` |
| `docker-compose.yml` | The Coolify resource definition: domain wiring, environment and the persistent `hti-data` volume |
| `.dockerignore` | Keeps `node_modules`, `data/`, tests and secrets out of the build context |
| `.github/workflows/ci.yml` | Tests, builds and validates the image on every push/PR; triggers the Coolify deploy only after tests pass on `main` |
| `server/scripts/backup-db.js` | Online SQLite backup with pruning, meant for a Coolify scheduled task |

**No external database is needed.** The app uses SQLite (`node:sqlite`) stored on the `hti-data` volume. An existing MariaDB/phpMyAdmin on the server is not used.

## 1. Prerequisites

- Coolify v4 installed on the server, with the server added and validated.
- Access to the GitHub repository from Coolify: either the repo is public or the Coolify GitHub App is installed on it.
- A DNS `A` (and optionally `AAAA`) record for your domain, e.g. `img.example.com`, pointing at the server.
- At least 1 vCPU and 1 GB RAM free for the app (2 GB recommended while building).

## 2. Create the resource

1. In Coolify, open your project → **+ New** → **Public Repository** (or **Private Repository (with GitHub App)**).
2. Repository `https://github.com/freack21/html-to-img`, branch `main`.
3. **Build Pack:** `Docker Compose`. **Docker Compose Location:** `/docker-compose.yml`.
4. Save. Coolify reads the compose file and shows one service, `app`.

## 3. Domain

Coolify generates a temporary domain for `SERVICE_URL_APP_3003`. To use your own, open the `app` service settings and set **Domains** to:

```
https://img.example.com:3003
```

The `:3003` suffix tells Coolify's proxy which container port to route to; the public URL stays `https://img.example.com`. Coolify issues the TLS certificate. The app reads the domain from `SERVICE_URL_APP_3003` (as `PUBLIC_URL`) to build absolute image links.

## 4. Environment variables

Nothing is required. Optional overrides go in the resource's **Environment Variables** tab:

| Variable | Default | When to change |
| --- | --- | --- |
| `NODE_IMAGE` | `node:22-bookworm-slim` | Build fails with `429 Too Many Requests` from Docker Hub: use `mirror.gcr.io/library/node:22-bookworm-slim` |
| `TRUST_PROXY` | `loopback, uniquelocal` | Only if traffic reaches the container through a proxy outside private networks (e.g. Cloudflare Tunnel on a public IP) |
| `MAX_IMAGE_BYTES` | `5242880` | Larger remote/uploaded images |
| `IMAGE_TIMEOUT_MS` | `5000` | Slow image hosts |
| `EMOJI_BASE_URL` | Twemoji on jsDelivr | Self-hosted emoji, or empty to disable |

Runtime settings (guest limits, watermark text, registration) live in **Admin → Settings** inside the app.

## 5. Deploy and verify

Click **Deploy**. The first build takes 1–3 minutes. When it is done:

```bash
curl https://img.example.com/healthz          # {"status":"ok"}
curl -o qc.png "https://img.example.com/api/v1/render?template=qc&name=Hello"
```

The container shows **healthy** in Coolify once `/healthz` answers.

## 6. Create the first admin

Open the resource → **Terminal**, pick the `app` container and run:

```bash
node --disable-warning=ExperimentalWarning scripts/create-admin.js --email you@example.com --name "Your Name"
```

It prints a generated password once. Log in at `https://img.example.com/login` and change it under **Dashboard → Account**. Running the command again for an existing email promotes that user to admin.

## 7. Backups

The database lives in the `hti-data` volume (`/app/data/app.db`). Add a **Scheduled Task** on the resource:

- **Name:** `backup-db`
- **Command:** `node --disable-warning=ExperimentalWarning scripts/backup-db.js --keep 14`
- **Frequency:** `0 3 * * *` (daily, 03:00 server time)
- **Container:** `app`

Backups are written to `/app/data/backups/` and the 14 newest are kept. They live on the same volume as the database, so also copy them off the server. For example, run this from the host via cron:

```bash
docker cp "$(docker ps -qf name=app- | head -n1)":/app/data/backups ./html-to-img-backups
```

To restore: stop the resource, copy the chosen backup over `/app/data/app.db` (and delete `app.db-wal` / `app.db-shm`), then start it again.

## 8. Deploy only after tests pass (recommended)

By default Coolify redeploys on every push. To deploy only commits that passed CI:

1. Coolify → **Keys & Tokens → API Tokens** → create a token with the **deploy** permission.
2. Resource → **Webhooks** → copy the **Deploy Webhook** URL (`https://<coolify>/api/v1/deploy?uuid=<uuid>&force=false`).
3. GitHub → repository **Settings → Secrets and variables → Actions** → add:
   - `COOLIFY_DEPLOY_WEBHOOK` = the webhook URL
   - `COOLIFY_TOKEN` = the API token
4. Resource → **Advanced** → turn off **Auto Deploy**.

From then on, `.github/workflows/ci.yml` runs tests, builds the image and calls the webhook only for pushes to `main` that pass. Without the secrets, the deploy job is skipped.

## Operational notes

- **Run one replica.** SQLite and the in-memory rate limiter are per container. Don't scale the service horizontally.
- **Resource limits.** 1 CPU and 768 MB memory are plenty for moderate traffic. Rendering is CPU-bound, at 40–300 ms per image.
- **Volume ownership.** The image runs as uid 1000 and the named volume inherits that ownership. If you replace it with a bind mount, `chown 1000:1000` the host directory first.
- **Outbound network.** The server must reach `cdn.jsdelivr.net` (emoji) and any image hosts your templates use.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Build: `429 Too Many Requests` from Docker Hub | Set `NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm-slim` and redeploy |
| Container unhealthy | Check the deployment logs. The app must log `listening on http://0.0.0.0:3003` |
| `502 Bad Gateway` | The domain is missing the `:3003` suffix, or the container is still starting |
| Image links point to the wrong host | Check the domain under `SERVICE_URL_APP_3003`; it becomes `PUBLIC_URL` |
| All guests share one daily quota | `TRUST_PROXY` doesn't cover the proxy's address |
| Actions return `bad_origin` after login | A proxy in front of Coolify rewrote the `Host` header; preserve it |
| `SQLITE_READONLY` / permission denied in `/app/data` | The volume is not owned by uid 1000 (see Volume ownership) |
