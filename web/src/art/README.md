# Art slots

Drop finished images here, named after their slot. They are picked up automatically at build time; no component changes.

- Slots in use: `hero`, `lend`, `cosign`, `bold`, `steady`, `closing`. Add `<slot>.mobile.webp` for a phone-specific crop (optional).
- Formats: `.avif`, `.webp`, `.jpg`, `.png` (first match wins in that order).
- What each slot needs, and which provided files were accepted or rejected: `docs/ASSET_REVIEW.md`.
- To change the crop of a delivered image, edit `focal` for that slot in `web/src/ui/Art.tsx`.

Until a file exists, the slot shows a quiet tonal surface (and, in dev only, a label with its name and size).
