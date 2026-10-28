import { z } from "zod";
import { FONT_FAMILIES, isKnownFamily } from "./fonts.js";

/*
 * Template definition format (stored as JSON, editable from the admin dashboard):
 *
 * {
 *   "width": 600,                 // canvas width in px
 *   "height": 400,                // optional; omitted = fit content
 *   "params": { "<name>": ParamSpec },
 *   "root": Node
 * }
 *
 * Node:   { "type": "box",   "style": {...}, "children": [Node] }
 *         { "type": "text",  "style": {...}, "text": Value }
 *         { "type": "image", "style": {...}, "src": Value }
 *         Every node accepts "if": "param" | "!param" | "param == value" | "param != value".
 * Value:  a string with {{param}} placeholders, a number, or
 *         { "$switch": "param", "cases": { "<value>": ... }, "default": ... }.
 */

export const MAX_NODES = 300;
export const PARAM_REF = /\{\{\s*([a-zA-Z_]\w*)\s*\}\}/g;
export const COLOR_RE =
  /^(#[0-9a-f]{3,4}|#[0-9a-f]{6}|#[0-9a-f]{8}|(rgb|rgba|hsl|hsla)\([\d.%\s,/+-]+\)|[a-z]{3,20})$/i;
const CONDITION_RE = /^\s*(!?)\s*([a-zA-Z_]\w*)\s*(?:(==|!=)\s*(.*?))?\s*$/;

const paramName = z.string().regex(/^[a-zA-Z_]\w{0,39}$/, "Invalid param name");
const scalar = z.union([z.string().max(2000), z.number()]);
const switchValue = z.object({
  $switch: paramName,
  cases: z.record(z.string(), scalar),
  default: scalar.optional(),
});
const value = z.union([scalar, switchValue]);
const style = z.record(z.string().regex(/^[a-zA-Z]+$/, "Style keys must be camelCase CSS properties"), value);
const condition = z.string().regex(CONDITION_RE, "Invalid condition");

const nodeBase = { if: condition.optional(), style: style.optional() };

export const nodeSchema = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ ...nodeBase, type: z.literal("box"), children: z.array(nodeSchema).max(100).default([]) }),
    z.object({ ...nodeBase, type: z.literal("text"), text: value }),
    z.object({ ...nodeBase, type: z.literal("image"), src: value }),
  ]),
);

const paramBase = {
  label: z.string().min(1).max(60).optional(),
  description: z.string().max(200).optional(),
};

export const paramSchema = z.discriminatedUnion("type", [
  z.object({
    ...paramBase,
    type: z.literal("string"),
    default: z.string().max(2000).default(""),
    maxLength: z.number().int().min(1).max(2000).default(500),
    multiline: z.boolean().default(false),
  }),
  z.object({
    ...paramBase,
    type: z.literal("number"),
    default: z.number(),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  z.object({ ...paramBase, type: z.literal("color"), default: z.string().regex(COLOR_RE, "Invalid color") }),
  z.object({ ...paramBase, type: z.literal("boolean"), default: z.boolean().default(false) }),
  z.object({
    ...paramBase,
    type: z.literal("enum"),
    options: z.array(z.string().min(1).max(40)).min(1).max(50),
    default: z.string(),
  }),
  z.object({ ...paramBase, type: z.literal("image"), default: z.string().max(2048).default("") }),
]);

export const definitionSchema = z
  .object({
    width: z.number().int().min(16).max(2400),
    height: z.number().int().min(16).max(2400).optional(),
    params: z.record(paramName, paramSchema).default({}),
    root: nodeSchema,
  })
  .superRefine((def, ctx) => {
    const issue = (message, path = []) => ctx.addIssue({ code: "custom", message, path });

    for (const [name, spec] of Object.entries(def.params)) {
      if (spec.type === "enum" && !spec.options.includes(spec.default)) {
        issue(`Default "${spec.default}" is not one of the options`, ["params", name, "default"]);
      }
      if (spec.type === "number" && ((spec.min ?? -Infinity) > spec.default || (spec.max ?? Infinity) < spec.default)) {
        issue("Default is outside min/max", ["params", name, "default"]);
      }
    }

    const checkRef = (name, path) => {
      if (!Object.hasOwn(def.params, name)) issue(`Unknown param "${name}"`, path);
    };
    const checkValue = (val, path) => {
      if (typeof val === "string") {
        for (const [, name] of val.matchAll(PARAM_REF)) checkRef(name, path);
      } else if (val && typeof val === "object") {
        checkRef(val.$switch, path);
      }
    };

    let count = 0;
    const walk = (node, path) => {
      count += 1;
      if (node.if) checkRef(CONDITION_RE.exec(node.if)[2], [...path, "if"]);
      for (const [key, val] of Object.entries(node.style || {})) {
        checkValue(val, [...path, "style", key]);
        if (key === "fontFamily" && typeof val === "string" && !val.includes("{{") && !isKnownFamily(val)) {
          issue(`Unknown font family. Available: ${FONT_FAMILIES.join(", ")}`, [...path, "style", key]);
        }
      }
      if (node.type === "text") checkValue(node.text, [...path, "text"]);
      if (node.type === "image") checkValue(node.src, [...path, "src"]);
      (node.children || []).forEach((child, i) => walk(child, [...path, "children", i]));
    };
    walk(def.root, ["root"]);
    if (count > MAX_NODES) issue(`Template has ${count} nodes; maximum is ${MAX_NODES}`, ["root"]);
  });

export const templateMetaSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Slug must be 2-40 chars of a-z, 0-9 and dashes"),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).default(""),
  category: z.string().trim().max(40).default("general"),
  isActive: z.boolean().default(true),
  isPremium: z.boolean().default(false),
});

export function parseCondition(cond) {
  const [, negate, name, op, operand] = CONDITION_RE.exec(cond);
  return { negate: negate === "!", name, op, operand };
}
