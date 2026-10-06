import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
for (const file of ['three.module.min.js', 'three.core.min.js']) {
  await copyFile(`node_modules/three/build/${file}`, `dist/assets/${file}`);
}
console.log('Static Pages build ready: dist');
