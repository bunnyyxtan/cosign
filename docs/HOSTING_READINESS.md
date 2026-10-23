# Public hosting and CI readiness

_23 October 2026. A checklist only: nothing is deployed, merged or submitted. Branch: `feat/premium-site` at the commit that adds this file._

## Verified today

| Check | How | Result |
|---|---|---|
| Web CI job from a clean clone of the pushed branch | `git clone`, `npm ci`, `npm run check`, `npm run build`, `npm audit --omit=dev`, Node 24 as in CI | All pass; 0 vulnerabilities |
| The build guards recorded evidence | `sync` fails the build if a hash shown on the website is missing from `demo-run.json` | Passes |
| Build output | `web/dist` holds `index.html`, `app/index.html`, the two deployment data files, fonts, `_headers` | Present |
| Content-security policy and headers | Same policy in `vercel.json` and `web/public/_headers`; checked against the site, Markets and Recorded evidence pages | 0 violations |
| Secrets | No key-shaped strings in tracked source; only `.env.example` is tracked; `research/` is not tracked; the dev wallet code and key are absent from the production bundle | Clean |
| Repository | Public, MIT, default branch `main`, CI on `main` last two runs succeeded | OK |
| Contracts CI job from a clean clone (submodules, `forge build`, `forge test` at 2,000 fuzz runs, Foundry 1.8.5) | Run locally exactly as the workflow does | 40 of 40 tests pass; the build prints lint notes only |
| Contracts unchanged | `git diff rollback/pre-premium-site -- contracts` | Empty |

## Not yet verified

- **A GitHub CI run for this branch.** The workflow runs only on pushes to `main`/`master` and on pull requests, so the branch has never had one. Both jobs were reproduced from a clean clone (above); a real run needs a pull request.
- **A hosted URL.** Nothing is deployed. The first hosted load is the first test of the headers, the `/app/` directory index and public-RPC behaviour from a visitor's network.
- **CSP with a connected wallet.** The check covered pages without a wallet; wallet icons arrive as `data:` URIs, which the policy allows, but it has not been run with a wallet connected.

## Blockers that need a founder decision

1. **Host and account.** `vercel.json` is ready (build `cd web && npm ci && npm run build`, output `web/dist`, headers). Cloudflare Pages or Netlify would use `web/public/_headers` instead. Pick one, and a domain if wanted.
2. **Merge path.** Open a pull request from `feat/premium-site` to `main` so CI runs, after the founder and product lead approve the visuals. Not done: no merge or PR without authorisation.
3. **Licences.** `LICENSE` is MIT; Morpho Blue is vendored under its own licence (GPL-2.0-or-later for parts). `NOTICE.md` lists it. A legal read of the combination is still open.
4. **High-resolution art** for the six slots in `ASSET_REVIEW.md`; the current images are soft on retina screens.
5. **Real-wallet acceptance** is partial: see `WALLET_ACCEPTANCE.md` for the rows still open (voting and rewards, no-transaction checks, a second wallet, a first-time tester).

## Fix before launch (small)

- `README.md` still says browser-wallet flows are "Not run, no flow is claimed as passed". It now understates the evidence; update it to point at the acceptance results.
- `docs/HANDOFF.md` open items and the screenshot sets in `docs/screenshots/` predate the wallet dialog, the cover-withdrawal form and the Rewards funding section.
- The demo state before judges arrive: Bold has 15 MUSD of cover and no retail lending, so the Markets page shows 0% APRs. A restore plan is in the acceptance log (needs its own authorisation).

## Things to know about running in public

- **The app reads the public Mezo testnet RPC directly from each visitor's browser** (`https://rpc.test.mezo.org`, allowed by the CSP). It can rate-limit; the app retries, and shows an error rather than zeros when reads fail.
- **The loss history scans 10,000-block windows from the deployment block.** That is a few more windows every day (about 55,000 blocks by 23 October); beyond a few hundred windows it should start from a checkpoint instead.
- **Redeploying contracts changes every address**; the app and website read them from `contracts/deployments/31611.json` at build time.
- **Everything is testnet.** The footer and the unaudited-prototype wording must stay on every page.
- **Node version:** CI uses Node 24 for the math check (TypeScript type stripping). A host only needs to run `npm run build`, which works on current LTS Node; set the host to Node 22 or 24 to match.

## Suggested order, once authorised

1. Visual approval of the review screenshots.
2. Open the pull request, confirm both CI jobs pass on GitHub.
3. Choose the host, deploy a preview, run the wallet-free checks and one wallet flow against the preview URL.
4. Restore the demo positions (separate authorisation), re-capture screenshots.
5. Merge, then point the final URL at it.
