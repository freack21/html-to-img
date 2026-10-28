import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Bundled font families. Satori needs static TTF/OTF/WOFF files (no WOFF2),
// so the @fontsource packages are used for their per-weight WOFF files.
const FAMILIES = {
  Inter: { pkg: "inter", weights: [400, 500, 600, 700, 800] },
  Poppins: { pkg: "poppins", weights: [400, 500, 600, 700, 800] },
  Figtree: { pkg: "figtree", weights: [400, 500, 600, 700, 800, 900] },
  "Playfair Display": { pkg: "playfair-display", weights: [400, 700], italic: true },
  Anton: { pkg: "anton", weights: [400] },
  "JetBrains Mono": { pkg: "jetbrains-mono", weights: [400, 700] },
};

const SUBSETS = ["latin", "latin-ext"];

export const FONT_FAMILIES = Object.keys(FAMILIES);
export const DEFAULT_FONT = "Inter";

const cache = new Map();

function loadFamily(name) {
  if (cache.has(name)) return cache.get(name);
  const { pkg, weights, italic } = FAMILIES[name];
  const dir = path.join(path.dirname(require.resolve(`@fontsource/${pkg}/package.json`)), "files");
  const styles = italic ? ["normal", "italic"] : ["normal"];
  const fonts = [];
  for (const weight of weights) {
    for (const style of styles) {
      for (const subset of SUBSETS) {
        const file = path.join(dir, `${pkg}-${subset}-${weight}-${style}.woff`);
        if (fs.existsSync(file)) {
          fonts.push({ name, data: fs.readFileSync(file), weight, style });
        }
      }
    }
  }
  cache.set(name, fonts);
  return fonts;
}

/** Returns the first family of a CSS `font-family` value, without quotes. */
export function primaryFamily(fontFamily) {
  return String(fontFamily).split(",")[0].trim().replace(/^["']|["']$/g, "");
}

export function isKnownFamily(fontFamily) {
  return Object.hasOwn(FAMILIES, primaryFamily(fontFamily));
}

/** Satori font list for the given family names; the default font is always included. */
export function fontsFor(families) {
  const names = new Set([DEFAULT_FONT]);
  for (const family of families) {
    const name = primaryFamily(family);
    if (Object.hasOwn(FAMILIES, name)) names.add(name);
  }
  return [...names].flatMap(loadFamily);
}
