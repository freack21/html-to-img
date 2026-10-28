import { ValidationError } from "../lib/errors.js";
import { PARAM_REF, parseCondition } from "./schema.js";

const SINGLE_REF = /^\{\{\s*([a-zA-Z_]\w*)\s*\}\}$/;

function isTruthy(value) {
  return value !== "" && value !== false && value !== null && value !== undefined;
}

export function resolveValue(value, params) {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const key = String(params[value.$switch]);
    const resolved = Object.hasOwn(value.cases, key) ? value.cases[key] : (value.default ?? "");
    return resolveValue(resolved, params);
  }
  // A lone placeholder keeps the param's type, so "{{fontSize}}" stays a number.
  const single = SINGLE_REF.exec(value);
  if (single) return params[single[1]] ?? "";
  return value.replace(PARAM_REF, (_, name) => String(params[name] ?? ""));
}

export function evaluateCondition(cond, params) {
  const { negate, name, op, operand } = parseCondition(cond);
  let result;
  if (op === "==") result = String(params[name]) === operand;
  else if (op === "!=") result = String(params[name]) !== operand;
  else result = isTruthy(params[name]);
  return negate ? !result : result;
}

function resolveStyle(style = {}, params) {
  const out = {};
  for (const [key, raw] of Object.entries(style)) {
    const val = resolveValue(raw, params);
    // Satori fetches url() references itself; only <image> nodes may load images.
    if (typeof val === "string" && /url\s*\(/i.test(val)) {
      throw new ValidationError(`Style "${key}" may not contain url()`);
    }
    if (val !== "") out[key] = val;
  }
  return out;
}

function buildNode(node, params) {
  if (node.if && !evaluateCondition(node.if, params)) return null;
  // border-box makes `width: 100%` + padding behave the way template authors expect.
  const style = { boxSizing: "border-box", ...resolveStyle(node.style, params) };
  switch (node.type) {
    case "box":
      return {
        type: "div",
        props: {
          style: { display: "flex", ...style },
          children: node.children.map((child) => buildNode(child, params)).filter(Boolean),
        },
      };
    case "text":
      return { type: "div", props: { style, children: String(resolveValue(node.text, params)) } };
    case "image": {
      const src = String(resolveValue(node.src, params)).trim();
      if (!src) return null;
      return { type: "img", props: { src, style } };
    }
    default:
      return null;
  }
}

/** Converts a template definition + resolved params into a Satori element tree. */
export function buildElement(definition, params) {
  return buildNode(definition.root, params) ?? { type: "div", props: { style: { display: "flex" } } };
}

export function walkElements(element, visit) {
  visit(element);
  const { children } = element.props;
  if (Array.isArray(children)) children.forEach((child) => walkElements(child, visit));
}
