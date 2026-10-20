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

## 2.0.2 Responsive viewing controls

- Inspected mobile and desktop screenshots of the equation, case cards, surgical process and replacement contact illustration.
- Chrome touch emulation at 320×568, 375×667, 390×844 and 768×1024 showed no horizontal overflow. Stage selection, the anatomy animation and playback actions fit together in each viewport when the viewing console was aligned below the sticky index.
- All seven mobile assemblies had exactly one canvas. Moving separation to 100% changed the rendered pixels; Reset restored the original canvas pixels exactly. Each control panel directly followed the model, ahead of its explanatory notes.
- Verified touch-control activation, all four distinct rendered surgical stages, automatic playback advancing to Guide, and Next stage advancing to Resect while stopping automatic playback.
- The equation displayed both plus signs and the equals sign on mobile. Expand was hidden on portrait and landscape touch screens, while native desktop fullscreen remained functional.
- Reduced-motion disabled the contact illustration's animated connection. The vector artwork adds no image or WebGL download.
- Desktop Edge passed all seven model controls and four surgical stages without application errors or failed asset requests.

## 2.0.3 Perspective and Display transitions

- Exercised all seven assemblies with intermediate rendered perspective angles, exact Front/Side target poses and intermediate opacity/wire values. Perspective uses a 500 ms eased quaternion interpolation; Display uses a 300 ms eased crossfade.
- The implant stayed fully opaque throughout Anatomy ↔ X-ray. Returning through all Display modes restored the original anatomical rendering; raw framebuffer comparisons differed by at most one intensity level in one channel among 2,592,000 channels in the measured round trips.
- Verified uninterrupted retargeting, manual drag cancelling a perspective transition, concurrent perspective/display changes, and restoring the selected target after unloading during a transition.
- Confirmed no render-frame increments while idle, pending animation cancellation on disposal, and immediate stable states with reduced motion, including initialization directly in Mesh mode.
- Geometry counts remained equal to the original part counts. The complete seven-case sequence and all transitions requested exactly the existing 34 mesh files, with no additional geometry downloads.
- Prepared the blend shaders and wire indices before the poster is removed to avoid a first-selection compilation hitch. A measured cold Mesh selection progressed smoothly to its target in approximately 300 ms.
- Actual interface checks in Chrome touch emulation and desktop Edge passed both remaining perspective buttons, intermediate rendered poses, all three Display modes and separation controls in every case. All four surgical stages also remained functional; no application errors or failed asset requests were observed.

## 2.0.4 Scroll scheduling and viewer reuse

- Reproduced the scroll pauses with frame timestamps, Long Tasks and Long Animation Frames in Chrome at 1440×1000. The downward pass used 75 wheel inputs of 190 px, spaced 145 ms apart, followed by the footer's Back to top link.
- In the same local cold-pass profile, downward JavaScript long tasks fell from 7 (459 ms blocking time) to 0. Back to top fell from 3 long tasks (249 ms blocking time) to 0, and stopped constructing all seven intermediate viewers.
- Worst recorded frame intervals changed from 300.3 to 91.8 ms downward and from 183.5 to 8.5 ms on return; the remaining two downward intervals above 50 ms had no attributed JavaScript and no blocking long task. These are local comparative measurements, not a frame-rate guarantee for every device.
- Complete anatomical posters remain visible during continuous scrolling. A shared queue waits for 180 ms of scroll quiet, prioritizes the nearest view, yields between mesh preparations and cancels work for views passed during navigation.
- Verified reuse of the same canvas on a short reversal, a maximum of three cached case canvases, and exact preserved rendering after a cache hit and after eviction/restoration of Side + Mesh + 72% separation.
- Offscreen renderers stopped drawing; resuming restored the selected targets, including changes made while paused. Aborted staged initialization removed its canvas. Existing initialization-failure and context-loss Retry checks passed for both gallery and surgery.
- Chrome mobile and desktop Edge interface checks passed all seven perspective/Display/separation controls and all four surgical stages, without application errors or failed asset responses.
- At 1440×3200, a visible case evicted by the three-viewer budget successfully reloaded through its Display control while the retained canvas count stayed at three.
