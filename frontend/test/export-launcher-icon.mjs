import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const assets = path.join(root, "launcher/assets");
const svg = await readFile(path.join(assets, "homebox-h.svg"), "utf8");
const sizes = [16, 20, 24, 32, 40, 48, 64, 96, 128, 256];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pngs = [];
await mkdir(assets, { recursive: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [...sizes, 512, 1024]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    const bytes = await page.screenshot({ omitBackground: true });
    await writeFile(path.join(assets, `homebox-h-${size}.png`), bytes);
    if (sizes.includes(size)) pngs.push({ size, bytes });
  }

  // Check the clean master, including transparent corners and exact flat fills.
  const pixels = await page.evaluate(async (source) => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const pixel = (x, y) => [...ctx.getImageData(x, y, 1, 1).data];
    const data = ctx.getImageData(0, 0, 1024, 1024).data;
    let strayPixels = 0;
    for (let y = 0; y < 1024; y++)
      for (let x = 0; x < 1024; x++) {
        if (
          (x < 63 || x > 960 || y < 63 || y > 960) &&
          data[(y * 1024 + x) * 4 + 3]
        )
          strayPixels++;
      }
    return {
      corner: pixel(0, 0),
      white: pixel(512, 128),
      orange: pixel(512, 512),
      strayPixels,
    };
  }, svg);
  assert.deepEqual(pixels.corner, [0, 0, 0, 0]);
  assert.deepEqual(pixels.white, [255, 255, 255, 255]);
  assert.deepEqual(pixels.orange, [217, 119, 87, 255]);
  assert.equal(pixels.strayPixels, 0);
} finally {
  await browser.close();
}

// Modern Windows ICO entries can contain complete lossless PNG images.
const directory = Buffer.alloc(6 + pngs.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(pngs.length, 4);
let offset = directory.length;
pngs.forEach(({ size, bytes }, index) => {
  const base = 6 + index * 16;
  directory[base] = directory[base + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, base + 4);
  directory.writeUInt16LE(32, base + 6);
  directory.writeUInt32LE(bytes.length, base + 8);
  directory.writeUInt32LE(offset, base + 12);
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
  offset += bytes.length;
});
const result = Buffer.concat([directory, ...pngs.map(({ bytes }) => bytes)]);
assert.equal(result.length, offset);
await writeFile(path.join(root, "Homebox.ico"), result);
console.log(
  JSON.stringify({
    output: path.join(root, "Homebox.ico"),
    sizes,
    alphaAndColorChecks: "passed",
    bytes: result.length,
  }),
);
