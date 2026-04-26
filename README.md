# weddingwebsiteAV

Wedding website for **Anjani & Varun Ram** — December 11–12, 2026 · Oleander Farms, Karjat, Maharashtra.

A single-file React site rendered in the browser via Babel — no build step. Drop the HTML on any static host (GitHub Pages, Netlify, Vercel, etc.) and it works.

## Run locally

Live-reload server during edits:

```bash
npx live-server --port=5173 --entry-file="Wedding Website.html"
```

Then open http://127.0.0.1:5173/Wedding%20Website.html — the browser auto-refreshes whenever you save.

## File structure

```
weddingwebsiteav/
├── Wedding Website.html    Main site — markup, styles, React components, all in one file
├── tweaks-panel.jsx        Dev-only sidebar for theme/feature toggles (loaded by the HTML)
├── uploads/
│   ├── hero-desktop.png    Watercolor hero background (Midjourney-generated)
│   ├── ganesha.webp        Ganesha image used in the blessings section
│   └── Riya & Taric.pdf    Reference design used as the watercolor style anchor
└── README.md               You are here
```

## Site sections

`Hero` · `Blessings` (Ganesha) · `About Us` (split bios) · `Our Story` · `Celebrations` (Welcome+Mehndi / Sangeet / Snatakam / Wedding) · `Venue` (Oleander Farms) · `Travel` · `Attire` · `Gallery` · `FAQ` · `RSVP` · `Footer`

## Customization

Search the HTML for `EDITME-` to find blocks you'll want to update before launch:

- **`EDITME-PARTIES-BEGIN`** — replace the sample guest list with your real heads-of-party and seat counts. The RSVP form looks people up by name from this list.
- **`EDITME-CONTACT-BEGIN`** — your email and phone for the "can't find your name / have an issue?" RSVP fallback.

## Hero watercolor

The hero uses `uploads/hero-desktop.png`. To regenerate (or commission a portrait version for phones):

- Style anchor: `uploads/Riya & Taric.pdf` page 1 — pass to Midjourney as `--sref`
- Base prompt and tuning notes live in the project chat history
- Save mobile (9:16) version as `uploads/hero-mobile.png` and a `<picture>` swap can be wired in

## Tech notes

- React 18 + ReactDOM via UMD CDN
- Babel Standalone for in-browser JSX transform
- Fonts: Cormorant Garamond, DM Sans, Noto Serif Telugu, Tiro Devanagari Hindi (Google Fonts)
- No build step, no bundler, no package.json — by design
