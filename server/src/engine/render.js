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

function watermarked(element, text) {
  return {
    type: "div",
    props: {
      style: { display: "flex", position: "relative" },
      children: [
        element,
        {
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
        },
      ],
    },
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
    if (watermark) element = watermarked(element, watermark);

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

    if (format === "svg") {
      const [, width, height] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg) || [];
      return { buffer: Buffer.from(svg), contentType: FORMATS.svg, format, width: Number(width), height: Number(height) };
    }

    const resvg = new Resvg(svg, {
      fitTo: { mode: "zoom", value: scale },
      background: format === "jpeg" ? "#ffffff" : undefined,
      font: { loadSystemFonts: false },
    });
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
