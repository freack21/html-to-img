import { test } from "node:test";
import assert from "node:assert/strict";
import { provision, ProvisionError } from "./provision.mjs";

/** In-memory stand-in for the subset of the Coolify API that provision() uses. */
function fakeCoolify({ deployStatuses = ["in_progress", "finished"], status = 200, appStatus = "exited" } = {}) {
  const state = { projects: [], apps: [], envs: {}, tasks: {}, patches: [], calls: [] };
  let statuses = [...deployStatuses];
  const json = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { "content-type": "application/json" } });

  const fetchImpl = async (url, init) => {
    const { pathname, search } = new URL(url);
    const path = pathname.replace("/api/v1", "") + search;
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push(`${init.method} ${path}`);
    assert.equal(init.headers.authorization, "Bearer token-1");
    if (status !== 200) return json(status, { message: "nope" });

    let m;
    if (init.method === "GET" && path === "/servers") return json(200, [{ uuid: "srv-x", name: "other" }, { uuid: "srv-1", name: "localhost" }]);
    if (init.method === "GET" && path === "/projects") return json(200, state.projects);
    if (init.method === "POST" && path === "/projects") {
      const project = { uuid: `prj-${state.projects.length + 1}`, name: body.name };
      state.projects.push(project);
      return json(201, { uuid: project.uuid });
    }
    if (init.method === "GET" && path === "/applications") return json(200, state.apps);
    if (init.method === "POST" && path === "/applications/public") {
      assert.equal(body.build_pack, "dockercompose");
      assert.equal(body.server_uuid, "srv-1");
      state.lastAppBody = body;
      const app = { uuid: `app-${state.apps.length + 1}`, name: body.name, git_repository: "freack21/html-to-img" };
      state.apps.push(app);
      return json(201, { uuid: app.uuid });
    }
    if (init.method === "GET" && (m = /^\/applications\/([\w-]+)$/.exec(path))) return json(200, { uuid: m[1], status: appStatus });
    if (init.method === "PATCH" && (m = /^\/applications\/([\w-]+)$/.exec(path))) {
      state.patches.push(body);
      return json(200, { uuid: m[1] });
    }
    if (init.method === "PATCH" && (m = /^\/applications\/([\w-]+)\/envs\/bulk$/.exec(path))) {
      state.envs[m[1]] = [...(state.envs[m[1]] || []), ...body.data];
      return json(201, body.data);
    }
    if ((m = /^\/applications\/([\w-]+)\/scheduled-tasks$/.exec(path))) {
      state.tasks[m[1]] ||= [];
      if (init.method === "GET") return json(200, state.tasks[m[1]]);
      state.tasks[m[1]].push(body);
      return json(201, body);
    }
    if (init.method === "GET" && path.startsWith("/deploy?")) return json(405, { message: "This endpoint has changed to a POST request." });
    if (init.method === "POST" && path.startsWith("/deploy?uuid=")) {
      statuses = [...deployStatuses];
      return json(200, { deployments: [{ deployment_uuid: "dep-1", resource_uuid: "app-1", message: "queued" }] });
    }
    if (init.method === "GET" && path === "/deployments/dep-1") return json(200, { status: statuses.shift() ?? "finished" });
    return json(404, { message: `no route ${init.method} ${path}` });
  };
  return { state, fetchImpl };
}

const base = { COOLIFY_URL: "http://coolify.test:8000/", COOLIFY_TOKEN: "token-1" };
const quiet = { log: () => {}, sleep: async () => {}, pollMs: 0 };

test("first run creates everything, sets admin env and deploys", async () => {
  const { state, fetchImpl } = fakeCoolify();
  const result = await provision({ ...base, APP_DOMAIN: "https://img.example.com/", ADMIN_EMAIL: "me@example.com" }, { fetchImpl, ...quiet });

  assert.deepEqual(state.projects.map((p) => p.name), ["DIGISION-DEV"]);
  assert.equal(state.apps.length, 1);
  assert.deepEqual(state.patches[0].docker_compose_domains, [{ name: "app", domain: "https://img.example.com:3003" }]);
  assert.equal(state.patches[0].docker_compose_location, "/docker-compose.yml");
  const envs = Object.fromEntries(state.envs["app-1"].map((e) => [e.key, e.value]));
  assert.equal(envs.ADMIN_EMAIL, "me@example.com");
  assert.equal(envs.ADMIN_PASSWORD, result.adminPassword);
  assert.ok(result.adminPassword.length >= 16);
  assert.equal(state.tasks["app-1"].length, 1);
  assert.equal(state.tasks["app-1"][0].container, "app");
  assert.equal(result.url, "https://img.example.com");
  assert.deepEqual(result.deployment, { uuid: "dep-1", status: "finished" });
  assert.equal(result.webhookPath, "/api/v1/deploy?uuid=app-1&force=false");
});

test("re-running reuses resources and keeps the password of a running app", async () => {
  const { state, fetchImpl } = fakeCoolify({ appStatus: "running:healthy" });
  const env = { ...base, ADMIN_EMAIL: "me@example.com", DEPLOY: "0" };
  await provision(env, { fetchImpl, ...quiet });
  const callsBefore = state.calls.length;
  const second = await provision(env, { fetchImpl, ...quiet });

  assert.equal(state.projects.length, 1);
  assert.ok(!state.calls.slice(callsBefore).some((c) => c.includes("/projects")), "existing app: project untouched");
  assert.equal(state.apps.length, 1);
  assert.equal(state.tasks["app-1"].length, 1);
  assert.equal(state.envs["app-1"].filter((e) => e.key === "ADMIN_PASSWORD").length, 1);
  assert.equal(second.adminPassword, null);
  assert.equal(second.deployment, null);
  assert.ok(!state.calls.some((c) => c.includes("/deploy?")));
});

test("re-running after a failed first deploy issues a new admin password and prints it early", async () => {
  const { state, fetchImpl } = fakeCoolify({ appStatus: "exited" });
  const lines = [];
  await provision({ ...base, ADMIN_EMAIL: "me@example.com", DEPLOY: "0" }, { fetchImpl, ...quiet });
  const second = await provision({ ...base, ADMIN_EMAIL: "me@example.com" }, { fetchImpl, ...quiet, log: (l) => lines.push(l) });

  const passwords = state.envs["app-1"].filter((e) => e.key === "ADMIN_PASSWORD").map((e) => e.value);
  assert.equal(passwords.length, 2);
  assert.equal(second.adminPassword, passwords[1]);
  const printed = lines.findIndex((l) => l.includes(second.adminPassword));
  const deploying = lines.findIndex((l) => l.includes("Deploying"));
  assert.ok(printed >= 0 && printed < deploying, "password is printed before deploying");
  assert.ok(state.calls.includes("POST /deploy?uuid=app-1&force=false"));
});

test("a failed deployment is reported", async () => {
  const { fetchImpl } = fakeCoolify({ deployStatuses: ["in_progress", "failed"] });
  await assert.rejects(provision(base, { fetchImpl, ...quiet }), (err) => err instanceof ProvisionError && /status "failed"/.test(err.message));
});

test("API access errors explain how to fix them", async () => {
  const { fetchImpl } = fakeCoolify({ status: 403 });
  await assert.rejects(provision(base, { fetchImpl, ...quiet }), /API access must be Enabled.*Coolify says: "nope"|Coolify says: "nope".*API access must be Enabled/);
  await assert.rejects(
    provision({ ...base, COOLIFY_SOURCE_HINT: "10.0.0.0/8" }, { fetchImpl, ...quiet }),
    /Docker network 10\.0\.0\.0\/8, so Allowed IPs must include it/,
  );
  await assert.rejects(provision({ COOLIFY_URL: "", COOLIFY_TOKEN: "" }, quiet), /required/);
  const offline = async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  };
  await assert.rejects(provision(base, { fetchImpl: offline, ...quiet }), /Cannot reach Coolify.*ECONNREFUSED/);
});

test("a new application goes into an existing project chosen by name", async () => {
  const { state, fetchImpl } = fakeCoolify();
  state.projects.push({ uuid: "prj-existing", name: "Team Apps" });
  await provision({ ...base, PROJECT_NAME: "Team Apps", DEPLOY: "0" }, { fetchImpl, ...quiet });
  assert.equal(state.projects.length, 1);
  assert.equal(state.lastAppBody.project_uuid, "prj-existing");
});
