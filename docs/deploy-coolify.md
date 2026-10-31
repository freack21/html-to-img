# Deploying with Docker and Coolify

[Coolify](https://coolify.io) is a self-hosted platform (like a private Heroku/Vercel) that runs on your own server. It builds the app from GitHub with Docker, puts it behind HTTPS with automatic Let's Encrypt certificates, and gives you a dashboard for logs, environment variables, backups and redeploys.

This guide takes a fresh server to a running html-to-img in about 20 minutes. Most of the work is done by two scripts in this repository:

| Step | Who | Time |
| --- | --- | --- |
| 1. Check the server | `setup.sh check` | 1 min |
| 2. Install Coolify | `setup.sh install` | 5 min |
| 3. Create the Coolify account and API token | you, in the browser | 5 min |
| 4. Point your domain at the server | you, at your DNS provider | 2 min (+ propagation) |
| 5. Create and deploy the app | `setup.sh deploy` | 5 min |
| 6. Optional: deploy only after CI passes | you, in GitHub | 3 min |

**No external database is needed.** html-to-img stores its data in SQLite on a Docker volume. An existing MariaDB/MySQL and phpMyAdmin on the server are left alone. The only thing that can get in the way is a web server already using ports 80/443 (see [Port 80/443 already in use](#port-80443-already-in-use)).

## Requirements

- A Linux server, ideally Ubuntu 22.04/24.04 LTS or Debian 12, with **2 CPU cores, 2 GB RAM and 10 GB free disk** (Coolify's minimum). You need root or sudo over SSH.
- A domain or subdomain you control, e.g. `img.example.com`.
- Ports 22, 80, 443 and 8000 reachable from the internet. Port 8000 is only needed until the dashboard has its own domain.

## 1. Check the server

Connect over SSH and download the helper:

```bash
ssh your-user@your-server-ip
curl -fsSL https://raw.githubusercontent.com/freack21/html-to-img/main/deploy/coolify/setup.sh -o setup.sh
sudo bash setup.sh check
```

The check is read-only. It reports the OS, CPU, memory, disk, and whether ports 80/443/8000/6001/6002 are free. Fix every `✘` before continuing.

## 2. Install Coolify

```bash
sudo bash setup.sh install
```

This runs the checks again, asks for confirmation, then runs Coolify's official installer (`https://cdn.coollabs.io/coolify/install.sh`). The installer sets up Docker and Coolify. When it finishes, it prints the dashboard address: `http://<server-ip>:8000`.

## 3. Create the Coolify account and an API token

Do this right after installing: **whoever opens the dashboard first becomes its owner.**

1. Open `http://<server-ip>:8000` and register your admin account. Use a strong password.
2. Onboarding: choose **This Machine / localhost** as the server and accept the defaults.
3. **Settings → Advanced → API and MCP**: set **API access** to **Enabled** and click **Save changes**. Leave *Allowed API IPs* empty, since the script calls the API from the server itself.
4. **Keys & Tokens → API tokens**: create a token named `setup`, select the **root** permission, click **Create** and copy the token. It is shown only once. Paste it into the terminal in step 5, never into a chat or a file.

## 4. Point your domain at the server

At your DNS provider (Cloudflare, Niagahoster, Namecheap, …) add:

| Type | Name | Value |
| --- | --- | --- |
| `A` | `img` (for `img.example.com`) | your server's public IP |

If you use Cloudflare, set the record to **DNS only** (grey cloud) for the first deploy so Let's Encrypt can issue the certificate. You can turn the proxy (orange cloud) on afterwards with SSL/TLS mode **Full (strict)**. The app reads the visitor's real IP from `CF-Connecting-IP`, but only for requests that really arrive from Cloudflare's IP ranges, so guest quotas stay per visitor.

## 5. Create and deploy the app

```bash
sudo bash setup.sh deploy --domain img.example.com --admin-email you@example.com
```

The script asks only for the **Coolify API token** from step 3 (input is hidden). The flags are optional:

- `--domain`: the app's domain. Without it, the first run asks, and an empty answer gives a temporary `*.sslip.io` address.
- `--admin-email`: creates the first html-to-img admin. A password is generated and printed once. Only needed on the very first deploy.
- `--mirror`: build from `mirror.gcr.io`. Only needed if a build failed with `429 Too Many Requests`.

The token and domain are saved to `/etc/html-to-img/coolify.env` (readable by root only). Later runs of `sudo bash setup.sh deploy` ask nothing. Use `--domain <new>` to switch domains, or `--reset` to forget the saved token.

It then uses the Coolify API to:

1. create the application in the Coolify project **DIGISION-DEV** (created if missing; change with `--project <name>`) from `https://github.com/freack21/html-to-img` (branch `main`, build pack **Docker Compose**, file `/docker-compose.yml`);
2. attach your domain (routed to container port 3003, with HTTPS);
3. set the admin environment variables;
4. schedule a daily database backup (`backup-db`, 03:00);
5. deploy and wait until the build finishes.

When it prints `✅ html-to-img is configured and deployed`, open `https://img.example.com`, log in with the printed admin credentials, and change the password under **Dashboard → Account**.

Running `setup.sh deploy` again is safe. It reuses the existing app and backup task, applies the domain, redeploys, and doesn't reset the admin password. To deploy another branch, add `--branch <name>`.

<details>
<summary>Prefer clicking? The same setup by hand</summary>

1. Project → **+ New** → **Public Repository** → `https://github.com/freack21/html-to-img`, branch `main`.
2. **Build Pack:** `Docker Compose`, **Docker Compose Location:** `/docker-compose.yml` → **Continue**.
3. In the `app` service set **Domains** to `https://img.example.com:3003`. The `:3003` is the container port; visitors still use `https://img.example.com`.
4. **Environment Variables:** add `ADMIN_EMAIL` and `ADMIN_PASSWORD` (8+ characters).
5. **Scheduled Tasks → + Add:** name `backup-db`, command `node --disable-warning=ExperimentalWarning scripts/backup-db.js --keep 14`, frequency `0 3 * * *`, container `app`.
6. Click **Deploy** and watch the **Deployments** tab.
</details>

## 6. Optional: deploy automatically after tests pass

Coolify does not watch a public repository on its own. To redeploy whenever `main` changes, and only when CI is green:

1. Coolify → **Keys & Tokens → API tokens**: create a token with only the **deploy** permission.
2. Coolify → your application → **Webhooks**: copy the **Deploy Webhook** URL. `setup.sh deploy` also prints it.
3. GitHub → repository **Settings → Secrets and variables → Actions → New repository secret**:
   - `COOLIFY_DEPLOY_WEBHOOK`: the webhook URL. It must be reachable from the internet, e.g. `http://<server-ip>:8000/api/v1/deploy?uuid=…&force=false`, or your Coolify domain.
   - `COOLIFY_TOKEN`: the deploy-only token.

`.github/workflows/ci.yml` runs the tests, builds the web app and the Docker image, then calls the webhook for pushes to `main`. Without the secrets, the deploy step is skipped.

Afterwards, delete the `setup` root token in Coolify (or keep it somewhere safe if you plan to re-run `setup.sh deploy`).

## Port 80/443 already in use

Coolify's proxy (Traefik) must own ports 80 and 443. If `setup.sh check` shows them taken by `apache2`, `nginx` or `httpd` (common when phpMyAdmin or other sites are installed), choose one:

**A. Move the existing web server to another port** (phpMyAdmin keeps working at `http://<server-ip>:8080`). For Apache:

```bash
sudo sed -i 's/^Listen 80$/Listen 8080/; s/^\(\s*\)Listen 443/\1# Listen 443/' /etc/apache2/ports.conf
sudo sed -i --follow-symlinks 's/<VirtualHost \*:80>/<VirtualHost *:8080>/' /etc/apache2/sites-enabled/*.conf
sudo a2dissite default-ssl 2>/dev/null || true   # its :443 site would no longer have a Listen
sudo apachectl configtest && sudo systemctl restart apache2
```

Take a copy of `/etc/apache2` first (`sudo cp -a /etc/apache2 /etc/apache2.bak`) so you can roll back.

For Nginx, change `listen 80;` to `listen 8080;` (and comment out `listen 443 …`) in `/etc/nginx/sites-enabled/*`, then `sudo nginx -t && sudo systemctl restart nginx`. Allow the new port in your firewall if you need it, and re-run `sudo bash setup.sh check`.

**B. Retire it.** If the web server only exists for phpMyAdmin, you can stop it (`sudo systemctl disable --now apache2`) and later run phpMyAdmin as a Coolify service, which gives it HTTPS and a domain.

MariaDB/MySQL on port 3306 doesn't conflict and needs no changes.

## Day-to-day operations

| Task | How |
| --- | --- |
| Logs | Application → **Logs** (runtime) or **Deployments** (build) |
| Redeploy | Application → **Redeploy**, a push to `main` (with step 6), or `sudo bash setup.sh deploy` |
| Shell in the container | Application → **Terminal** → container `app` |
| Create another admin | Terminal: `node --disable-warning=ExperimentalWarning scripts/create-admin.js --email someone@example.com` |
| Backups | Written daily to `/app/data/backups/` (14 kept). Copy them off the server regularly, e.g. `docker cp $(docker ps -qf name=app- \| head -n1):/app/data/backups ./html-to-img-backups` |
| Restore a backup | Stop the app, copy the backup over `/app/data/app.db`, delete `app.db-wal` and `app.db-shm`, then start it |
| App settings | html-to-img **Admin → Settings** (guest limits, watermark, registration) |

### Optional environment variables

Set these under the application's **Environment Variables**, then redeploy:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_IMAGE` | `node:22-bookworm-slim` | Base image. Use `mirror.gcr.io/library/node:22-bookworm-slim` if Docker Hub rate-limits builds |
| `TRUST_PROXY` | `loopback, uniquelocal` | Which proxies to trust for client IPs |
| `MAX_IMAGE_BYTES` / `IMAGE_TIMEOUT_MS` | `5242880` / `5000` | Limits for remote images |
| `EMOJI_BASE_URL` | Twemoji on jsDelivr | Emoji source; empty disables emoji |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | — | First admin, created only if that email has no account |

### Things to keep as they are

- **One replica.** SQLite and the rate limiter live inside the container, so don't scale the service.
- **The `hti-data` volume** holds the database. Deleting the application's volumes deletes all users and templates.
- The image runs as uid 1000. If you replace the named volume with a bind mount, `chown 1000:1000` the directory.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `setup.sh deploy`: `403 … Enable Settings > Advanced > API access` | Turn on API access (step 3.3) and make sure the token has the **root** permission |
| `setup.sh deploy`: `401` | The token was mistyped or deleted; create a new one |
| Build fails with `429 Too Many Requests` | Re-run `setup.sh deploy` and answer `y` to the mirror question, or set `NODE_IMAGE` (see above) |
| Site shows `404 page not found` (Traefik) | The domain is not attached. It should be `https://img.example.com:3003` on the `app` service. Redeploy afterwards |
| HTTPS certificate error | DNS doesn't point to the server yet, or Cloudflare proxy is on; see step 4. Coolify retries automatically |
| `502 Bad Gateway` | The container is starting or crashed; check **Logs** |
| Admin login doesn't work | The admin is only created if the email had no account. Check the logs for `Created admin account`, or use the Terminal command above |
| All guests share one daily quota | A proxy other than Cloudflare hides client IPs; adjust `TRUST_PROXY` |
| Redirect loop with Cloudflare | Set Cloudflare SSL/TLS mode to **Full (strict)**, not Flexible |
