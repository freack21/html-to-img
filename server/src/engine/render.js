import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import jpeg from "jpeg-js";
import { HttpError, ValidationError } from "../lib/errors.js";
import { buildElement, walkElements } from "./build.js";
import { createEmojiLoader } from "./emoji.js";
import { fontsFor } from "./fonts.js";
import { createImageLoader } from "./images.js";
import { resolveParams } from "./params.js";

export const FORMATS = {
  png: "image/png",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
};
export const MAX_OUTPUT_PIXELS = 4800 * 4800;

/**
 * Adds the watermark badge in the bottom-right corner of the template. Normally the
 * wrapper fills the canvas so `height: 100%` roots keep working; for trimmed templates
 * it shrinks to the content so the badge sits on the content, not the empty canvas.
 */
function watermarked(element, text, { fixedHeight, trimmed }) {
  const badge = {
    type: "div",
    props: {
      style: {
        position: "absolute",
        right: 8,
        bottom: 6,
        fontSize: 14,
        fontWeight: 700,
        fontFamily: "Inter",
        color: "rgba(255,255,255,0.9)",
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: "2px 8px",
        borderRadius: 6,
      },
      children: text,
    },
  };
  const wrapper = {
    type: "div",
    props: {
      style: { display: "flex", position: "relative", ...(!trimmed && { width: "100%" }), ...(fixedHeight && { height: "100%" }) },
      children: [element, badge],
    },
  };
  if (!trimmed) return wrapper;
  return { type: "div", props: { style: { display: "flex", alignItems: "flex-start", width: "100%" }, children: [wrapper] } };
}

/** Content box grown by `margin` and clamped to the canvas, in whole pixels. */
function trimBox(bbox, margin, width, height) {
  const x = Math.max(0, Math.floor(bbox.x - margin));
  const y = Math.max(0, Math.floor(bbox.y - margin));
  return {
    x,
    y,
    width: Math.min(width, Math.ceil(bbox.x + bbox.width + margin)) - x,
    height: Math.min(height, Math.ceil(bbox.y + bbox.height + margin)) - y,
  };
}

export function createRenderer({ images = {}, emojiBaseUrl } = {}) {
  const loadImage = createImageLoader(images);
  const loadAdditionalAsset = createEmojiLoader({ baseUrl: emojiBaseUrl });

  /**
   * Renders a validated template definition.
   * @returns {{ buffer: Buffer, contentType: string, format: string, width: number, height: number }}
   */
  return async function render(definition, input, { format = "png", scale = 1, watermark = null } = {}) {
    if (!FORMATS[format]) throw new ValidationError(`Unsupported format "${format}"`);
    const params = resolveParams(definition.params, input);
    let element = buildElement(definition, params);
    // `trim: true` crops tight; a number keeps that many px of margin.
    const trimMargin = typeof definition.trim === "number" ? definition.trim : definition.trim === true ? 0 : null;
    const trimmed = trimMargin !== null;
    if (watermark) element = watermarked(element, watermark, { fixedHeight: Boolean(definition.height), trimmed });

    const families = new Set();
    const pending = [];
    walkElements(element, (el) => {
      if (el.props.style?.fontFamily) families.add(String(el.props.style.fontFamily));
      if (el.type === "img") pending.push(loadImage(el.props.src).then((uri) => (el.props.src = uri)));
    });
    await Promise.all(pending);

    let svg;
    try {
      svg = await satori(element, {
        width: definition.width,
        height: definition.height,
        fonts: fontsFor(families),
        loadAdditionalAsset,
      });
    } catch (err) {
      throw new ValidationError(`Template could not be rendered: ${err.message}`);
    }

    // SVG output only needs resvg to measure the content when trimming.
    const resvg =
      format !== "svg" || trimmed
        ? new Resvg(svg, {
            fitTo: { mode: "zoom", value: scale },
            background: format === "jpeg" ? "#ffffff" : undefined,
            font: { loadSystemFonts: false },
          })
        : null;
    let crop = null;
    if (trimmed) {
      // cropByBBox only accepts resvg's own BBox objects, so reuse the measured one.
      const bbox = resvg.innerBBox();
      if (bbox && bbox.width > 0 && bbox.height > 0) crop = Object.assign(bbox, trimBox(bbox, trimMargin, resvg.width, resvg.height));
    }

    if (format === "svg") {
      if (crop) {
        svg = svg.replace(
          /^<svg width="[\d.]+" height="[\d.]+" viewBox="[^"]*"/,
          `<svg width="${crop.width}" height="${crop.height}" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"`,
        );
      }
      const [, width, height] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg) || [];
      return { buffer: Buffer.from(svg), contentType: FORMATS.svg, format, width: Number(width), height: Number(height) };
    }

    if (crop) resvg.cropByBBox(crop);
    if (resvg.width * resvg.height * scale * scale > MAX_OUTPUT_PIXELS) {
      throw new HttpError(413, "Output image is too large", { code: "image_too_large" });
    }
    const image = resvg.render();
    const buffer =
      format === "jpeg"
        ? jpeg.encode({ data: image.pixels, width: image.width, height: image.height }, 92).data
        : image.asPng();
    return { buffer, contentType: FORMATS[format], format, width: image.width, height: image.height };
  };
}
