# Erfan Mohiti — Maxillofacial Design Portfolio

A responsive English portfolio with four original project collections: mandibular angle, orbital floor and cheek, subperiosteal framework, and cranial reconstruction.

## Development

```sh
npm ci
npm run build
npm run dev
```

The static site is served on port 4173. Node.js 22 (CI) or 24 and Python 3 are required. `dist/` contains the editable website and deployable assets. The build copies the pinned Three.js distribution into `dist/assets/`.

## Project explorer

- Explore distinct editorial sections for facial aesthetics, frameworks and reconstruction.
- Animate an abstract parametric surface, pause motion, or follow the four interactive design stages.
- Reduced-motion preferences disable decorative animations.
- Rotate lightweight implants directly in the page; open a project to load full anatomical context.
- Drag to rotate; scroll to zoom. The focused canvas also supports arrow keys and `+` / `-`.
- Switch between surface, wireframe and implant-only views; reset the camera.
- Close with Escape or the close button. Mobile navigation and the dialog support keyboard access.

`dist/assets/projects/manifest.json` defines each project's geometry and whether a component is implant or anatomy. STL files are reduced to 25,000 triangles per component for portfolio viewing; neutral filenames and STL headers replace identifying source labels. Original archives are not included in the website. Homepage images are isolated implant WebP renders of these actual meshes; full anatomy remains in the on-demand explorer. The hero is an abstract parametric surface, not a patient model. Lightweight implant-only previews (3,500 triangles per component) load near the viewport and release their WebGL resources offscreen. Full anatomy and 25,000-triangle components load only in the project dialog. Inline previews render on interaction rather than running a continuous render loop; wheel and vertical touch gestures remain available for page scrolling.

These simplified meshes are presentation assets, not manufacturing files. Project descriptions do not imply validated clinical outcomes. Review publication permissions for the underlying patient-specific anatomy before public deployment.

## Validation

The current implementation was checked using Python Playwright with system Chromium: four project loads, view controls, keyboard camera input, interactive process stages, motion preferences, Escape/focus restoration, mobile navigation, small-screen overflow and a failed-geometry response. There is no repository test runner dependency.

## Deployment

Existing GitHub Pages and Cloudflare Pages workflows remain available. Build with `npm ci && npm run build`; output directory: `dist`. Public deployment is separate from local development.
