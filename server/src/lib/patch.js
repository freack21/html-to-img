/**
 * zod 4 still applies `.default()` inside `.partial()` schemas, so a PATCH would
 * reset every omitted field. Keep only the keys the caller actually sent.
 */
export function onlyProvided(data, input) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => Object.hasOwn(input ?? {}, key)));
}
