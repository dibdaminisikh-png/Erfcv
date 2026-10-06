# Erfan Mohiti — Prosthetic Design Portfolio

English LTR portfolio with dark glass surfaces, an original concept render, scroll reveals and a lazy-loaded Three.js prosthetic-hand viewer. The viewer supports dragging, material/wireframe modes, a finger-flexion slider and Ctrl + scroll zoom. Reduced-motion settings are respected; rendering pauses offscreen.

## Local development

```sh
npm ci
npm run build
npm run dev
```

Open http://localhost:4173. `dist/` is the deployable static site; no server or database is required. Three.js is bundled locally by the build script. Google Fonts has a system-font fallback.

## Personalization

- Name: Erfan Mohiti (provided by the owner).
- The biography, areas of focus and both projects are draft/concept content. Replace them with verified résumé details before using this as a professional record.
- No contact address was supplied. The contact button honestly shows that contact information is pending.
- The downloadable HTML is a brief introduction, not a verified CV.
- `dist/assets/prosthetic-hand.webp` is original AI-generated concept artwork. The interactive model is a procedural design study, not a validated clinical device.

## Design reference

Inspired by the frosted layers and contrasting glass borders of [glassFolio](https://github.com/AmreshSinha/glassFolio), the highest-starred result (136 stars on 2026-10-06) in the GitHub search `glassmorphism portfolio template`, sorted by stars. No template code or assets were copied. This is a popularity measure, not an award or quality rating.

## Cloudflare Pages

In Cloudflare, create a Pages project and connect this repository:

- Framework: None
- Build command: `npm ci && npm run build`
- Build output directory: `dist`
- Production branch: `main`

Or deploy with a Cloudflare API token with Account / Cloudflare Pages / Edit permissions:

```sh
npx wrangler pages project create erfan-mohiti-portfolio --production-branch main
npm run deploy
```

Provide `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` through your environment or GitHub Actions secrets. Never commit credentials. The included GitHub Actions workflow runs manually after those two secrets are set; the Pages project must exist first. For automatic updates, use the native Git integration above.

## Repository

Source repository: https://github.com/dibdaminisikh-png/Erfcv

Cloudflare publication still requires an authenticated Cloudflare account.
