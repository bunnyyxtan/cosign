# Production art slots

The six checked-in images in this directory are the current Wave 1 production artwork. They are used by the live site and match the repository screenshots; they are not pending placeholders.

- Slots in use: `hero`, `lend`, `cosign`, `bold`, `steady`, `closing`.
- The slot loader also supports `.avif`, `.jpg` and `.png`, and an optional `<slot>.mobile.webp`; first match wins in that order.
- Crop focal points live in `web/src/ui/Art.tsx`.
- The original selection notes and high-resolution replacement brief are [archived for provenance](../../../docs/archive/ASSET_REVIEW_V1.md); they are not an active Wave 1 delivery requirement.

If a slot file is absent, the layout falls back to a quiet tonal surface (and, in development only, a label with its name and size).
