# Browser verification

Validated locally in Chrome on 2026-10-20. Measurements use the completed homepage and full anatomical assemblies, not implant-only previews. These are local browser measurements and a synthetic connection profile, not production hosting measurements.

## Loading measurements

| Scenario                                                     | Measured result |
| ------------------------------------------------------------ | --------------- |
| Local page navigation                                        | 114 ms          |
| Local full-model loads during collection traversal           | 41–126 ms       |
| First model during initial integration                       | 281 ms          |
| Simulated 4G initial page                                    | 730 ms          |
| Simulated 4G first complete model, including Three.js import | 2,434 ms        |
| Simulated 4G largest assembly: TMJ                           | 3,565 ms        |

4G profile: 10 Mbps downstream, 5 Mbps upstream, 80 ms latency, disabled browser HTTP cache, 4× CPU throttling. The initial page requested zero mesh files and did not request Three.js before the collection approached the viewport. During traversal, only two model canvases were active in the measured desktop viewport.

All seven models total 10,777,726 bytes of binary geometry. Largest single assembly: TMJ, 2,697,108 bytes. Full anatomical WebP posters are independently lazy-loaded. A global timed loading gate is unnecessary with this architecture; inline scan animation is capped at six seconds and never blocks the page.

## Functional checks

- All seven assemblies loaded with both anatomy and implants visible by default.
- Every implant moved at separation 100%; anatomy and graft components remained stationary.
- Intermediate separation was linear; returning to 0% restored exact original coordinates in all seven cases.
- Zoom, camera reset, display modes, camera perspectives, keyboard rotation and Shift-drag pan worked.
- Fullscreen entry and exit worked.
- Leaving and returning to a study preserved its separation, mesh mode and camera; before/after canvas pixels matched.
- Mobile layout and navigation were checked at 390 px, with touch emulation, touch-control activation and page-scroll mode.
- Reduced-motion disabled the decorative surface and anatomical scanning animations.
- A simulated 503 geometry response preserved the anatomical poster and exposed Retry; retry recovered the complete model.
- A deliberately delayed geometry request showed the slow-connection status after six seconds while the page remained usable; scan animation is 1.5 seconds × four iterations.
- No application JavaScript errors or missing deployed asset requests were observed in normal operation.
- `npm run build` validated all seven collections, 34 mesh files and eight generated anatomical posters.

## Visual refinement and surgical sequence

- Confirmed four distinct rendered stages: highlighted mandibular lesion, fitted cutting guides, resected segment and positioned reconstruction prosthesis.
- Observed repeated lesion highlighting as the scan crossed the region in both directions.
- Verified explicit sequence playback and cancellation on manual stage selection.
- Verified larger 13–14 px project navigation labels, active-surface motion and section alignment below the sticky index.
- Measured progressive wheel motion on desktop; a focused model canvas zoomed while page position stayed fixed.
- Verified that the halftone field follows the mouse without receiving pointer events.
- Verified that reduced-motion disables wheel smoothing, the pointer light and entrance effects.
- Verified native touch scrolling and no pointer light on touch devices; mobile viewport had no horizontal document overflow.
- The anatomical process adds one 12 KB WebP fallback; it reuses the existing 225 KB mandibular geometry and shared Three.js module.

## 2.0.1 Chrome cache regression

- Reproduced the reported overlap by serving the previous release's cached viewer and STL manifest to the current page: the old viewer rendered a canvas, then failed on the missing `setSeparation` method, leaving the poster visible. The surgical module also failed because the cached viewer lacked `loadProjectGeometry`.
- A release fingerprint now covers the HTML's module and stylesheet references, the full module dependency graph, the manifest and geometry requests. Repeating the build without edits produces the same fingerprint.
- With stale unversioned viewer/manifest responses deliberately injected, Chrome loaded all seven complete assemblies through the versioned URLs. Every case had exactly one canvas and a hidden poster; all four surgical stages produced distinct rendered frames, without application errors.
- Forcing the optional Performance timing API to throw did not interrupt model initialization.
- Injected failures after model canvas attachment and during surgical initialization left zero orphan canvases. Retry recovered both views. Simulated WebGL context loss also recovered through Retry in both sections.
- Final local Chrome and Edge checks passed for all seven assemblies, separation/reset controls and all four process stages, with no JavaScript errors or failed asset responses. The approved layout, model geometry and surgical sequence were preserved.
