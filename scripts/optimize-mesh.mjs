import fs from "node:fs/promises";
import path from "node:path";
import meshoptimizer from "meshoptimizer";
const { MeshoptSimplifier } = meshoptimizer;
await MeshoptSimplifier.ready;
const [input, output, triangles = "50000"] = process.argv.slice(2);
if (
  !input ||
  !output ||
  !Number.isInteger(Number(triangles)) ||
  Number(triangles) < 1
)
  throw new Error(
    "Usage: node scripts/optimize-mesh.mjs INPUT.mesh OUTPUT.mesh [TRIANGLES]",
  );
{
  const file = path.basename(input);
  const buffer = await fs.readFile(input);
  const d = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const nv = d.getUint32(4, true),
    ni = d.getUint32(8, true),
    width = d.getUint32(12, true),
    positions = new Float32Array(nv * 3),
    indices = new Uint32Array(ni);
  for (let i = 0; i < positions.length; i++) {
    const a = i % 3,
      lo = d.getFloat32(16 + a * 4, true),
      hi = d.getFloat32(28 + a * 4, true);
    positions[i] = lo + (d.getUint16(40 + i * 2, true) / 65535) * (hi - lo);
  }
  for (let i = 0; i < ni; i++)
    indices[i] =
      width === 2
        ? d.getUint16(40 + nv * 6 + i * 2, true)
        : d.getUint32(40 + nv * 6 + i * 4, true);
  const [simplified, error] = MeshoptSimplifier.simplify(
    indices,
    positions,
    3,
    Math.min(Number(triangles) * 3, ni),
    0.003,
  );
  const remap = new Int32Array(nv).fill(-1),
    unique = [];
  let next = 0;
  for (let i = 0; i < simplified.length; i++) {
    let old = simplified[i];
    if (remap[old] < 0) {
      remap[old] = next++;
      unique.push(old);
    }
    simplified[i] = remap[old];
  }
  const indexWidth = next > 65535 ? 4 : 2,
    result = Buffer.alloc(40 + next * 6 + simplified.length * indexWidth);
  buffer.copy(result, 0, 0, 40);
  result.writeUInt32LE(next, 4);
  result.writeUInt32LE(simplified.length, 8);
  result.writeUInt32LE(indexWidth, 12);
  for (let i = 0; i < unique.length; i++)
    buffer.copy(result, 40 + i * 6, 40 + unique[i] * 6, 46 + unique[i] * 6);
  for (let i = 0; i < simplified.length; i++) {
    if (indexWidth === 2)
      result.writeUInt16LE(simplified[i], 40 + next * 6 + i * 2);
    else result.writeUInt32LE(simplified[i], 40 + next * 6 + i * 4);
  }
  await fs.writeFile(output, result);
  console.log(
    file,
    ni / 3,
    "->",
    simplified.length / 3,
    "error",
    error.toFixed(5),
    "bytes",
    result.length,
  );
}
