import fs from "node:fs";
import path from "node:path";
import { randomId } from "../auth/crypto.js";

/** Stores rendered files under random, unguessable names. */
export function createStorage(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    async save(buffer, ext) {
      const fileName = `${randomId()}.${ext}`;
      await fs.promises.writeFile(path.join(dir, fileName), buffer, { flag: "wx" });
      return fileName;
    },
    async remove(fileName) {
      try {
        await fs.promises.unlink(path.join(dir, path.basename(fileName)));
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    },
  };
}
