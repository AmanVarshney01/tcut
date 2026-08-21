// A minimal PNG codec for the renderer. Bun.WebView screenshots come in as opaque PNGs and Bun.Image has no raw
// pixel access, so transparent output needs its own decode → matte → encode step. 8-bit RGB/RGBA, non-interlaced.
// PNG streams are zlib-framed; Bun's inflateSync reads that with windowBits 15, and deflateSync's raw output gets the
// two-byte header and Adler-32 trailer added here (Bun only — no node:zlib).

/** Straight (non-premultiplied) RGBA pixels, row-major. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export type Rgb = [number, number, number];

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const readU32 = (b: Uint8Array, o: number): number => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Raw DEFLATE from Bun.deflateSync wrapped as a zlib stream (RFC 1950): CMF/FLG header + data + Adler-32. */
function zlibDeflate(raw: Uint8Array<ArrayBuffer>, level: 1 | 6 = 1): Uint8Array {
  const body = Bun.deflateSync(raw, { level });
  const out = new Uint8Array(2 + body.length + 4);
  out[0] = 0x78;
  out[1] = level === 1 ? 0x01 : 0x9c;
  out.set(body, 2);
  new DataView(out.buffer).setUint32(2 + body.length, adler32(raw));
  return out;
}

const zlibInflate = (data: Uint8Array<ArrayBuffer>): Uint8Array => Bun.inflateSync(data, { windowBits: 15 });

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(parts.reduce((n, p) => n + p.length, 0)));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const paeth = (a: number, b: number, c: number): number => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Undo a PNG row filter in place; `prev` is the previous (already unfiltered) row. */
function unfilter(filter: number, row: Uint8Array, prev: Uint8Array, bpp: number): void {
  switch (filter) {
    case 0:
      return;
    case 1:
      for (let i = bpp; i < row.length; i++) row[i] = (row[i]! + row[i - bpp]!) & 0xff;
      return;
    case 2:
      for (let i = 0; i < row.length; i++) row[i] = (row[i]! + prev[i]!) & 0xff;
      return;
    case 3:
      for (let i = 0; i < row.length; i++) row[i] = (row[i]! + (((i >= bpp ? row[i - bpp]! : 0) + prev[i]!) >> 1)) & 0xff;
      return;
    case 4:
      for (let i = 0; i < row.length; i++) row[i] = (row[i]! + paeth(i >= bpp ? row[i - bpp]! : 0, prev[i]!, i >= bpp ? prev[i - bpp]! : 0)) & 0xff;
      return;
    default:
      throw new Error(`Unsupported PNG filter ${filter}`);
  }
}

export function decodePng(png: Uint8Array): RgbaImage {
  for (let i = 0; i < SIGNATURE.length; i++) if (png[i] !== SIGNATURE[i]) throw new Error("Not a PNG file");
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  for (let pos = 8; pos + 8 <= png.length; ) {
    const length = readU32(png, pos);
    const type = String.fromCharCode(png[pos + 4]!, png[pos + 5]!, png[pos + 6]!, png[pos + 7]!);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = readU32(data, 0);
      height = readU32(data, 4);
      depth = data[8]!;
      colorType = data[9]!;
      interlace = data[12]!;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + length;
  }
  if (depth !== 8 || (colorType !== 6 && colorType !== 2) || interlace !== 0) {
    throw new Error(`Unsupported PNG layout (bit depth ${depth}, colour type ${colorType}, interlace ${interlace})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlibInflate(concat(idat));
  const out = new Uint8Array(width * height * 4);
  let prev = new Uint8Array(stride);
  let row = new Uint8Array(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++]!;
    row.set(raw.subarray(p, p + stride));
    p += stride;
    unfilter(filter, row, prev, bpp);
    const o = y * width * 4;
    if (bpp === 4) out.set(row, o);
    else {
      for (let x = 0; x < width; x++) {
        out[o + x * 4] = row[x * 3]!;
        out[o + x * 4 + 1] = row[x * 3 + 1]!;
        out[o + x * 4 + 2] = row[x * 3 + 2]!;
        out[o + x * 4 + 3] = 255;
      }
    }
    [prev, row] = [row, prev];
  }
  return { width, height, data: out };
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Encode straight RGBA as an 8-bit PNG (filter 0; speed matters more than size — ffmpeg re-encodes anyway). */
export function encodePng(img: RgbaImage): Uint8Array {
  const stride = img.width * 4;
  const raw = new Uint8Array(new ArrayBuffer((stride + 1) * img.height));
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(img.data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, img.width);
  v.setUint32(4, img.height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return concat([new Uint8Array(SIGNATURE), chunk("IHDR", ihdr), chunk("IDAT", zlibDeflate(raw)), chunk("IEND", new Uint8Array(0))]);
}

export function parseHex(color: string): Rgb {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) throw new Error(`Expected a #RRGGBB colour, got "${color}"`);
  return [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)];
}

/** Relative luminance (0–1) of an #RRGGBB colour — picks a contrasting second matte background. */
export function luminance(color: string): number {
  const [r, g, b] = parseHex(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Two-background matting: the same frame rendered over backgrounds `a` and `b` gives, per pixel,
 * alpha = 1 − (Pb − Pa) / (b − a) and colour = (Pa − (1 − alpha)·a) / alpha. Exact for anti-aliased edges and
 * soft shadows alike, which is why the renderer prefers this over a colour key.
 */
export function matte(onA: RgbaImage, onB: RgbaImage, a: Rgb, b: Rgb): RgbaImage {
  if (onA.width !== onB.width || onA.height !== onB.height) throw new Error("matte: frame sizes differ");
  const n = onA.width * onA.height;
  const out = new Uint8Array(n * 4);
  const usable = [0, 1, 2].filter((c) => a[c] !== b[c]);
  if (usable.length === 0) throw new Error("matte: the two backgrounds must differ");
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let alpha = 0;
    for (const c of usable) alpha += 1 - (onB.data[o + c]! - onA.data[o + c]!) / (b[c]! - a[c]!);
    alpha = Math.min(1, Math.max(0, alpha / usable.length));
    if (alpha <= 0.002) {
      out[o + 3] = 0;
      continue;
    }
    for (let c = 0; c < 3; c++) {
      const v = (onA.data[o + c]! - (1 - alpha) * a[c]!) / alpha;
      out[o + c] = Math.min(255, Math.max(0, Math.round(v)));
    }
    out[o + 3] = Math.round(alpha * 255);
  }
  return { width: onA.width, height: onA.height, data: out };
}
