import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = String(stored).split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(expected, actual);
}

export const randomToken = (prefix = "") => prefix + crypto.randomBytes(32).toString("base64url");
export const randomId = () => crypto.randomBytes(12).toString("base64url");
export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Used to keep login timing similar for unknown emails.
export const DUMMY_HASH = await hashPassword(crypto.randomBytes(16).toString("hex"));
