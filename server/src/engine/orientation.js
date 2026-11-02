import jpeg from "jpeg-js";

/**
 * Reads the EXIF Orientation tag (1-8) of a JPEG. Returns 1 when absent or unreadable.
 * Phones store photos in sensor order and rely on this tag to display them upright.
 */
export function jpegOrientation(buffer) {
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    // Start of scan / end of image: no more metadata segments.
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset + 2);
    const start = offset + 4;
    if (marker === 0xe1 && buffer.toString("ascii", start, start + 6) === "Exif\0\0") {
      return readTiffOrientation(buffer, start + 6, Math.min(buffer.length, offset + 2 + length));
    }
    offset += 2 + length;
  }
  return 1;
}

function readTiffOrientation(buffer, tiff, end) {
  if (tiff + 8 > end) return 1;
  const order = buffer.toString("ascii", tiff, tiff + 2);
  if (order !== "II" && order !== "MM") return 1;
  const little = order === "II";
  const u16 = (at) => (little ? buffer.readUInt16LE(at) : buffer.readUInt16BE(at));
  const u32 = (at) => (little ? buffer.readUInt32LE(at) : buffer.readUInt32BE(at));
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return 1;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > end) break;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

// Source pixel for output (x, y), as sx = X[0] + X[1]*x + X[2]*y (same for sy with Y),
// where "w"/"h" in the constant term stand for width-1/height-1 of the source.
const MAPS = {
  2: { X: ["w", -1, 0], Y: [0, 0, 1] },
  3: { X: ["w", -1, 0], Y: ["h", 0, -1] },
  4: { X: [0, 1, 0], Y: ["h", 0, -1] },
  5: { X: [0, 0, 1], Y: [0, 1, 0] },
  6: { X: [0, 0, 1], Y: ["h", -1, 0] },
  7: { X: ["w", 0, -1], Y: ["h", -1, 0] },
  8: { X: ["w", 0, -1], Y: [0, 1, 0] },
};

const MAX_SIDE = 2048;

/**
 * Returns the JPEG with its pixels rotated/flipped upright and the EXIF tag dropped,
 * because the renderer ignores EXIF orientation. While at it, photos larger than
 * MAX_SIDE are box-downscaled by an integer factor (templates never need more, and it
 * keeps re-encoding cheap). Upright JPEGs are returned unchanged.
 */
export function normalizeJpegOrientation(buffer) {
  const orientation = jpegOrientation(buffer);
  if (orientation === 1) return buffer;
  const src = jpeg.decode(buffer, { useTArray: true, maxResolutionInMP: 50, maxMemoryUsageInMB: 256 });
  const { width: w, height: h, data } = src;
  const k = Math.ceil(Math.max(w, h) / MAX_SIDE);
  const swap = orientation >= 5;
  const outW = Math.floor((swap ? h : w) / k);
  const outH = Math.floor((swap ? w : h) / k);
  const { X, Y } = MAPS[orientation];
  const base = (term) => (term === "w" ? w - 1 : term === "h" ? h - 1 : term);
  const [x0, xx, xy] = [base(X[0]), X[1], X[2]];
  const [y0, yx, yy] = [base(Y[0]), Y[1], Y[2]];
  const out = Buffer.alloc(outW * outH * 4);
  const area = k * k;
  let to = 0;
  for (let oy = 0; oy < outH; oy++) {
    for (let ox = 0; ox < outW; ox++, to += 4) {
      let r = 0;
      let g = 0;
      let b = 0;
      // Average the k*k block of upright pixels that maps to this output pixel.
      for (let dy = 0; dy < k; dy++) {
        const y = oy * k + dy;
        for (let dx = 0; dx < k; dx++) {
          const x = ox * k + dx;
          const from = ((y0 + yx * x + yy * y) * w + (x0 + xx * x + xy * y)) * 4;
          r += data[from];
          g += data[from + 1];
          b += data[from + 2];
        }
      }
      out[to] = r / area;
      out[to + 1] = g / area;
      out[to + 2] = b / area;
      out[to + 3] = 255;
    }
  }
  return jpeg.encode({ data: out, width: outW, height: outH }, 90).data;
}
