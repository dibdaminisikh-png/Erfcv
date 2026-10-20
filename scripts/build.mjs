import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
// One fingerprint for the whole release prevents cached modules from different
// deployments from sharing incompatible viewer APIs or geometry manifests.
const sourceFiles = [
  "app.js", "experience.js", "viewer.js", "surgical-journey.js", "visual-work.js",
  "style.css", "dark.css", "portfolio.css", "experience.css", "index.html",
];
const unversion = (text) => text.replace(/\?v=[a-f0-9]{12}/g, "");
const sources = await Promise.all(sourceFiles.map(async (file) => [
  file, unversion(await readFile("dist/" + file, "utf8")),
]));
const fingerprint = createHash("sha256");
fingerprint.update(await readFile("package.json"));
fingerprint.update(JSON.stringify(manifest));
for (const [file, source] of sources) fingerprint.update(file + "\0" + source);
for (const parts of Object.values(manifest))
  for (const part of parts) fingerprint.update(await readFile("dist/" + part.file));
const version = fingerprint.digest("hex").slice(0, 12);
for (const [file, source] of sources) {
  const versioned = file.endsWith(".js")
    ? source.replace(/(["'])(\.\/[^"']+\.js)\1/g, "$1$2?v=" + version + "$1")
    : file === "index.html"
      ? source.replace(/((?:src|href)=")([^"?]+\.(?:css|js|webp))"/g, "$1$2?v=" + version + '"')
      : source;
  await writeFile("dist/" + file, versioned);
}
const three = await readFile("dist/assets/three.module.min.js", "utf8");
await writeFile("dist/assets/three.module.min.js", three.replace(
  /(["'])(\.\/three\.core\.min\.js)\1/g, "$1$2?v=" + version + "$1",
));
console.log("Release asset fingerprint: " + version);
console.log(
  "Static Pages build ready: " +
    Object.keys(manifest).length +
    " full anatomical studies, " +
    (bytes / 1e6).toFixed(2) +
    " MB of geometry (loaded near viewport).",
);
