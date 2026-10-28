import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db/index.js";
import { seed } from "../src/db/seed.js";
import { createRenderer } from "../src/engine/index.js";
import { cleanupExpired } from "../src/services/renders.js";
import { updateSettings } from "../src/services/settings.js";
import { createStorage } from "../src/services/storage.js";

const silentLogger = { error() {} };

async function startServer() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hti-test-"));
  const config = { ...loadConfig({}), databasePath: ":memory:", storageDir: path.join(tmp, "storage"), webDistDir: path.join(tmp, "none") };
  const db = openDatabase(":memory:");
  seed(db, { templatesDir: config.templatesDir });
  const storage = createStorage(config.storageDir);
  const renderer = createRenderer({ emojiBaseUrl: "" });
  const app = createApp({ db, config, renderer, storage, logger: silentLogger });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    db,
    storage,
    base,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      fs.rmSync(tmp, { recursive: true, force: true });
    },
  };
}

/** Minimal client that keeps the session cookie like a browser would. */
function client(base) {
  let cookie = null;
  const call = async (method, url, { body, headers = {} } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: {
        ...(body !== undefined && { "content-type": "application/json" }),
        ...(cookie && { cookie }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0].endsWith("=") ? null : setCookie.split(";")[0];
    const type = res.headers.get("content-type") || "";
    const data = type.includes("json") ? await res.json() : Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, data };
  };
  return {
    get: (url, opts) => call("GET", url, opts),
    post: (url, body, opts) => call("POST", url, { ...opts, body }),
    patch: (url, body, opts) => call("PATCH", url, { ...opts, body }),
    delete: (url, opts) => call("DELETE", url, opts),
  };
}

let ctx;
before(async () => {
  ctx = await startServer();
});
after(() => ctx.close());

const isPng = (buf) => Buffer.isBuffer(buf) && buf.subarray(1, 4).toString() === "PNG";

describe("guest rendering", () => {
  test("GET render returns an image with quota headers", async () => {
    const res = await client(ctx.base).get("/api/v1/render?template=qc&name=Guest");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "image/png");
    assert.ok(isPng(res.data));
    assert.equal(res.headers.get("x-quota-limit"), "10");
    assert.ok(res.headers.get("x-render-id"));
  });

  test("rejects premium templates, high scale and invalid params", async () => {
    const api = client(ctx.base);
    assert.equal((await api.get("/api/v1/render?template=certificate")).data.error.code, "premium_template");
    assert.equal((await api.get("/api/v1/render?template=qc&scale=2")).data.error.code, "scale_not_allowed");
    const invalid = await api.post("/api/v1/render", { template: "qc", params: { bgColor: "url(http://x)" } });
    assert.equal(invalid.status, 422);
    assert.equal(invalid.data.error.details[0].path, "bgColor");
    assert.equal((await api.get("/api/v1/render?template=missing")).status, 404);
  });

  test("daily guest limit is enforced", async () => {
    updateSettings(ctx.db, { guestDailyLimit: 0 });
    try {
      const res = await client(ctx.base).get("/api/v1/render?template=qc");
      assert.equal(res.status, 402);
      assert.equal(res.data.error.code, "quota_exceeded");
    } finally {
      updateSettings(ctx.db, { guestDailyLimit: 10 });
    }
  });

  test("preview is available without quota and drafts are admin-only", async () => {
    const api = client(ctx.base);
    const preview = await api.post("/api/v1/preview", { template: "tweet", params: { username: "X" } });
    assert.equal(preview.status, 200);
    assert.ok(isPng(preview.data));
    const draft = await api.post("/api/v1/preview", { definition: { width: 10, root: { type: "box" } } });
    assert.equal(draft.status, 403);
  });

  test("template catalog and thumbnails are public", async () => {
    const api = client(ctx.base);
    const list = await api.get("/api/v1/templates");
    assert.ok(list.data.data.length >= 13);
    assert.equal(list.data.data[0].root, undefined, "layout tree is not exposed");
    const thumb = await api.get("/api/v1/templates/qc/thumbnail.png");
    assert.ok(isPng(thumb.data));
  });
});

describe("accounts", () => {
  const user = { email: "user@example.com", password: "correct horse battery", name: "User" };
  let api;

  before(async () => {
    api = client(ctx.base);
    const res = await api.post("/api/v1/auth/register", user);
    assert.equal(res.status, 201);
    assert.equal(res.data.data.plan.slug, "free");
  });

  test("duplicate email and bad credentials are rejected", async () => {
    assert.equal((await client(ctx.base).post("/api/v1/auth/register", user)).status, 409);
    const bad = await client(ctx.base).post("/api/v1/auth/login", { email: user.email, password: "wrong-password" });
    assert.equal(bad.status, 401);
    const unknown = await client(ctx.base).post("/api/v1/auth/login", { email: "nobody@example.com", password: "whatever1" });
    assert.equal(unknown.data.error.message, bad.data.error.message);
  });

  test("render to URL stores a file and shows up in history", async () => {
    const res = await api.post("/api/v1/render", { template: "quote", format: "jpg", output: "url" });
    assert.equal(res.status, 201);
    assert.equal(res.data.data.format, "jpeg");
    const file = await fetch(res.data.data.url);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "image/jpeg");

    const history = await api.get("/api/v1/me/renders");
    assert.equal(history.data.data.total, 1);
    assert.match(history.data.data.items[0].url, /^\/files\//);

    const me = await api.get("/api/v1/auth/me");
    assert.equal(me.data.data.usage.used, 1);
    assert.equal(me.data.data.usage.limit, 100);
  });

  test("API keys authenticate renders and can be revoked", async () => {
    const created = await api.post("/api/v1/me/api-keys", { name: "bot" });
    assert.equal(created.status, 201);
    const { key, apiKey } = created.data.data;
    assert.match(key, /^hti_/);

    const rendered = await client(ctx.base).get("/api/v1/render?template=qc", { headers: { authorization: `Bearer ${key}` } });
    assert.equal(rendered.status, 200);
    assert.equal(rendered.headers.get("x-quota-limit"), "100");

    // API keys cannot manage keys or reach admin routes.
    const keyClient = { headers: { "x-api-key": key } };
    assert.equal((await client(ctx.base).get("/api/v1/me/api-keys", keyClient)).status, 401);
    assert.equal((await client(ctx.base).get("/api/v1/admin/stats", keyClient)).status, 401);

    assert.equal((await api.delete(`/api/v1/me/api-keys/${apiKey.id}`)).status, 200);
    const revoked = await client(ctx.base).get("/api/v1/render?template=qc", { headers: { authorization: `Bearer ${key}` } });
    assert.equal(revoked.status, 401);
    assert.equal((await client(ctx.base).get("/api/v1/render?template=qc", { headers: { "x-api-key": "hti_fake" } })).status, 401);
  });

  test("cross-origin cookie requests are rejected", async () => {
    const res = await api.post("/api/v1/me/api-keys", { name: "evil" }, { headers: { origin: "https://evil.example" } });
    assert.equal(res.status, 403);
    assert.equal(res.data.error.code, "bad_origin");
  });

  test("non-admins cannot use admin routes", async () => {
    assert.equal((await api.get("/api/v1/admin/stats")).status, 403);
    assert.equal((await client(ctx.base).get("/api/v1/admin/stats")).status, 401);
  });

  test("password change and logout", async () => {
    const wrong = await api.post("/api/v1/me/password", { currentPassword: "nope-nope", newPassword: "another password" });
    assert.equal(wrong.status, 400);
    const ok = await api.post("/api/v1/me/password", { currentPassword: user.password, newPassword: "another password" });
    assert.equal(ok.status, 200);
    await api.post("/api/v1/auth/logout", {});
    assert.equal((await api.get("/api/v1/auth/me")).data.data.user, null);
    const login = await api.post("/api/v1/auth/login", { email: user.email, password: "another password" });
    assert.equal(login.status, 200);
  });
});

describe("admin", () => {
  let admin;
  let userId;

  before(async () => {
    admin = client(ctx.base);
    await admin.post("/api/v1/auth/register", { email: "admin@example.com", password: "admin password 1", name: "Admin" });
    ctx.db.prepare("UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'").run();
    userId = ctx.db.prepare("SELECT id FROM users WHERE email = 'user@example.com'").get().id;
  });

  test("stats, users and plan assignment", async () => {
    const stats = await admin.get("/api/v1/admin/stats");
    assert.equal(stats.status, 200);
    assert.ok(stats.data.data.renders30d >= 1);

    const users = await admin.get("/api/v1/admin/users?q=user@");
    assert.equal(users.data.data.total, 1);

    const pro = (await admin.get("/api/v1/admin/plans")).data.data.find((p) => p.slug === "pro");
    const updated = await admin.patch(`/api/v1/admin/users/${userId}`, { planId: pro.id });
    assert.equal(updated.data.data.planId, pro.id);

    const self = ctx.db.prepare("SELECT id FROM users WHERE email = 'admin@example.com'").get().id;
    assert.equal((await admin.patch(`/api/v1/admin/users/${self}`, { role: "user" })).status, 409);
  });

  test("template CRUD with validation and versioning", async () => {
    const definition = {
      width: 300,
      params: { title: { type: "string", default: "Hello" } },
      root: { type: "box", style: { padding: 20, backgroundColor: "#fff" }, children: [{ type: "text", text: "{{title}}" }] },
    };
    const bad = await admin.post("/api/v1/admin/templates", { slug: "x", name: "X", definition: { width: 1 } });
    assert.equal(bad.status, 422);

    const created = await admin.post("/api/v1/admin/templates", { slug: "hello", name: "Hello", definition });
    assert.equal(created.status, 201);
    const { id } = created.data.data;

    const draft = await admin.post("/api/v1/preview", { definition, params: { title: "Draft" } });
    assert.ok(isPng(draft.data));

    const renamed = await admin.patch(`/api/v1/admin/templates/${id}`, { name: "Hello 2" });
    assert.equal(renamed.data.data.version, 1);
    const changed = await admin.patch(`/api/v1/admin/templates/${id}`, { definition: { ...definition, width: 400 } });
    assert.equal(changed.data.data.version, 2);

    const rendered = await client(ctx.base).get("/api/v1/render?template=hello&title=Hi");
    assert.equal(rendered.status, 200);

    await admin.patch(`/api/v1/admin/templates/${id}`, { isActive: false });
    assert.equal((await client(ctx.base).get("/api/v1/render?template=hello")).status, 404);
    assert.equal((await admin.delete(`/api/v1/admin/templates/${id}`)).status, 200);
  });

  test("plans and settings", async () => {
    const plan = await admin.post("/api/v1/admin/plans", { slug: "tiny", name: "Tiny", monthlyQuota: 1 });
    assert.equal(plan.status, 201);
    const free = (await admin.get("/api/v1/admin/plans")).data.data.find((p) => p.slug === "free");
    assert.equal((await admin.delete(`/api/v1/admin/plans/${free.id}`)).status, 409);
    assert.equal((await admin.delete(`/api/v1/admin/plans/${plan.data.data.id}`)).status, 200);

    const settings = await admin.patch("/api/v1/admin/settings", { guestDailyLimit: 25 });
    assert.equal(settings.data.data.guestDailyLimit, 25);
    assert.equal((await admin.patch("/api/v1/admin/settings", { unknown: 1 })).status, 422);
  });
});

test("cleanup removes expired files and tolerates missing ones", async () => {
  const name = await ctx.storage.save(Buffer.from("x"), "png");
  ctx.db
    .prepare(
      `INSERT INTO renders (id, template_slug, format, width, height, bytes, duration_ms, source, file_name, expires_at, created_at)
       VALUES ('old1', 'qc', 'png', 1, 1, 1, 1, 'web', ?, '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z'),
              ('old2', 'qc', 'png', 1, 1, 1, 1, 'web', 'missing.png', '2000-01-01T00:00:00.000Z', '2000-01-01T00:00:00.000Z')`,
    )
    .run(name);
  assert.equal(await cleanupExpired(ctx.db, ctx.storage), 2);
  assert.equal(fs.existsSync(path.join(ctx.storage.dir, name)), false);
  assert.equal(await cleanupExpired(ctx.db, ctx.storage), 0);
});
