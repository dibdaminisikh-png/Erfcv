# Erfan Mohiti — Maxillofacial Design Portfolio

A dark evergreen portfolio with seven original anatomical case studies. Each study shows the implant and complete supplied anatomy directly on the homepage, with a consistent description and interactive control panel.

## Development

```sh
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Node.js 22 or newer is sufficient for development and deployment. The editable website and deployable assets live in `dist/`. The build copies the pinned Three.js distribution and checks every assembly, mesh and model poster.

## Collection

| Study | Design                         |
| ----- | ------------------------------ |
| 01    | Mandibular angle               |
| 02    | Orbital floor & cheek          |
| 03    | Subperiosteal framework        |
| 04    | Cranial reconstruction         |
| 05    | Temporomandibular joint        |
| 06    | Mandibular reconstruction      |
| 07    | Fibula-assisted reconstruction |

The four existing collections retain their supplied presentation geometry; three additional collections come from the local Nemoone archives. Anatomical coverage follows the source files. Names and identifying source headers are excluded from published assets.

## Model interaction

- Drag to orbit. Shift-drag, right-drag, or select Move to pan.
- Zoom with the + / − buttons, or scroll when the canvas has keyboard focus. Page scrolling remains available outside the focused canvas.
- Use the implant separation slider to move each implant outwards. At 0%, every implant returns exactly to its original fitted coordinates while anatomy and graft segments stay fixed.
- Select front, side or top perspectives; switch between solid anatomy, transparent X-ray and mesh views.
- Reset restores the camera, interaction mode, display and separation together.
- Expand a case into fullscreen. Escape closes fullscreen; a local expanded-view fallback supports browsers without that API.
- On touch devices, horizontal dragging works alongside page scrolling. Enable touch controls for unrestricted rotation, movement and two-finger pinch zoom; exit to restore normal vertical scrolling.
- Focus a canvas and use arrow keys to rotate, + / − to zoom, and Home to reset the camera.

## Loading and motion

There is no blocking introductory loading screen. Static full-assembly WebP posters provide an anatomical preview while nearby models load. Three.js and binary meshes load only near the collection viewport. Offscreen GPU resources are released, downloaded geometry stays cached in memory, and camera/control settings survive returning to a study.

The inline loading treatment uses an anatomical scan and real component progress. Scan animation lasts at most six seconds. On a slow connection, the page stays usable and the model finishes in the background with a retry option. Download failures and missing WebGL support retain the full-assembly poster. Decorative motion respects prefers-reduced-motion, with no Pause motion button.

See [browser verification](docs/verification.md) for measured local and simulated 4G timings.

## Geometry format and preparation

`dist/assets/projects/manifest.json` maps neutral files to implant, anatomy or graft components. EMC1 geometry uses indexed triangles and 16-bit positions within the original bounding box, replacing repeated STL vertices. All seven assemblies together contain 10.78 MB of geometry; it is not downloaded as one initial payload. The three new collections use shape-preserving edge-collapse simplification, with up to 50,000 triangles per component and a maximum relative error threshold of 0.003.

Optional asset preparation requires Python with NumPy. Normal builds do not require Python.

```sh
python scripts/prepare-meshes.py input.stl raw.mesh
node scripts/optimize-mesh.mjs raw.mesh output.mesh 50000
```

The optimizer uses the pinned [meshoptimizer](https://github.com/zeux/meshoptimizer) development dependency. Original local archives remain outside the deployed website. Existing STL files are retained but no longer requested by the page.

## Deployment

Existing GitHub Pages and Cloudflare Pages workflows remain available. Build with `npm ci && npm run build`; output directory: `dist`.

## Connected visual details

The design-equation strip connects anatomy, digital craft and surgical insight with drawn technical icons and a restrained light trace. Project navigation uses larger labels and a travelling active surface. Case studies, editorial sections and technical illustrations have distinct, coordinated entrance treatments. Fine-pointer desktops use the locally bundled, pinned Lenis module for restrained wheel smoothing. Touch scrolling stays native, focused 3D canvases retain wheel zoom, and reduced-motion preferences disable smoothing and decorative light.

The pointer light is a low-opacity halftone field, never a replacement cursor. It does not intercept clicks and stops updating when the pointer settles.

## Surgical planning illustration

The four-stage process uses the supplied mandibular geometry: Analyze → Guide → Resect → Reconstruct. A moving scan band highlights the illustrative lesion region on each pass; fitted guide representations precede segment removal and a reconstruction prosthesis. Select individual stages, advance with Next stage, or play the complete sequence.

The lesion, guides and prosthesis in this process panel are schematic elements for explaining the workflow; they are separate from the original case-study implants. The sequence follows the planning concepts described by the [AO Foundation](https://www.aofoundation.org/approved/approvedsolutionsfolder/2014/patient-specific-plates-for-the-mandible). It presents design intent rather than clinical outcome claims. The process geometry reuses the existing downloaded mandible. Rendering pauses offscreen; the scan runs at approximately 30 fps, and other stages render only during transitions or resizing. Reduced-motion mode uses static stage states.
