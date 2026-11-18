import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createRenderPool, parseDefinition } from "../src/engine/index.js";
import { HttpError } from "../src/lib/errors.js";

const definition = parseDefinition({
  width: 200,
  height: 100,
  params: { text: { type: "string", default: "Hi" } },
  root: { type: "box", style: { backgroundColor: "#7c3aed", width: "100%", height: "100%" }, children: [{ type: "text", text: "{{text}}" }] },
});

const withImage = parseDefinition({
  width: 100,
  height: 100,
  params: { src: { type: "image", default: "" } },
  root: { type: "image", src: "{{src}}", style: { width: 100, height: 100 } },
});

test("render pool renders off the main thread with the renderer's result shape", async () => {
  const render = createRenderPool({ size: 2, renderer: { emojiBaseUrl: "" } });
  try {
    const results = await Promise.all(["png", "jpeg", "svg"].map((format) => render(definition, { text: "Yo" }, { format, scale: 2 })));
    assert.deepEqual(
      results.map(({ format, width, height, contentType }) => [format, width, height, contentType]),
      [
        ["png", 400, 200, "image/png"],
        ["jpeg", 400, 200, "image/jpeg"],
        ["svg", 200, 100, "image/svg+xml"],
      ],
    );
    assert.ok(Buffer.isBuffer(results[0].buffer));
    assert.equal(results[0].buffer.subarray(1, 4).toString(), "PNG");
  } finally {
    await render.close();
  }
});

test("render pool turns worker errors back into HttpErrors", async () => {
  const render = createRenderPool({ size: 1, renderer: { emojiBaseUrl: "" } });
  try {
    await assert.rejects(render(definition, {}, { format: "gif" }), (err) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 422);
      assert.equal(err.code, "validation_error");
      return true;
    });
    // The worker survives a failed render.
    assert.equal((await render(definition, {})).format, "png");
  } finally {
    await render.close();
  }
});

test("render pool times out stuck renders, restarts the worker and rejects when the queue is full", async () => {
  // An image host that never answers keeps the render waiting.
  const hanging = http.createServer(() => {});
  await new Promise((resolve) => hanging.listen(0, "127.0.0.1", resolve));
  const src = `http://127.0.0.1:${hanging.address().port}/x.png`;
  const render = createRenderPool({
    size: 1,
    concurrency: 1,
    maxQueue: 1,
    timeoutMs: 2000,
    renderer: { emojiBaseUrl: "", images: { allowPrivate: true, timeoutMs: 60_000 } },
  });
  try {
    const stuck = render(withImage, { src });
    const queued = render(definition, {});
    await assert.rejects(render(definition, {}), (err) => err.status === 503 && err.code === "busy");
    await assert.rejects(stuck, (err) => err.status === 504 && err.code === "render_timeout");
    // The queued render runs on the replacement worker.
    assert.equal((await queued).format, "png");
    assert.equal(render.stats().workers, 1);
  } finally {
    await render.close();
    hanging.closeAllConnections();
    hanging.close();
  }
});
