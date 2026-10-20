import { copyFile, mkdir, readFile } from "node:fs/promises";
await mkdir("dist/assets", { recursive: true });
for (const file of ["three.module.min.js", "three.core.min.js"]) {
  await copyFile("node_modules/three/build/" + file, "dist/assets/" + file);
}
await copyFile("node_modules/lenis/dist/lenis.mjs", "dist/assets/lenis.js");
const manifest = JSON.parse(
  await readFile("dist/assets/projects/manifest.json", "utf8"),
);
const html = await readFile("dist/index.html", "utf8");
let bytes = 0;
for (const [key, parts] of Object.entries(manifest)) {
  if (!html.includes('data-case="' + key + '"'))
    throw new Error("Missing case markup: " + key);
  if (
    !parts.some((p) => p.kind === "implant") ||
    !parts.some((p) => p.kind === "anatomy")
  )
    throw new Error("Incomplete assembly: " + key);
  for (const part of parts) {
    const mesh = await readFile("dist/" + part.file);
    if (mesh.toString("ascii", 0, 4) !== "EMC1")
      throw new Error("Invalid mesh: " + part.file);
    bytes += mesh.byteLength;
  }
  await readFile("dist/assets/projects/" + key + "-full.webp");
}
await readFile("dist/assets/projects/cranial-exploded.webp");
await readFile("dist/assets/mandible-study.webp");
await readFile("dist/assets/lenis.js");
console.log(
  "Static Pages build ready: " +
    Object.keys(manifest).length +
    " full anatomical studies, " +
    (bytes / 1e6).toFixed(2) +
    " MB of geometry (loaded near viewport).",
);
