# Erfan Mohiti — Maxillofacial Prosthesis Portfolio

English portfolio for Erfan Mohiti, a maxillofacial prosthesis designer at [Farin Roshaan](https://farinroshaan.com/). The site presents verified professional experience, a responsive medical-design visual system and a custom interactive Three.js model lab.

## Interactive 3D lab

- Rotate, zoom and pan each model.
- Switch between surface, wireframe and translucent views.
- Explore three procedural concept studies: mandibular angle, cranial plate and subperiosteal framework.
- Open binary or ASCII `.stl` files locally. Files stay in the visitor's browser and are never uploaded.

The built-in objects are illustrative concept studies. They do not represent a patient, validated device or clinical outcome. Add real portfolio models only after de-identification and confirmation that they may be published.

## Local development

```sh
npm ci
npm run build
npm run dev
```

Open `http://localhost:4173`. The deployable static site lives in `dist/`.

## Deployment

The repository includes workflows for GitHub Pages and Cloudflare Pages. For Cloudflare Pages use:

- Build command: `npm ci && npm run build`
- Output directory: `dist`
- Production branch: `main`

## Source

https://github.com/dibdaminisikh-png/Erfcv
