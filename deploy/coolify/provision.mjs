// Provisions html-to-img on a Coolify v4 instance through its REST API, then deploys it.
// Safe to re-run: it reuses the project, application and scheduled task it finds by name.
//
// Required env:
//   COOLIFY_URL     Coolify base URL, e.g. http://127.0.0.1:8000
//   COOLIFY_TOKEN   API token with the "root" permission (or read + write + deploy)
// Optional env:
//   APP_DOMAIN      Public domain for the app, e.g. img.example.com (empty = Coolify-generated domain)
//   ADMIN_EMAIL     First admin account; ADMIN_PASSWORD is generated when empty
//   ADMIN_PASSWORD  Only applied when the application is created (or when given explicitly)
//   GIT_REPOSITORY  default https://github.com/freack21/html-to-img
//   GIT_BRANCH      default main
//   PROJECT_NAME    default html-to-img
//   APP_NAME        default html-to-img
//   SERVER_UUID     default: the "localhost" server, else the first server
//   NODE_IMAGE      base image override (e.g. mirror.gcr.io/library/node:22-bookworm-slim)
//   DEPLOY          set to 0 to configure without deploying
import crypto from "node:crypto";

const BACKUP_TASK = {
  name: "backup-db",
  command: "node --disable-warning=ExperimentalWarning scripts/backup-db.js --keep 14",
  frequency: "0 3 * * *",
  container: "app",
};
const DONE_STATUSES = new Set(["finished", "failed", "cancelled-by-user", "cancelled"]);

export class ProvisionError extends Error {}

function createClient({ baseUrl, token, fetchImpl, sourceHint }) {
  const root = `${baseUrl.replace(/\/+$/, "")}/api/v1`;
  return async function request(method, path, body) {
    let res;
    try {
      res = await fetchImpl(root + path, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/json",
          ...(body !== undefined && { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new ProvisionError(`Cannot reach Coolify at ${baseUrl} (${err.cause?.code || err.cause?.errors?.[0]?.code || err.cause?.message || err.message}). Is COOLIFY_URL correct?`);
    }
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (res.status === 401) throw new ProvisionError("Coolify rejected the API token (401). Create a new token and try again.");
    if (res.status === 403) {
      const reason = typeof data === "object" && data?.message ? ` Coolify says: "${data.message}".` : "";
      const network = sourceHint
        ? ` Requests from this script reach Coolify through the Docker network ${sourceHint}, so Allowed IPs must include it (or be left empty).`
        : "";
      throw new ProvisionError(
        `Coolify refused the request (403).${reason} Check Settings > Advanced: API access must be Enabled and Allowed IPs must include the caller.${network} The token needs the root permission.`,
      );
    }
    if (!res.ok) {
      const detail = typeof data === "object" && data ? data.message || JSON.stringify(data.errors || data) : text;
      throw new ProvisionError(`${method} ${path} failed with HTTP ${res.status}: ${detail}`);
    }
    return data;
  };
}

function pickServer(servers, wanted) {
  if (!Array.isArray(servers) || servers.length === 0) throw new ProvisionError("Coolify has no servers yet. Finish the onboarding first.");
  if (wanted) {
    const server = servers.find((s) => s.uuid === wanted);
    if (!server) throw new ProvisionError(`SERVER_UUID ${wanted} not found. Available: ${servers.map((s) => `${s.name} (${s.uuid})`).join(", ")}`);
    return server;
  }
  return servers.find((s) => s.name === "localhost") ?? servers[0];
}

const normalizeRepo = (url) => String(url || "").replace(/\.git$/, "").replace(/\/+$/, "").toLowerCase();

/**
 * @returns {{ appUuid, url, adminEmail, adminPassword, webhookPath, deployment }}
 */
export async function provision(env, { fetchImpl = fetch, log = console.log, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pollMs = 5000, timeoutMs = 20 * 60 * 1000 } = {}) {
  if (!env.COOLIFY_URL || !env.COOLIFY_TOKEN) throw new ProvisionError("COOLIFY_URL and COOLIFY_TOKEN are required.");
  const request = createClient({ baseUrl: env.COOLIFY_URL, token: env.COOLIFY_TOKEN, fetchImpl, sourceHint: env.COOLIFY_SOURCE_HINT });
  const repo = env.GIT_REPOSITORY || "https://github.com/freack21/html-to-img";
  const branch = env.GIT_BRANCH || "main";
  const projectName = env.PROJECT_NAME || "html-to-img";
  const appName = env.APP_NAME || "html-to-img";
  const domain = (env.APP_DOMAIN || "").trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  log("• Checking API access…");
  const server = pickServer(await request("GET", "/servers"), env.SERVER_UUID);
  log(`  server: ${server.name} (${server.uuid})`);

  log("• Project…");
  const projects = await request("GET", "/projects");
  let project = (projects || []).find((p) => p.name === projectName);
  if (!project) {
    project = await request("POST", "/projects", { name: projectName, description: "Template-driven image generation" });
    log(`  created project ${projectName}`);
  } else {
    log(`  using existing project ${projectName}`);
  }

  log("• Application…");
  const apps = await request("GET", "/applications");
  let app = (apps || []).find((a) => a.name === appName && normalizeRepo(a.git_repository).endsWith(normalizeRepo(repo).replace(/^https?:\/\/github\.com\//, "")));
  const created = !app;
  if (created) {
    app = await request("POST", "/applications/public", {
      project_uuid: project.uuid,
      server_uuid: server.uuid,
      environment_name: "production",
      git_repository: repo,
      git_branch: branch,
      build_pack: "dockercompose",
      name: appName,
      description: "html-to-img engine, API and dashboard",
      instant_deploy: false,
    });
    log(`  created application ${appName} (${app.uuid})`);
  } else {
    log(`  using existing application ${appName} (${app.uuid})`);
  }

  const patch = { git_branch: branch, docker_compose_location: "/docker-compose.yml" };
  if (domain) patch.docker_compose_domains = [{ name: "app", domain: `https://${domain}:3003` }];
  await request("PATCH", `/applications/${app.uuid}`, patch);
  log(`  compose file /docker-compose.yml, branch ${branch}${domain ? `, domain https://${domain}` : ""}`);

  log("• Environment variables…");
  const envs = [];
  let adminPassword = null;
  if (env.ADMIN_EMAIL && (created || env.ADMIN_PASSWORD)) {
    adminPassword = env.ADMIN_PASSWORD || crypto.randomBytes(12).toString("base64url");
    envs.push({ key: "ADMIN_EMAIL", value: env.ADMIN_EMAIL }, { key: "ADMIN_PASSWORD", value: adminPassword, is_shown_once: true });
  }
  if (env.NODE_IMAGE) envs.push({ key: "NODE_IMAGE", value: env.NODE_IMAGE });
  if (envs.length) {
    await request("PATCH", `/applications/${app.uuid}/envs/bulk`, { data: envs.map((e) => ({ is_preview: false, ...e })) });
    log(`  set ${envs.map((e) => e.key).join(", ")}`);
  } else {
    log("  nothing to change");
  }

  log("• Daily database backup…");
  const tasks = await request("GET", `/applications/${app.uuid}/scheduled-tasks`);
  if ((tasks || []).some((t) => t.name === BACKUP_TASK.name)) {
    log("  already scheduled");
  } else {
    await request("POST", `/applications/${app.uuid}/scheduled-tasks`, { ...BACKUP_TASK, enabled: true, timeout: 300 });
    log(`  scheduled "${BACKUP_TASK.frequency}" (03:00 daily)`);
  }

  const result = {
    appUuid: app.uuid,
    url: domain ? `https://${domain}` : null,
    adminEmail: adminPassword ? env.ADMIN_EMAIL : null,
    adminPassword,
    webhookPath: `/api/v1/deploy?uuid=${app.uuid}&force=false`,
    deployment: null,
  };
  if (env.DEPLOY === "0") return result;

  log("• Deploying (the first build takes a few minutes)…");
  const queued = await request("GET", `/deploy?uuid=${app.uuid}&force=false`);
  const deploymentUuid = queued?.deployments?.[0]?.deployment_uuid;
  if (!deploymentUuid) throw new ProvisionError(`Coolify did not start a deployment: ${JSON.stringify(queued)}`);

  let status = "queued";
  let deployment;
  const deadline = Date.now() + timeoutMs;
  while (!DONE_STATUSES.has(status)) {
    if (Date.now() > deadline) throw new ProvisionError(`Deployment ${deploymentUuid} is still "${status}"; check it in the Coolify dashboard.`);
    await sleep(pollMs);
    deployment = await request("GET", `/deployments/${deploymentUuid}`);
    if (deployment?.status !== status) log(`  status: ${deployment?.status}`);
    status = deployment?.status ?? status;
  }
  result.deployment = { uuid: deploymentUuid, status };
  if (status !== "finished") {
    throw new ProvisionError(`Deployment ${deploymentUuid} ended with status "${status}". Open the application's Deployments tab in Coolify for the build log.`);
  }
  return result;
}

async function main() {
  try {
    const result = await provision(process.env);
    console.log("\n✅ html-to-img is configured" + (result.deployment ? " and deployed." : "."));
    if (result.url) console.log(`   App:         ${result.url}  (health: ${result.url}/healthz)`);
    else console.log("   App:         see the generated domain on the application page in Coolify");
    if (result.adminPassword) {
      console.log(`   Admin login: ${result.adminEmail}`);
      console.log(`   Password:    ${result.adminPassword}   <- shown once, store it in a password manager`);
    }
    console.log(`   Deploy webhook (for GitHub secret COOLIFY_DEPLOY_WEBHOOK): <your Coolify URL>${result.webhookPath}`);
  } catch (err) {
    console.error(`\n❌ ${err instanceof ProvisionError ? err.message : err.stack}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
