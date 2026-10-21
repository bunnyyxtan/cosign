# Handoff: premium website and app (feat/premium-site)

_21 October 2026. Status: **waiting for founder and product-lead visual approval.** No further design work until the review is done._

## Where things are

- **Branch:** `feat/premium-site`, pushed to `origin`, seven commits on top of `main` (`7effae5`). Not merged, no PR, not deployed.
- **Rollback point:** local tag `rollback/pre-premium-site` (= `main` at `7effae5`; not pushed).
- **Contracts, deployment addresses and recorded evidence:** unchanged. `git diff rollback/pre-premium-site -- contracts` is empty.
- **Review screenshots** (full resolution, local only, gitignored): `design/review/2026-10-21/`.
  - Desktop at 1440 (1×) and mobile at 390 (2×).
  - Pages: landing, markets, Bold detail, co-sign and positions (with no wallet, and with the dev test wallet), and evidence.
  - Replay steps 01, 03, 04 and 05, plus the in-app loss replay.
  - Smaller copies are committed in `docs/screenshots/`.

## What was built

- **Website** (`web/index.html`, `web/src/site/`):
  - Full-width chapters: hero, idea, roles, recorded loss replay, markets, architecture, evidence, limits, FAQ, closing.
  - Art comes from `web/src/art/` through the slot system in `web/src/ui/Art.tsx`.
- **App** (`web/app/index.html`, `web/src/App.tsx`, `web/src/app/`):
  - Routes: `#/markets`, `#/market/:vault`, `#/cosign`, `#/rewards`, `#/positions` and `#/evidence`.
  - All transaction, approval and receipt logic is carried over unchanged.
- **Shared** (`web/src/ui/`): tokens, components, icons, and the self-hosted Inter and Inter Tight fonts.

## Docs

- **`docs/DESIGN_SYSTEM.md`:** type, scales, grid, spacing, radii, controls, colour roles and motion.
- **`docs/ASSET_REVIEW.md`:** accepted and rejected V1 assets, plus the high-resolution replacement spec (ratios, minimum pixels, mobile focal points).
- **`docs/LOSS_SCANNER_TEST.md`:** the 10,000-block scanner fix and its nine stress scenarios.
- **`docs/WALLET_ACCEPTANCE.md`:** real-wallet acceptance is **BLOCKED / NOT RUN**.

## Checks

| Command | What it does |
|---|---|
| `cd web && npm run check` | Cover-shortfall rounding assertions (also run in CI) |
| `npm run build` | `sync`: fails if a website transaction hash is missing from `demo-run.json`; then `tsc` and `vite build` |

Verified in the browser at 320, 390, 768, 1,024, 1,440 and 1,920 px. There is no page overflow and no console errors, and the CSP passes with no violations.

## Open items (need a decision or a person)

1. Visual approval of the screenshots in `design/review/2026-10-21/`.
2. High-resolution re-exports of `hero`, `lend`, `cosign`, `bold`, `steady` and `closing` (spec in `ASSET_REVIEW.md`). The current art is soft on retina screens.
3. Rejected assets, if the founder disagrees: `cosigner-capital` (token implication) can be swapped in by renaming the file.
4. Real-wallet acceptance with MetaMask (not run).
5. The three small defects from the first review are fixed: the footer arrow wrap, the 768 px hero crop, and the overview's silent loss-read failure.
6. Earlier standing items:
   - The hosting choice and account.
   - Test assets for the tester.
   - Legal review of the Morpho GPL licence against Cosign's MIT licence.
   - `research/` notes in public history.

## Git attribution

On 21 October 2026, with founder approval, the AI `Co-Authored-By` trailers were removed from the first five branch commits. Only the messages changed: authors, dates, file changes and order are identical, and the source tree is byte-identical (`133ce01`). The branch was pushed with `--force-with-lease`. The pre-rewrite tip `5ee49ce` is kept locally as the tag `backup/premium-site-pre-rewrite` and the branch `backup/premium-site-pre-rewrite-branch` (neither is pushed). Rewritten commits: `527a469`, `3e3a075`, `d1b4a8c`, `71021b6`, `1c769e0` and `eab6e14`. A local `commit-msg` hook rejects AI trailers and any author other than Bunnyy, and the project's Claude Code settings turn commit attribution off.

## Re-running the verification

The tooling lives in the session scratchpad (`tools/`), and none of it is in the repo:

- `shoot.mjs`: screenshots and overflow checks.
- `interact.mjs`: interaction checks.
- `scan-test.mjs`: the scanner stress test.
- `csp.mjs`: the CSP check.
- `review.mjs` and `frames.mjs`: the review captures.

Puppeteer with Edge launches only from PowerShell on this machine, not from Git Bash. Launch configs: `web-build` (production preview, :4173) and `web` (dev, :5174; `?devconnect` uses the git-ignored dev test wallet, which is read-only unless a button is pressed).
