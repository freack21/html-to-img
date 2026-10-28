// Twemoji file names are lowercase hex code points joined by "-",
// dropping U+FE0F unless the sequence contains a zero-width joiner.
export function emojiCode(segment) {
  const points = [...segment].map((char) => char.codePointAt(0));
  const keep = points.includes(0x200d) ? points : points.filter((p) => p !== 0xfe0f);
  return keep.map((p) => p.toString(16)).join("-");
}

/** Satori `loadAdditionalAsset` handler that renders emoji as Twemoji SVGs. */
export function createEmojiLoader({ baseUrl, timeoutMs = 3000, maxEntries = 2000 } = {}) {
  const cache = new Map();

  const loadEmoji = async (segment) => {
    const code = emojiCode(segment);
    if (cache.has(code)) return cache.get(code);
    let dataUri;
    try {
      const res = await fetch(`${baseUrl}${code}.svg`, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        dataUri = `data:image/svg+xml;base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
      }
    } catch {
      // Network failure: render without the emoji rather than failing the image.
      return undefined;
    }
    if (cache.size >= maxEntries) cache.delete(cache.keys().next().value);
    cache.set(code, dataUri);
    return dataUri;
  };

  return async (code, segment) => {
    if (code !== "emoji" || !baseUrl) return undefined;
    return loadEmoji(segment);
  };
}
