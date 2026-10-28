import { ValidationError } from "../lib/errors.js";
import { COLOR_RE } from "./schema.js";

const TRUE = new Set([true, "true", "1", "on", "yes", 1]);
const FALSE = new Set([false, "false", "0", "off", "no", 0]);
const IMAGE_RE = /^(https?:\/\/\S+|data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+)$/;
const MAX_DATA_URI_LENGTH = 15 * 1024 * 1024;

function coerce(spec, raw) {
  switch (spec.type) {
    case "string": {
      const str = String(raw);
      if (str.length > spec.maxLength) throw new Error(`must be at most ${spec.maxLength} characters`);
      return str;
    }
    case "number": {
      const num = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(num)) throw new Error("must be a number");
      if (spec.min !== undefined && num < spec.min) throw new Error(`must be >= ${spec.min}`);
      if (spec.max !== undefined && num > spec.max) throw new Error(`must be <= ${spec.max}`);
      return num;
    }
    case "color": {
      const str = String(raw).trim();
      if (!COLOR_RE.test(str)) throw new Error("must be a CSS color (hex, rgb(), hsl() or a named color)");
      return str;
    }
    case "boolean": {
      const val = typeof raw === "string" ? raw.toLowerCase() : raw;
      if (TRUE.has(val)) return true;
      if (FALSE.has(val)) return false;
      throw new Error("must be true or false");
    }
    case "enum": {
      const str = String(raw);
      if (!spec.options.includes(str)) throw new Error(`must be one of: ${spec.options.join(", ")}`);
      return str;
    }
    case "image": {
      const str = String(raw).trim();
      if (str === "") return "";
      if (str.length > MAX_DATA_URI_LENGTH || !IMAGE_RE.test(str)) {
        throw new Error("must be an http(s) URL or a base64 image data URI");
      }
      return str;
    }
    default:
      throw new Error("has an unknown type");
  }
}

/**
 * Validates user input against the template's param specs.
 * Missing values fall back to defaults; an empty string clears string/image params.
 * Unknown keys are ignored.
 */
export function resolveParams(specs, input = {}) {
  const values = {};
  const errors = [];
  for (const [name, spec] of Object.entries(specs)) {
    const raw = Object.hasOwn(input, name) ? input[name] : undefined;
    const missing =
      raw === undefined || raw === null || (raw === "" && spec.type !== "string" && spec.type !== "image");
    if (missing) {
      values[name] = spec.default;
      continue;
    }
    try {
      values[name] = coerce(spec, raw);
    } catch (err) {
      errors.push({ path: name, message: `${name} ${err.message}` });
    }
  }
  if (errors.length) throw new ValidationError("Invalid template params", errors);
  return values;
}
