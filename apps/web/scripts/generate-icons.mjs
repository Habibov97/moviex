/**
 * Generates the browser icon files in `app/` from the MovieX logo mark.
 *
 *   node scripts/generate-icons.mjs
 *
 * Run this when the artwork changes. The geometry below is a deliberate copy of
 * `LOGO_GEOMETRY` in `components/shared/LogoMark.tsx` — **the two must be kept
 * in step by hand**, because that component paints with `var(--mx-*)` custom
 * properties and a favicon is rendered outside the document, where nothing
 * resolves them. Literal hex is not a shortcut here, it is the only thing that
 * works; the values are the same colours those tokens hold.
 *
 * Outputs (all Next.js App Router file conventions, so no <link> tags needed):
 *   app/icon.svg        — the modern path; vector, so it is sharp at any size
 *   app/favicon.ico     — 16/32/48, for browsers and contexts that still ask
 *   app/apple-icon.png  — 180×180 iOS home-screen tile
 *
 * `sharp` is not a dependency of this app — it comes in with Next. That is fine
 * for a script run by hand, and is why this is not wired into `npm run build`.
 */
import { Buffer } from "node:buffer";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const APP_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app");

/** Mirrors `LOGO_GEOMETRY`. */
const VIEW_BOX = 64;
const RADIUS = 16;
const LEFT = "14,14 32,32 14,50";
const RIGHT = "50,14 50,50 32,32";

/** Mirrors the `:root` brand tokens in `app/globals.css`. */
const SURFACE = "#17171b";
const ACCENT = "#e24b4a";
const ACCENT_DEEP = "#a13230";

/**
 * @param {{ rounded?: boolean }} options
 *   `rounded: false` drops the corner radius for the Apple tile — iOS applies
 *   its own mask, and a pre-rounded icon inside that shows a dark halo where
 *   the two radii disagree.
 */
function svg({ rounded = true } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${VIEW_BOX}" height="${VIEW_BOX}" viewBox="0 0 ${VIEW_BOX} ${VIEW_BOX}">
  <rect width="${VIEW_BOX}" height="${VIEW_BOX}"${rounded ? ` rx="${RADIUS}"` : ""} fill="${SURFACE}"/>
  <polygon points="${LEFT}" fill="${ACCENT}"/>
  <polygon points="${RIGHT}" fill="${ACCENT_DEEP}"/>
</svg>
`;
}

const png = (source, size) =>
  sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

/**
 * Packs PNGs into an ICO container.
 *
 * Hand-rolled rather than pulling in a dependency: the format is a 6-byte
 * header plus a 16-byte directory entry per image, and since Vista an entry's
 * payload may be a PNG verbatim — so there is no BMP encoding to get wrong.
 * A 256px image is stored as `0` in the width/height byte, which is why those
 * fields are masked.
 */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size & 0xff, 0); // width  (0 means 256)
    entry.writeUInt8(size & 0xff, 1); // height
    entry.writeUInt8(0, 2); // palette size
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}

const source = svg();

// Vector first — this is what modern browsers actually use.
await writeFile(path.join(APP_DIR, "icon.svg"), source);

const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map(async (size) => ({ size, data: await png(source, size) })),
);
await writeFile(path.join(APP_DIR, "favicon.ico"), ico(images));

await writeFile(
  path.join(APP_DIR, "apple-icon.png"),
  await png(svg({ rounded: false }), 180),
);

console.log(
  `Wrote icon.svg, favicon.ico (${sizes.join("/")}) and apple-icon.png (180) to app/`,
);
