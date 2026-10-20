# Changelog

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
