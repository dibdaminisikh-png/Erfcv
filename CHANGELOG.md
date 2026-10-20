# Changelog

## 2.0.4 — 2026-10-20

- Defer and serialize WebGL initialization until scrolling settles, with cancellation for models passed during fast navigation.
- Reuse up to three recent viewers, pause offscreen transitions and preserve camera/display/separation state across eviction.
- Split model preparation into input-friendly tasks and keep in-page navigation free of intermediate model construction.
- Apply the same scheduling to the surgical illustration and remove the case shadow tween while preserving the reveal's opacity and movement.

## 2.0.3 — 2026-10-20

- Remove Top from all seven perspective selectors.
- Ease Front and Side changes over 500 ms with quaternion interpolation, including smooth retargeting and immediate handoff to manual orbit.
- Crossfade Anatomy, X-ray and Mesh over 300 ms while keeping implants opaque during the X-ray transition.
- Share geometry with the wire overlays, prepare blend shaders behind the poster, and stop rendering once transitions settle.
- Preserve selected targets when a viewer is unloaded and respect the existing reduced-motion preference.

## 2.0.2 — 2026-10-20

- Keep implant separation and viewer controls immediately after the anatomy, with case notes below the controls on mobile and desktop.
- Present the mobile design equation as a connected vertical composition with visible plus and equals signs.
- Place surgical stage selection above the mobile animation and playback/next-stage actions directly below it, ahead of the explanatory copy.
- Hide Expand on mobile while retaining the desktop fullscreen view.
- Replace the contact study with an original vector illustration connecting clinical insight and design expertise through conversation.

## 2.0.1 — 2026-10-20

- Fingerprint the complete browser module graph, styles and geometry requests so cached files from an earlier release cannot break the current viewers.
- Remove incomplete viewers on initialization failure and swap posters atomically to prevent overlapping skulls.
- Recover the surgical sequence after a failed initialization or lost WebGL context, with retry available only on failure.
- Preserve the approved layout, anatomy, controls and four-stage surgical animation.

## 2.0.0 — 2026-10-20

- Expand the portfolio to seven original anatomical case studies.
- Show complete anatomy and implants directly on the homepage, with consistent project descriptions and controls.
- Add implant separation and reattachment, orbit, pan, zoom, anatomical perspectives, X-ray, mesh and fullscreen views.
- Optimize geometry and lazy loading, add full-assembly posters, and cap inline scan animation at six seconds.
- Replace the process illustration with a four-stage mandibular planning sequence: lesion analysis, cutting guides, resection and reconstruction.
- Refine the design equation, larger animated project navigation, coordinated entrance effects, smooth desktop scrolling and subtle halftone pointer light.
- Replace the contact decoration with an anatomical reconstruction study and respect touch and reduced-motion preferences.
- Add a portable Node development server, reproducible mesh tools and browser verification notes.
