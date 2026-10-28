import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRenderer, parseDefinition } from "../src/engine/index.js";
import { buildElement, evaluateCondition, resolveValue } from "../src/engine/build.js";
import { emojiCode } from "../src/engine/emoji.js";
import { createImageLoader, isBlockedAddress, sniffImage } from "../src/engine/images.js";
import { resolveParams } from "../src/engine/params.js";
import { clientKey } from "../src/lib/client.js";

const TEMPLATES_DIR = path.join(import.meta.dirname, "../templates");
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

const render = createRenderer();

const simple = parseDefinition({
  width: 200,
  params: {
    title: { type: "string", default: "Hi", maxLength: 10 },
    size: { type: "number", default: 20, min: 8, max: 40 },
    color: { type: "color", default: "#000" },
    show: { type: "boolean", default: true },
    theme: { type: "enum", options: ["dark", "light"], default: "dark" },
    pic: { type: "image" },
  },
  root: {
    type: "box",
    style: { backgroundColor: { $switch: "theme", cases: { dark: "#000" }, default: "#fff" } },
    children: [
      { type: "text", text: "{{title}}!", style: { fontSize: "{{size}}", color: "{{color}}" } },
      { type: "text", if: "show", text: "shown" },
      { type: "text", if: "theme == light", text: "light" },
      { type: "image", if: "pic", src: "{{pic}}", style: { width: 10, height: 10 } },
    ],
  },
});

test("every bundled template is valid and renders with defaults", async () => {
  const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 13);
  for (const file of files) {
    const template = JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), "utf8"));
    assert.equal(`${template.slug}.json`, file);
    const result = await render(parseDefinition(template.definition), {});
    assert.equal(sniffImage(result.buffer), "image/png", file);
    assert.ok(result.width > 0 && result.height > 0, file);
  }
});

test("renders png, jpeg and svg with the requested scale", async () => {
  const png = await render(simple, {}, { format: "png", scale: 2 });
  assert.equal(png.width, 400);
  assert.equal(png.contentType, "image/png");
  const jpeg = await render(simple, {}, { format: "jpeg" });
  assert.equal(sniffImage(jpeg.buffer), "image/jpeg");
  const svg = await render(simple, {}, { format: "svg" });
  assert.match(svg.buffer.toString(), /^<svg/);
  assert.equal(svg.width, 200);
  await assert.rejects(render(simple, {}, { format: "gif" }), { status: 422 });
});

test("watermark is added to the tree when requested", async () => {
  const plain = await render(simple, {}, { format: "svg" });
  const marked = await render(simple, {}, { format: "svg", watermark: "html-to-img" });
  assert.notEqual(plain.buffer.length, marked.buffer.length);
});

test("resolveParams coerces query-string values and applies defaults", () => {
  const values = resolveParams(simple.params, { size: "30", show: "false", theme: "light", title: "" });
  assert.deepEqual(values, { title: "", size: 30, color: "#000", show: false, theme: "light", pic: "" });
});

test("resolveParams rejects invalid values with per-param details", () => {
  assert.throws(
    () => resolveParams(simple.params, { size: "99", color: "red;background:url(x)", theme: "blue", title: "x".repeat(11), pic: "file:///etc/passwd" }),
    (err) => {
      assert.equal(err.status, 422);
      assert.deepEqual(err.details.map((d) => d.path).sort(), ["color", "pic", "size", "theme", "title"]);
      return true;
    },
  );
});

test("text values are rendered as text, never as markup", () => {
  const el = buildElement(simple, resolveParams(simple.params, { title: "<script>" }));
  assert.equal(el.props.children[0].props.children, "<script>!");
});

test("conditions, switches and typed placeholders", () => {
  const params = { a: "x", n: 5, empty: "", off: false };
  assert.equal(evaluateCondition("a", params), true);
  assert.equal(evaluateCondition("!empty", params), true);
  assert.equal(evaluateCondition("off", params), false);
  assert.equal(evaluateCondition("a == x", params), true);
  assert.equal(evaluateCondition("a != x", params), false);
  assert.equal(resolveValue("{{n}}", params), 5);
  assert.equal(resolveValue("{{n}}px", params), "5px");
  assert.equal(resolveValue({ $switch: "a", cases: { x: "{{n}}" } }, params), 5);
  assert.equal(resolveValue({ $switch: "a", cases: {}, default: "d" }, params), "d");
});

test("conditional nodes are dropped", () => {
  const el = buildElement(simple, resolveParams(simple.params, { show: "false" }));
  const texts = el.props.children.map((c) => c.props.children);
  assert.deepEqual(texts, ["Hi!"]);
});

test("style values may not contain url()", () => {
  const def = parseDefinition({
    width: 100,
    params: { bg: { type: "string", default: "url(http://169.254.169.254/)" } },
    root: { type: "box", style: { backgroundImage: "{{bg}}" } },
  });
  assert.throws(() => buildElement(def, resolveParams(def.params, {})), /url\(\)/);
});

test("definition validation catches unknown params, fonts and bad defaults", () => {
  assert.throws(
    () =>
      parseDefinition({
        width: 100,
        params: { e: { type: "enum", options: ["a"], default: "b" } },
        root: {
          type: "box",
          if: "missing",
          style: { fontFamily: "Comic Sans" },
          children: [{ type: "text", text: "{{nope}}" }],
        },
      }),
    (err) => {
      const messages = err.details.map((d) => d.message).join("\n");
      assert.match(messages, /not one of the options/);
      assert.match(messages, /Unknown param "missing"/);
      assert.match(messages, /Unknown param "nope"/);
      assert.match(messages, /Unknown font family/);
      return true;
    },
  );
});

test("private and special addresses are blocked", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "not-an-ip"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test("image loader validates data URIs by magic bytes", async () => {
  const load = createImageLoader({ maxBytes: 1024 });
  const uri = await load(`data:image/png;base64,${PNG_1PX.toString("base64")}`);
  assert.match(uri, /^data:image\/png;base64,/);
  const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>").toString("base64");
  await assert.rejects(load(`data:image/svg+xml;base64,${svg}`), /Unsupported image format/);
  await assert.rejects(load(`data:image/png;base64,${Buffer.alloc(2048).toString("base64")}`), /exceeds/);
});

test("image loader refuses private hosts and follows safe redirects only", async (t) => {
  const server = http.createServer((req, res) => {
    if (req.url === "/img.png") return res.end(PNG_1PX);
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/img.png" });
      return res.end();
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;

  for (const url of [`${base}/img.png`, "http://[::1]/x.png", "http://2130706433/x.png", "http://0x7f.1/x.png"]) {
    await assert.rejects(createImageLoader()(url), /Blocked image host/, url);
  }
  await assert.rejects(createImageLoader()("http://localhost:1/x.png"), /Blocked image host/);

  const permissive = createImageLoader({ allowPrivate: true, maxBytes: 1024 });
  assert.match(await permissive(`${base}/redirect`), /^data:image\/png/);
  await assert.rejects(permissive(`${base}/missing`), /HTTP 404/);
});

test("emoji code points follow Twemoji naming", () => {
  assert.equal(emojiCode("🚀"), "1f680");
  assert.equal(emojiCode("❤️"), "2764");
  assert.equal(emojiCode("👨‍💻"), "1f468-200d-1f4bb");
});

test("client keys group IPv6 clients by /64", () => {
  assert.equal(clientKey("203.0.113.9"), "203.0.113.9");
  assert.equal(clientKey("::ffff:203.0.113.9"), "203.0.113.9");
  assert.equal(clientKey("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
  assert.equal(clientKey("2001:db8:1:2:bbbb:cccc:dddd:eeee"), "2001:db8:1:2::/64");
  assert.equal(clientKey("2001:db8::1"), "2001:db8:0:0::/64");
  assert.equal(clientKey("::1"), "0:0:0:0::/64");
});
