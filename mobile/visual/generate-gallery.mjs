import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const screenshotsRoot = path.resolve("visual/screenshots");
const devices = (await readdir(screenshotsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const sections = await Promise.all(devices.map(async (device) => {
  const files = (await readdir(path.join(screenshotsRoot, device)))
    .filter((file) => file.endsWith(".png"))
    .sort();
  const figures = files.map((file) => `
    <figure>
      <img src="${device}/${file}" alt="${device} ${file.replace(".png", "")}">
      <figcaption>${file.replace(".png", "").replaceAll("-", " ")}</figcaption>
    </figure>`).join("");
  return `<section><h2>${device.replaceAll("-", " ")}</h2><div class="grid">${figures}</div></section>`;
}));

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>LBWW Mafia mobile screenshots</title>
<style>body{margin:0;padding:32px;background:#060912;color:#e9eeff;font:14px system-ui}h1,h2{text-transform:capitalize}.grid{display:flex;align-items:flex-start;gap:24px;overflow-x:auto;padding-bottom:24px}figure{margin:0;flex:none}img{display:block;max-height:720px;max-width:min(768px,80vw);border:1px solid #283456;border-radius:12px}figcaption{padding-top:8px;color:#a8b4d9;text-transform:capitalize}</style>
</head><body><h1>Mobile screenshot gallery</h1>${sections.join("")}</body></html>`;

await writeFile(path.join(screenshotsRoot, "index.html"), html);
console.log(`Screenshot gallery: ${path.join(screenshotsRoot, "index.html")}`);
