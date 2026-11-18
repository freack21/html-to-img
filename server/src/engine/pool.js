import os from "node:os";
import { Worker } from "node:worker_threads";
import { HttpError } from "../lib/errors.js";

const WORKER_URL = new URL("./worker.js", import.meta.url);

export function defaultPoolSize() {
  return Math.min(4, Math.max(1, os.availableParallelism()));
}

/**
 * Runs renders in worker threads so satori/resvg/JPEG work never blocks the HTTP
 * event loop. Returns a function with the same signature as createRenderer()'s.
 *
 * - each worker runs up to `concurrency` renders (they await remote images);
 * - at most `maxQueue` renders wait for a free slot, beyond that callers get 503;
 * - a render running longer than `timeoutMs` gets 504 and its worker is replaced.
 */
export function createRenderPool({ size = defaultPoolSize(), concurrency = 2, maxQueue = 64, timeoutMs = 30_000, renderer = {} } = {}) {
  const workers = [];
  const queue = [];
  let nextId = 1;
  let closed = false;

  // Split the remote-image cache budget across workers.
  const cacheBytes = Math.floor((renderer.images?.cacheBytes ?? 64 * 1024 * 1024) / size);
  const workerData = { ...renderer, images: { ...renderer.images, cacheBytes } };

  const fail = (slot, error) => {
    for (const task of slot.tasks.values()) {
      clearTimeout(task.timer);
      task.reject(error);
    }
    slot.tasks.clear();
  };

  const replace = (slot, error) => {
    if (slot.dead) return;
    slot.dead = true;
    fail(slot, error);
    slot.worker.terminate();
    const index = workers.indexOf(slot);
    if (index !== -1) workers.splice(index, 1, ...(closed ? [] : [spawn()]));
    drain();
  };

  function spawn() {
    const slot = { worker: new Worker(WORKER_URL, { workerData }), tasks: new Map(), dead: false };
    slot.worker.on("message", ({ id, result, error }) => {
      const task = slot.tasks.get(id);
      if (!task) return;
      slot.tasks.delete(id);
      clearTimeout(task.timer);
      if (error) {
        const err = error.status
          ? new HttpError(error.status, error.message, { code: error.code, details: error.details })
          : Object.assign(new Error(error.message), { stack: error.stack });
        task.reject(err);
      } else {
        task.resolve({ ...result, buffer: Buffer.from(result.buffer.buffer, result.buffer.byteOffset, result.buffer.byteLength) });
      }
      drain();
    });
    slot.worker.on("error", (err) => replace(slot, err));
    slot.worker.on("exit", (code) => {
      if (!slot.dead && !closed) replace(slot, new Error(`render worker exited with code ${code}`));
    });
    return slot;
  }

  function dispatch(slot, task) {
    const id = nextId++;
    task.timer = setTimeout(
      () => replace(slot, new HttpError(504, `Rendering took longer than ${timeoutMs / 1000}s`, { code: "render_timeout" })),
      timeoutMs,
    );
    slot.tasks.set(id, task);
    slot.worker.postMessage({ id, ...task.message });
  }

  function drain() {
    while (queue.length) {
      const slot = workers.reduce((best, s) => (!best || s.tasks.size < best.tasks.size ? s : best), null);
      if (!slot || slot.tasks.size >= concurrency) return;
      dispatch(slot, queue.shift());
    }
  }

  for (let i = 0; i < size; i++) workers.push(spawn());

  async function render(definition, input, options = {}) {
    if (closed) throw new HttpError(503, "Renderer is shutting down", { code: "busy" });
    if (queue.length >= maxQueue) {
      throw new HttpError(503, "The server is busy, try again in a moment", { code: "busy" });
    }
    return new Promise((resolve, reject) => {
      queue.push({ message: { definition, input, options }, resolve, reject });
      drain();
    });
  }

  render.close = async () => {
    closed = true;
    for (const task of queue.splice(0)) task.reject(new HttpError(503, "Renderer is shutting down", { code: "busy" }));
    await Promise.all(
      workers.splice(0).map((slot) => {
        slot.dead = true;
        fail(slot, new HttpError(503, "Renderer is shutting down", { code: "busy" }));
        return slot.worker.terminate();
      }),
    );
  };
  render.stats = () => ({ workers: workers.length, running: workers.reduce((n, s) => n + s.tasks.size, 0), queued: queue.length });
  return render;
}
