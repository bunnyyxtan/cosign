# Art slots

Drop finished images here, named after their slot. They are picked up automatically at build time; no component changes.

- `hero.webp` for the desktop version, `hero.mobile.webp` for phones (optional; falls back to `hero.webp`).
- Formats: `.avif`, `.webp`, `.jpg`, `.png` (first match wins in that order).
- Sizes, safe areas for text, focal points and tone for every slot: `docs/ASSET_BRIEFS.md`.
- To change the crop of a delivered image, edit `focal` for that slot in `web/src/ui/Art.tsx`.

Until a file exists, the slot shows a quiet tonal surface (and, in dev only, a label with its name and size).
