# Playbook: one-command Coolify deploys for a DIGISION project

**Audience:** an AI coding agent (or a developer) working on *another* repository that must be deployed the same way as html-to-img. You add the deploy tooling to **that** repository, adapted to its tech stack, and deploy it to the shared DIGISION Coolify instance.

**Reference implementation:** [freack21/html-to-img](https://github.com/freack21/html-to-img). Read these files before you start, then copy their structure. Don't copy them byte for byte; adapt every html-to-img-specific value.

| File | Role |
| --- | --- |
| [`deploy/coolify/setup.sh`](https://github.com/freack21/html-to-img/blob/main/deploy/coolify/setup.sh) | Server helper: `check`, `install`, `deploy` |
| [`deploy/coolify/provision.mjs`](https://github.com/freack21/html-to-img/blob/main/deploy/coolify/provision.mjs) | Idempotent Coolify API provisioner (runs in a throwaway `node` container) |
| [`deploy/coolify/provision.test.mjs`](https://github.com/freack21/html-to-img/blob/main/deploy/coolify/provision.test.mjs) | Tests the provisioner against a fake Coolify API |
| [`Dockerfile`](https://github.com/freack21/html-to-img/blob/main/Dockerfile), [`docker-compose.yml`](https://github.com/freack21/html-to-img/blob/main/docker-compose.yml) | Image and Coolify "Docker Compose" build pack definition |
| [`.github/workflows/ci.yml`](https://github.com/freack21/html-to-img/blob/main/.github/workflows/ci.yml) | Test → build → deploy through the Coolify webhook, only on green `main` |
| [`docs/deploy-coolify.md`](https://github.com/freack21/html-to-img/blob/main/docs/deploy-coolify.md) | Human guide (step by step, troubleshooting) |

---

## 1. Fixed facts about the DIGISION environment

Use these values as they are. Don't ask the user for them again.

| Item | Value |
| --- | --- |
| Coolify dashboard and API | `https://coolify.digision.dev` (API base `https://coolify.digision.dev/api/v1`) |
| Coolify API from the server itself | `http://127.0.0.1:8000` (what `setup.sh deploy` uses) |
| Coolify version | v4 (REST API under `/api/v1`, bearer token auth) |
| Coolify server | the default server named `localhost` |
| **Coolify project for every app** | **`DIGISION-DEV`**, environment `production` |
| DNS | Cloudflare (proxied records, SSL/TLS mode **Full (strict)**) |
| Reverse proxy | Coolify's Traefik, which owns ports 80/443 |
| Other services on the host | MariaDB/MySQL on 3306 and phpMyAdmin. Never touch them unless the user asks |
| GitHub Actions secrets for auto-deploy | `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_TOKEN` (deploy-only token) |

What the user still provides per project:

- the app's domain, e.g. `something.digision.dev`;
- an admin email, if the app has one;
- for private repositories: whether a Coolify GitHub App or a deploy key is already set up.

## 2. Hard rules

1. **Secrets never go through the chat.** Never ask the user to paste a token, password or private key into the conversation, and never commit them. The Coolify token is typed into the hidden `read -s` prompt of `setup.sh` on the server, or stored as a GitHub Actions secret by the user. Generated passwords are printed once on the server terminal.
2. **Everything is idempotent.** Re-running `setup.sh deploy` must reuse the existing project, application, env vars and scheduled tasks. It must never duplicate them, reset admin passwords or wipe volumes.
3. **Project `DIGISION-DEV`.** New applications are created in it, and the project is created if it's missing. An existing application stays where it is; the provisioner must not move it.
4. **Deploy only tested code.** CI runs tests and builds the image, then calls the deploy webhook for pushes to `main` only.
5. **Persistent data lives in named volumes or managed databases.** Nothing that matters may live only in the container filesystem.
6. **Don't touch what you don't own** on the server: other Coolify apps, MariaDB, Apache/Nginx, firewall rules. `setup.sh check` reports problems; it doesn't fix them silently.

## 3. What to build in the target repository

```
deploy/coolify/setup.sh            # check | install | deploy  (bash, run on the server as root)
deploy/coolify/provision.mjs       # Coolify API provisioner (Node 22, no dependencies)
deploy/coolify/provision.test.mjs  # node:test against a fake Coolify API
Dockerfile                         # multi-stage, non-root, HEALTHCHECK
docker-compose.yml                 # Coolify "Docker Compose" build pack, SERVICE_URL_* magic var
.dockerignore
.github/workflows/ci.yml           # test, build image, deploy via webhook on main
docs/deploy-coolify.md             # human guide, adapted from html-to-img
```

Keep `provision.mjs` in Node even when the project isn't a Node project. It runs inside `node:22-alpine` through `docker run`, so the server needs no Node install, and it can be reused across projects. Everything stack-specific lives in the Dockerfile, the compose file and the provisioner's config block.

### 3.1 `setup.sh` (copy the structure, change the constants)

Keep the same three commands and behaviors:

- **`check`** (read-only): OS (Debian/Ubuntu), architecture, CPU/RAM/disk, ports 80/443/8000/6001/6002, whether Coolify is already running, a ufw hint. Detect port owners with `ss` and fall back to `/dev/tcp` when `ss` is missing. Ports owned by `docker-proxy`/`traefik` are fine once Coolify is installed. Report the project's extra needs too, e.g. disk for uploads.
- **`install`**: runs `check`, confirms, then runs the official `https://cdn.coollabs.io/coolify/install.sh`. On the DIGISION server Coolify is already installed, so this just prints "already installed".
- **`deploy`**:
  - Read the token (hidden) and the domain once, then save them to `/etc/<app>/coolify.env` with `umask 077`.
  - Verify DNS: the domain should resolve to the server, or answer with `server: cloudflare`.
  - Download `provision.mjs` **pinned to the branch's current commit SHA** (see pitfall P3).
  - Run it in `docker run --rm --network host node:22-alpine`, passing values with `-e VAR` (by name), so the token never appears in `ps`.
  - Fall back to `mirror.gcr.io/library/node:22-alpine` when Docker Hub rate-limits.

Change per project: `REPO_RAW`, the GitHub API URL used to resolve the commit, the `CONFIG` path (`/etc/<app>/coolify.env`), the help text, and any extra flags the project needs (for example `--admin-email` only if the app has an admin bootstrap). Keep `--domain --branch --project --mirror --reset --yes`, with `--project` defaulting to `DIGISION-DEV`.

### 3.2 `provision.mjs` (the Coolify API part)

Flow (all calls `Authorization: Bearer $COOLIFY_TOKEN`, JSON). Endpoints that html-to-img uses in production are proven on this instance: servers, projects, `applications/public`, application PATCH, `envs/bulk`, scheduled tasks, `POST /deploy`, deployments. Any other endpoint mentioned here (private-repo variants, databases) comes from Coolify's API reference: confirm its fields against the official docs at https://coolify.io/docs/api-reference before relying on it, and cover it in the fake-API tests.

1. `GET /servers`, then pick the one named `localhost` (or `SERVER_UUID`).
2. `GET /applications`, then find the app by name **and** repository. If it's missing:
   - `GET /projects`, find `DIGISION-DEV`, or `POST /projects` `{ name, description }`;
   - create the app:
     - public repository: `POST /applications/public` `{ project_uuid, server_uuid, environment_name: "production", git_repository, git_branch, build_pack: "dockercompose", name, description, instant_deploy: false }`;
     - private repository: use `POST /applications/private-github-app` (needs `github_app_uuid`) or `POST /applications/private-deploy-key` (needs `private_key_uuid`). Check which one the instance has configured (`GET /github-apps`, `GET /security/keys`) and ask the user only if neither exists.
3. `PATCH /applications/{uuid}` with `{ git_branch, docker_compose_location: "/docker-compose.yml", docker_compose_domains: [{ name: "<compose service>", domain: "https://<domain>:<container port>" }] }`. The `:<port>` is the **container** port Traefik routes to; visitors still use plain `https://<domain>`.
4. `PATCH /applications/{uuid}/envs/bulk` `{ data: [{ key, value, is_preview: false, is_shown_once? }] }`, only for values the provisioner owns (generated secrets, admin bootstrap, image overrides). Generate secrets with `crypto.randomBytes`, set them **only when the app is created** (or when explicitly passed), and print them once.
5. Scheduled tasks if the stack needs them (backups, cron jobs): `GET /applications/{uuid}/scheduled-tasks`, then `POST` the ones that are missing `{ name, command, frequency, container, enabled: true, timeout }`.
6. Deploy: **`POST /deploy?uuid=<app uuid>&force=false`** (POST, not GET; see P1). Then poll `GET /deployments/{deployment_uuid}` until `finished | failed | cancelled*`, with a timeout.
7. Print: the app URL, the health URL, credentials shown once, and the webhook path `/api/v1/deploy?uuid=<uuid>&force=false` for the GitHub secret.

Error handling to keep, with human-readable `ProvisionError`s:

- network failure: "Cannot reach Coolify at …";
- 401: "token rejected";
- 403: explain API access, Allowed IPs, the Docker network source subnet (`COOLIFY_SOURCE_HINT`) and the root permission;
- other errors: include Coolify's `message` / `errors`.

Make every value overridable via env: `GIT_REPOSITORY`, `GIT_BRANCH`, `PROJECT_NAME` (default `DIGISION-DEV`), `APP_NAME`, `APP_DOMAIN`, `SERVER_UUID`, `DEPLOY=0`.

**Databases.** If the project needs PostgreSQL/MySQL/Redis, choose one:

- **(a)** Put the database in the project's `docker-compose.yml` as a second service with a named volume. Simplest, and deployed together with the app.
- **(b)** Create a Coolify-managed database through the API (`POST /databases/postgresql`, `/databases/mysql`, `/databases/redis`, … in project `DIGISION-DEV`) and pass its internal URL as an env var. Gives Coolify's database backups.

Check the exact endpoint and fields in the instance's API reference before using (b) (Coolify docs: *API Reference*), and make it idempotent: find by name first. Don't reuse the host's MariaDB unless the user explicitly asks; if they do, the app must reach it via the host gateway, and credentials come from the user through a secure channel, never the chat.

### 3.3 `Dockerfile` and `docker-compose.yml`

General rules, whatever the stack:

- Multi-stage build: dependencies/build stage, then a slim runtime stage.
- Run as a **non-root** user. Create and `chown` the data directory **in the image**, so a fresh named volume inherits the ownership.
- Listen on `0.0.0.0:<PORT>`, use `expose:` (not `ports:`) in compose, and let Traefik route.
- Add a **`/healthz`** (or equivalent) endpoint that checks the database, plus a `HEALTHCHECK` in the Dockerfile.
- Use a base image `ARG` (`NODE_IMAGE`, `PYTHON_IMAGE`, …) so builds can switch to `mirror.gcr.io` on Docker Hub 429s.
- In compose, declare `SERVICE_URL_<SERVICE>_<PORT>: /` so Coolify knows the routed port, and pass it on as the app's public URL env var (see P6 for the port it contains).
- Trust the proxy: the app must read client IPs/scheme from `X-Forwarded-*` sent by Traefik on the private Docker network (`loopback, uniquelocal` in Express terms). If the app does per-IP limits behind Cloudflare, trust `CF-Connecting-IP` **only** when the peer is in Cloudflare's IP ranges.
- `restart: unless-stopped`, `init: true` (or tini) for correct signal handling, and graceful shutdown on SIGTERM.
- One replica if state lives in the container (SQLite, in-memory rate limits or caches). Say so in the docs.

Stack adaptation table (pick the row that matches, then follow the project's own conventions):

| Stack | Build | Runtime command | Port | Notes |
| --- | --- | --- | --- | --- |
| Node API / Express / Fastify | `npm ci` then `npm run build` if any | `node dist/index.js` or `node src/index.js` | 3000 | `npm ci --omit=dev` in the runtime stage; Debian slim base if native modules ship glibc binaries |
| Next.js | `next build` with `output: "standalone"` | `node server.js` | 3000 | Copy `.next/standalone`, `.next/static`, `public`; set `HOSTNAME=0.0.0.0` |
| Vite/React SPA served by the API | build the web workspace in its own stage | API serves `dist` with an SPA fallback | API port | Like html-to-img |
| Static site only | `npm run build` | `nginx:alpine` or `caddy` serving `/usr/share/nginx/html` | 80 | Health is `GET /`; no volume |
| Laravel (PHP) | `composer install --no-dev`, `npm run build` | `php-fpm` + nginx in one image (e.g. `serversideup/php`) or FrankenPHP | 8080/80 | Volume for `storage/`; scheduled task `php artisan schedule:run` every minute; run migrations with `php artisan migrate --force` on start or as a deploy step; `APP_KEY` generated once by the provisioner |
| Django / FastAPI (Python) | `pip install -r requirements.txt` (or uv/poetry) | `gunicorn`/`uvicorn` on `0.0.0.0` | 8000 | Run `migrate` and `collectstatic` on start; `SECRET_KEY` generated once |
| Go | `go build` in `golang:<ver>` | static binary in `distroless`/`alpine` | 8080 | Tiny runtime image |
| Bun/Deno | official image | `bun run` / `deno run` | 3000 | Same rules |

**Prefer the `dockercompose` build pack** (as html-to-img does) even for a single service: volumes, health checks and env defaults stay in Git, and the domain mapping works the same for every project. Switch to the `dockerfile` or `nixpacks` build pack only if the user asks.

### 3.4 CI: `.github/workflows/ci.yml`

- On every push and PR: install, lint/test, build, and `docker build` the image (catches Dockerfile breakage before Coolify does).
- Deploy job: `needs: test`, `if: push to main`, `concurrency: deploy-production` (no cancel).
  - `curl --fail-with-body --request POST --header "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_DEPLOY_WEBHOOK"`.
  - Skip with a `::notice::` when the secrets are missing.
- The webhook URL must use the **public Coolify domain**: `https://coolify.digision.dev/api/v1/deploy?uuid=<uuid>&force=false`.
- Tell the user to create a **deploy-only** Coolify token for CI, separate from the root token used by `setup.sh`, and to keep Coolify's own auto-deploy off so `main` isn't deployed twice.

### 3.5 Tests for the provisioner

Copy `provision.test.mjs`. A fake `fetchImpl` implements the subset of the API you call and asserts the auth header and the request bodies. Cover at least:

- first run creates the project and app, sets the domain/envs/tasks, deploys and polls until finished;
- second run reuses everything and doesn't reset secrets;
- 401 and 403 produce the friendly messages;
- a failed deployment surfaces as an error;
- `DEPLOY=0` skips the deploy.

Wire the tests into the repository's `npm test` / CI.

## 4. Pitfalls we already hit (don't repeat them)

| # | Symptom | Cause | What to do |
| --- | --- | --- | --- |
| P1 | `405 Method Not Allowed` on deploy | `GET /api/v1/deploy` is not accepted | Use **`POST /api/v1/deploy?uuid=…&force=false`**, in the provisioner and in CI |
| P2 | `403 You are not allowed to access the API` | Settings → Advanced → API: access disabled, or *Allowed IPs* doesn't include the caller | Enable API access. Leave Allowed IPs empty or include the caller: the server-side script reaches Coolify through the `coolify` Docker network gateway (pass `COOLIFY_SOURCE_HINT`), and GitHub runners call from changing IPs. Root permission for `setup.sh`, deploy permission for CI |
| P3 | Server keeps running an old `provision.mjs` after a fix | `raw.githubusercontent.com` caches branch URLs for minutes; query strings don't bust it | Resolve the branch to a commit SHA (`GET api.github.com/repos/<o>/<r>/commits/<branch>` with `Accept: application/vnd.github.sha`) and download `raw…/<sha>/deploy/coolify/provision.mjs` |
| P4 | `trap` cleanup removes nothing or errors | `trap … EXIT` referenced a `local` variable that was gone when the trap ran | Keep the temp dir in a **global** variable for the EXIT trap |
| P5 | `check` crashes on minimal images | `ss` not installed | Fall back to `/dev/tcp/127.0.0.1/<port>` probing |
| P6 | Shared links, canonical/OG URLs and the OpenAPI server point at `https://<domain>:3003` | Coolify's `SERVICE_URL_<NAME>_<PORT>` value **includes the container port** | Normalize in the app: drop the port from an **https** public URL when it equals the app's own plain-HTTP port (see `normalizePublicUrl` in html-to-img `server/src/config.js`), or derive the origin from the request behind a trusted proxy |
| P7 | Traefik `404 page not found` | Domain not attached to the compose service, or attached without the container port | `docker_compose_domains: [{ name: "<service>", domain: "https://<domain>:<port>" }]`, then redeploy |
| P8 | Let's Encrypt fails / redirect loop | Cloudflare proxy on during the first issuance, or SSL mode Flexible | Grey cloud for the first deploy if issuance fails, then orange cloud with **Full (strict)** |
| P9 | CI deploy step `curl: (6) Could not resolve host` | Webhook pointed at a Coolify hostname that doesn't exist | Use `https://coolify.digision.dev/...` |
| P10 | Build fails with `429 Too Many Requests` | Docker Hub anonymous pull limit | Base image `ARG` and a `--mirror` flag for `mirror.gcr.io` |
| P11 | App shows up in the wrong Coolify project | It was created before `PROJECT_NAME` defaulted to `DIGISION-DEV`; the provisioner never moves existing apps | Create new apps with the right project from the start. To fix an old one, rename or move the project in the Coolify UI (gear icon → name) |
| P12 | Admin password reset on every deploy | Secrets were set unconditionally | Set generated secrets only when the app is created or has never run (`GET /applications/{uuid}` status) |
| P13 | Volume permission denied | Image runs as non-root, volume dir owned by root | `mkdir -p /data && chown <uid> /data` in the Dockerfile before `USER` |

## 5. Procedure for the agent

1. **Inspect the target repository.** Stack, package manager, how it starts, its port, env vars it reads (`.env.example`), database/storage needs, background jobs, existing Dockerfile/CI. Reuse what's there.
2. **Make the app container-ready.** Bind `0.0.0.0`, add `/healthz`, add a public-URL env var with the P6 normalization, trust the proxy correctly, make SIGTERM graceful, and read every secret from env.
3. **Write the Dockerfile, `.dockerignore` and `docker-compose.yml`** (section 3.3). Build the image locally if Docker is available and run the container with a health check. If Docker isn't available in your sandbox, say so; CI's `docker build` is then the first real check.
4. **Write `provision.mjs` and its tests** (sections 3.2 and 3.5) with this project's `APP_NAME`, repository, compose service name, container port, env vars and scheduled tasks. Default `PROJECT_NAME` = `DIGISION-DEV`.
5. **Write `setup.sh`** (section 3.1). Run `bash -n` and `shellcheck` if available.
6. **Write CI** (section 3.4) and **`docs/deploy-coolify.md`** (adapt the html-to-img guide: commands, domain, env table, backups, troubleshooting).
7. **Verify locally:** the project's tests, provisioner tests, `bash -n setup.sh`, and an image build if possible. Commit with Conventional Commits under the user's own Git identity (no AI attribution), then push as the repository's workflow requires.
8. **Hand off to the user.** Give the exact commands to run on the server (they hold the token):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/coolify/setup.sh -o setup.sh
   sudo bash setup.sh check
   sudo bash setup.sh deploy --domain <app-domain>
   ```

   Also list:
   - the Cloudflare DNS record to add (A record to the server IP, proxied, Full (strict));
   - the two GitHub secrets (`COOLIFY_DEPLOY_WEBHOOK` = `https://coolify.digision.dev/api/v1/deploy?uuid=<uuid printed by the script>&force=false`, `COOLIFY_TOKEN` = a deploy-only token).
9. **After the user deploys, verify from outside:** `https://<domain>/healthz` returns 200, the app's main page loads, generated URLs don't contain `:<port>` (P6), the CI deploy job is green on the next push, and the app appears in project **DIGISION-DEV** in Coolify.

## 6. Done checklist

- [ ] `setup.sh check | install | deploy` exists, is idempotent, and never echoes the token.
- [ ] `provision.mjs` creates or reuses the app in **DIGISION-DEV**, sets the domain with the container port, env vars, tasks, deploys with **POST**, and waits for the result.
- [ ] Provisioner tests pass and run in CI.
- [ ] Image is multi-stage, non-root, with `HEALTHCHECK` and `/healthz`; data lives in named volumes or a managed database.
- [ ] Public URL normalization (P6) and proxy trust are in place.
- [ ] CI deploys only green `main` through `https://coolify.digision.dev/api/v1/deploy`.
- [ ] `docs/deploy-coolify.md` explains setup, DNS, secrets, backups and troubleshooting for this project.
- [ ] No secrets in Git, chat or logs.
