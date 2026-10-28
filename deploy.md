# Deploying to an Ubuntu VPS (Nginx + PM2)

This guide deploys html-to-img v2 on Ubuntu 22.04/24.04. It runs a single Node.js process managed by PM2, with Nginx in front for HTTPS. Chromium is no longer needed: rendering is done in-process by Satori and resvg.

## Requirements

- A VPS with at least 1 vCPU and 1 GB RAM (2 GB recommended)
- A domain pointing at the VPS (for HTTPS)
- SSH access with a sudo user

## 1. Install Node.js 22 and git

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
node -v   # must be v22.13.0 or newer (node:sqlite is required)
```

## 2. Get the code and build

```bash
sudo mkdir -p /var/www && sudo chown "$USER" /var/www
cd /var/www
git clone https://github.com/freack21/html-to-img.git
cd html-to-img
npm ci
npm run build
npm test
```

## 3. Configure

```bash
cp .env.example .env
nano .env
```

Set at least:

```ini
PORT=3003
HOST=127.0.0.1
NODE_ENV=production
PUBLIC_URL=https://img.example.com
TRUST_PROXY=loopback
```

Keep `HOST=127.0.0.1` so the app is reachable only through Nginx. `TRUST_PROXY=loopback` makes the app trust Nginx's `X-Forwarded-For`, which guest quotas and rate limits rely on.

Create the first admin. A password is generated and printed once unless you set `ADMIN_PASSWORD`:

```bash
npm run create-admin -- --email you@example.com --name "Your Name"
```

## 4. Run with PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # run the command it prints
pm2 logs html-to-img
```

The process file runs **one instance in fork mode**. Don't switch to cluster mode: SQLite and the in-memory rate limiter are per process.

## 5. Nginx reverse proxy

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/html-to-img
```

```nginx
server {
    listen 80;
    server_name img.example.com;

    # Uploaded images are sent as base64 inside JSON bodies.
    client_max_body_size 16m;

    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_http_version 1.1;
        # The app compares Origin with Host for cookie-authenticated writes.
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/html-to-img /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d img.example.com
```

Session cookies are marked `Secure` when `NODE_ENV=production`, so log in over HTTPS.

## 7. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## Updating

```bash
cd /var/www/html-to-img
git pull origin main
npm ci
npm run build
npm test
pm2 reload html-to-img
```

Database migrations in `server/src/db/migrations` run automatically on startup.

## Backups

All state lives in `data/`: the database `app.db` (WAL mode) and rendered files in `storage/`, which expire anyway. Back up the database with SQLite's online backup, which is safe while the app is running:

```bash
sudo apt install -y sqlite3
sqlite3 /var/www/html-to-img/data/app.db ".backup '/var/backups/html-to-img-$(date +%F).db'"
```

To restore: stop the app (`pm2 stop html-to-img`), replace `data/app.db`, delete any `app.db-wal` and `app.db-shm` files, then start it again.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `node:sqlite` not found | `node -v` must be ≥ 22.13 |
| Every guest shares one quota | Nginx must send `X-Forwarded-For`, and `TRUST_PROXY` must match the proxy address |
| Login works but actions return `bad_origin` | Nginx must pass `proxy_set_header Host $host` |
| Emoji show as boxes | The server needs outbound HTTPS to `cdn.jsdelivr.net` (or set `EMOJI_BASE_URL`) |
| `413 Request Entity Too Large` | Raise `client_max_body_size` in Nginx |
