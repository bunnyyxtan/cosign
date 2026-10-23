# Cosign design system

One system for the website (`/`) and the app (`/app/`). Tokens live in `web/src/ui/tokens.css`, shared components in `web/src/ui/components.css`; a dev-only specimen is served at `/system.html` by `npm run dev`.

## Typography

**Inter Tight** for display type and figures, **Inter** for text: one family at two spacings, both SIL Open Font License, self-hosted (`web/src/ui/fonts/`, licences in `web/public/fonts/`). Latin subset, variable weight: Inter 400–700 with optical sizes 14–32, Inter Tight 500–700.

Chosen after rendering the same Cosign section in Inter Tight, Geist, and Manrope with DM Sans (the V4 pairing). Inter Tight matches the approved screenshot's tight, crisp headlines and has the cleanest tabular figures; as body text it is cramped, so text is set in Inter. Geist read as a developer tool; Manrope's wide figures sprawl in data rows.

| Role | Family, weight | Size (fluid) | Line height | Tracking |
|---|---|---|---|---|
| Hero | Inter Tight 600 | 48 → 112 px | 0.96 | −0.05em |
| Display (section titles) | Inter Tight 600 | 40 → 72 px | 1.0 | −0.045em |
| Title (card titles) | Inter Tight 600 | 28 → 40 px | 1.06 | −0.035em |
| Heading | Inter Tight 600 | 20 px | 1.25 | −0.015em |
| Figure | Inter Tight 600, tabular | 36 → 60 px | 1.0 | −0.04em |
| App figure | Inter Tight 600, tabular | 24 px | 1.0 | −0.03em |
| Lede | Inter 400 | 17 → 19 px | 1.55 | 0 |
| Body | Inter 400 | 16 px | 1.6 | 0 |
| Small | Inter 400 | 14 px | 1.55 | 0 |
| Caption | Inter 400–500 | 12.5 px | 1.45 | 0 |
| Label (eyebrows, table heads) | Inter 600, uppercase | 11.5 px | 1.0 | +0.12em |

**Numbers.** All financial figures use tabular, lining numerals (`.num`, `font-variant-numeric: tabular-nums`). Units follow the figure in Inter 500 at caption size (`1,000.00 MUSD`). MUSD shows two decimals; share prices nine; MEZO rewards four; veBTC power six. A shortfall is rounded **up** to the cent (`up2`), so it is never understated. Headlines use `text-wrap: balance`, paragraphs `pretty`, with deliberate `<br>` breaks on display lines.

## Grid and spacing

- Page gutter `--edge`: 16 → 64 px. Content column `--content`: 1,312 px, centred.
- Text and navigation always sit on the content column. Imagery (hero, closing card) and dark bands bleed to the gutter.
- Card gap `--gap`: 12 → 20 px. Chapter rhythm `--section`: 80 → 168 px.
- Spacing scale (4-based): 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.
- Landing compositions: 7/5 and 5/7 asymmetric splits; the roles chapter is 7/5 with a full-width third card.
- App: 232 px sidebar (Markets, Co-sign, Rewards, Portfolio); one workspace column up to 1,600 px with a 16–40 px gutter, shared by the top bar, banners and content, centred with even margins on wider screens.
- App pages: data on a fluid main column, actions in a sticky column of 340–440 px (`.split`); it stacks, action first, when the workspace is under 820 px wide. Layouts respond to the workspace width with container queries, not the window, so the sidebar never squeezes them. Markets is a two-up card grid; Portfolio is a table that becomes cards under 760 px.

## Radii, borders, elevation

Radii 8 (chips, swatches), 12 (inner blocks), 16 (app panels, fields), 22 (cards), 28 (hero, closing), pill for buttons. Borders are 1 px hairlines drawn as inset shadows (`--hairline` #EBE7EF, `--line` #DDD8E4). Two shadows only: `--shadow-soft` for resting raised cards, `--shadow-lift` for hover and the transaction tray.

## Controls

| Control | Height | Notes |
|---|---|---|
| Button large | 52 px | Landing calls to action |
| Button | 44 px | Default; meets the 44 px touch target |
| Button small | 36 px | Dense app rows; grows to 44 px on coarse pointers |
| Amount field | 56 px | Figure-sized input, unit and Max inside the field |
| Icon / circle link | 40–44 px | |

Variants: dark (primary), light (secondary), white (on imagery), ghost (tertiary). Hover deepens the fill and nudges the arrow; press scales to 0.98; disabled is 42% opacity and is always explained by nearby text (for example "Deposits are closed: the market is under-covered"). Focus is a 2 px `--focus` outline offset 3 px.

App-specific: a two-step indicator (`TwoStep`) above any action that needs an ERC-20 approval; segmented tabs for Lend/Borrow and Add cover/Withdraw; compact pill tabs for the four borrow actions; label/value rows (`Row`) for positions; risk notes as one muted line next to the action that creates the exposure, with longer explanations in closed disclosures.

## Colour roles

| Token | Value | Role | Contrast on paper |
|---|---|---|---|
| `--paper` | #FCFBFA | page | |
| `--porcelain` | #F6F4F8 | quiet band, app sidebar | |
| `--mist` / `--lilac` | #F2EFF8 / #EBE6F5 | cards, secondary button | |
| `--plum` | #262035 | dark band, primary button | |
| `--ink` | #1F1D29 | headings, figures | 16.1:1 |
| `--copy` | #3D3947 | body | 10.8:1 |
| `--muted` | #6B6676 | secondary text, labels | 5.4:1 (4.5:1 on lilac) |
| `--iris` | #6A5F92 | accent headline words | 5.5:1 |
| `--cover` | #9D90DC | junior cover (always with a hatch) | non-text |
| `--senior` | #2B2540 | senior principal | non-text |
| `--loss` | #B42339 | loss and under-covered only | 6.3:1 |
| `--ok` | #357052 | confirmed, live | 4.9:1 |
| `--pending` | #8A5A12 | pending, never success | 5.7:1 |

Cover is never identified by colour alone: it is hatched, loss is cross-hatched with a red edge, room to lend is an outline, and the minimum cover is a dashed rule. Live state uses a round dot; recorded history a square one and the label "Recorded".

## Motion

Transform and opacity only, `cubic-bezier(.16, 1, .3, 1)`.

- **Reveals:** sections rise 28 px and fade over 900 ms, staggered 70 ms per item, once.
- **Hero:** the copy enters in sequence, and the panorama fades up.
- **Parallax:** the hero and closing bands drift downward at 0.10–0.12 of scroll, only ever downward so no edge is exposed. Disabled for touch and for reduced motion.
- **Replay:** figures tween over 900 ms, and segments slide on one fixed 1,400 MUSD scale. Autoplay is 2.6 s per step and stops at the end. Keyboard arrows move between steps.
- **Transactions:** notices sit at the bottom left of the workspace (bottom of the screen on phones), away from the action column. Signing, pending and confirmed-but-updating notices stay and cannot be closed; "Confirmed" appears only after a successful receipt and a re-read of the figures. A success or an approval hides itself after 6 s, a declined request after 8 s; failures, unconfirmed and not-yet-re-read notices stay until closed. Hover or focus holds them. Every notice stays in the session's Activity list. One transaction at a time, enforced in code as well as by disabled buttons. Approvals never start the next step: the form reads the live allowance and offers it as its own button. Rules are checked by `web/scripts/check-activity.ts`.
- **Reduced motion:**
  - Reveals and parallax are skipped.
  - Tweens jump to the end value.
  - Every transition is clamped to 1 ms.

## Imagery

Art slots are filled by dropping `<slot>.webp` into `web/src/art/` (see that folder's README). The provided images are short panoramas, so they are composed as bands that rise out of the surface colour behind a top fade, not as full-bleed backgrounds, and are never shown much past their source detail. Which assets are used where, and what is still missing: `docs/ASSET_REVIEW.md`.
