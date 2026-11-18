import { parentPort, workerData } from "node:worker_threads";
import { createRenderer } from "./render.js";

const render = createRenderer(workerData);

parentPort.on("message", async ({ id, definition, input, options }) => {
  try {
    const result = await render(definition, input, options);
    // Copy into a standalone ArrayBuffer (Buffers may be slices of a shared pool) and transfer it.
    const bytes = new Uint8Array(result.buffer);
    parentPort.postMessage({ id, result: { ...result, buffer: bytes } }, [bytes.buffer]);
  } catch (err) {
    parentPort.postMessage({
      id,
      error: { message: err.message, status: err.status, code: err.code, details: err.details, stack: err.stack },
    });
  }
});
