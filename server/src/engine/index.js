import { ValidationError, zodDetails } from "../lib/errors.js";
import { definitionSchema, templateMetaSchema } from "./schema.js";

export { createRenderer, FORMATS } from "./render.js";
export { FONT_FAMILIES } from "./fonts.js";

/** Validates a template definition and fills in defaults; throws ValidationError. */
export function parseDefinition(input) {
  const result = definitionSchema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid template definition", zodDetails(result.error));
  return result.data;
}

export function parseTemplateMeta(input, { partial = false } = {}) {
  const schema = partial ? templateMetaSchema.partial() : templateMetaSchema;
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid template", zodDetails(result.error));
  return result.data;
}
