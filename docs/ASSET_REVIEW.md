# Visual asset review: Cosign Original Visual Assets V1

Reviewed at 100% before integration: sharpness, crop seams, embedded text, composition, and fit at 390, 768, 1,440 and 1,920 px.

**The constraint that shaped every placement:** every image is 225 to 342 px tall, cropped from 1,852 px concept boards. None can fill a card or hero as a full-bleed background without heavy enlargement. They are composed as panoramic bands that rise out of the surface colour behind a soft top fade, and are shown at no more than about 1.3x their source detail (Lanczos resampling, light unsharp mask, WebP q86). They look sharp on standard displays and **soft on 2x/3x retina screens**. Re-exports at the sizes below would remove that softness without any code change.

Nine of the eleven files carried a 6 to 9 px white band from the board crop; `onchain-evidence` also had one on its left edge. These were trimmed. `glass-ledger` has a rounded tile corner baked into its top-left.

## Accepted

| File | Used as | Where | Treatment |
|---|---|---|---|
| `hero-landscape` | `hero` | Hero panorama | Cropped to x 0–1,460, removing the unrelated cliff town on the right. Marble and glass rings read as two parties bound together. Focal point at the rings on every width. |
| `senior-capital` | `lend` | "Lenders" card | Stacked glass layers: senior capital as structure. Trimmed the cut-off glass column on the left and the top seam. |
| `risk-boundary` | `cosign` | "Co-signers" card | Capital streaming between two boundaries, exposed: the first-loss position. Top seam trimmed. |
| `market-bold` | `bold` | Bold market thumbnail (site and app) | Dark, fractured, lit from within: the higher-leverage configuration. Only used small (≤184 px), where it is sharp. |
| `market-steady` | `steady` | Steady market thumbnail | Calm and light: the thicker-cover configuration. Copy beside it states that neither market is safe. |
| `landscape-portal` | `closing` | Closing call to action | An arch opening onto a vista, under "Enter the Cosign app". 1,055 px wide, so the band is capped and fades into the card at the sides. |

## Rejected

| File | Reason |
|---|---|
| `cosigner-capital` | A coin stamped with the Cosign petal mark. It implies a Cosign token, which does not exist; the asset guide itself says the medallion is not an official token. It also falls into the "coins" pattern the founder ruled out. To use it anyway, rename it to `web/src/art/cosign.webp`. |
| `finance-architecture` | Classical columns: the bank-building cliché the brief rules out, and it says nothing specific about first-loss capital. |
| `onchain-evidence` | The glass panels carry pseudo-UI and illegible fake text, which the brief forbids. It also implies charts Cosign does not show. |
| `glass-ledger` | Fake document text on the glass and a baked-in rounded corner seam. Its stacked cubes are close to the "random glass cubes" pattern. |
| `hero-alternate` | The softest file in the pack (lowest edge detail). It repeats the hero's ring-in-landscape idea, so using it as well would make the page repetitive. Kept in reserve. |

## High-resolution replacement specification

Measured from the production build at 320, 390, 768, 1,024, 1,440, 1,920 and 2,560 px. "Minimum" covers the largest rendered size at 2× (desktop retina) and phones at 3×. A file named `<slot>.mobile.webp` is served automatically below 640 px wide. Compose it at the mobile ratio and cover-cropping removes almost nothing.

| Slot (file in `web/src/art/`) | Largest rendered box (CSS px) | Deliver: ratio | Minimum px | Subject placement | Mobile (`.mobile.webp`) |
|---|---|---|---|---|---|
| `hero.webp` | 1,898 × 445 (≥1,920 wide); 1,313 × 338 at 1,440; 700 × 360 at 768 | 4.27 : 1 | **3,840 × 900** | Sky in the top 40% (it fades under the headline). Subject in the right third: centre at about 75% across, base on the bottom edge. Keep the outer 6% at each side calm, because the edges fade. | 356 × 300 box → **6 : 5, 1,200 × 1,000**. Rings centred; top 35% sky. Today's crop sits at 87% across. |
| `lend.webp` | 754 × 238 (desktop); 700 × 193 (tablet) | 3.6 : 1 | **1,728 × 480** | Object in the right 60%, centre at about 70% across; top 32% quiet (fades under the card text). | 356 × 210 box → **12 : 7, 1,200 × 700**. Object centred low; top third quiet. Today's crop sits at 62%. |
| `cosign.webp` | 538 × 238 (desktop); 700 × 309 (tablet) | 2.26 : 1 | **1,600 × 708** | Centred; top 32% quiet. | 356 × 210 box → **12 : 7, 1,200 × 700**. Centred. |
| `bold.webp`, `steady.webp` | 184 × 216 (site, 1,024 px); 332 × 190 (site mobile); 64 × 64 (app) | 4 : 3 | **1,200 × 900** | Subject inside the central 60% × 55%. It is cropped to portrait on desktop, wide on phones and square in the app. | Not needed. |
| `closing.webp` | 1,372 × 387 (≥1,920 wide); 1,313 × 370 at 1,440 | 3.55 : 1 | **2,800 × 790** | Top 40% sky (fades under the headline and button); left and right 8% calm. Arch in the left third, centre at about 30% across. | 356 × 220 box → **8 : 5, 1,200 × 740**. Arch centred. Today's crop sits at 28%. |

**For every file:** sRGB, no text, logos or UI glyphs, no seams or tile corners. Deliver PNG or lossless WebP; the build pipeline takes it from there (WebP q86, no upscaling). The same light and grade as V1: pale lavender, warm low sun, porcelain stone and glass.

### Optional, not yet wired

| Slot | Section | Composition | Deliver at |
|---|---|---|---|
| `evidence` | "Trust less. Verify more." dark band | The same world at dusk: one clear, polished glass tablet with no glyphs, lit from behind, on stone; space on the left for text. | 2,400 × 1,200 |
| borrower art | "Borrow against MEZO" card | Currently typographic with the real LTV figures, which carries the information better than art would. Add art only if it stays wordless. | 2,048 × 600 |

The optional slots need a small layout change to use, so they wait for your approval.

To swap a file: drop it in `web/src/art/` under the slot's name. To change a crop: edit `focal` in `web/src/ui/Art.tsx`, or the per-breakpoint `--focal` in `web/src/site/site.css`.
