# Hosting

The app is a static Vite build. It reads the Mezo testnet RPC from each visitor's browser and needs no server, database or secret. **It is hosted on Vercel at [cosign-eight.vercel.app](https://cosign-eight.vercel.app/)** (website) and [/app/](https://cosign-eight.vercel.app/app/) (application), built from `main`.

## What is ready

| Item | State |
|---|---|
| Build | `cd web && npm ci && npm run build` writes `web/dist`. The build first copies `contracts/deployments/31611.json` and `demo-run.json` into the bundle and fails if a transaction hash shown on the website is missing from the recorded run. |
| Pages | `/` (website) and `/app/` (application); the app uses hash routes (`#/markets`, `#/market/<vault>`, `#/cosign`, `#/rewards`, `#/positions`, `#/evidence`), so no rewrite rules are needed on any host. |
| Headers | `vercel.json` (Vercel) and `web/public/_headers` (Cloudflare Pages, Netlify): a strict Content-Security-Policy that allows only the site itself and `rpc.test.mezo.org` (fonts and images are self-hosted), no framing, no referrer, no camera, microphone or location. |
| Secrets | None. The production bundle contains no private key, no `.env` value and no dev-wallet code. |
| Contracts | Only the verified v2 testnet addresses in `31611.json`. |
| Warnings | A footer on every page and a guarantee panel on market pages state that this is an unaudited testnet prototype. |

## Checked

- The CI jobs, reproduced from a clean clone: web (install, math checks, production build, `npm audit --omit=dev` with 0 vulnerabilities) and contracts (build and all 40 tests at 2,000 fuzz runs). They also run on every push to `main`.
- Served exactly as Vercel will serve it (the headers from `vercel.json`, which match `web/public/_headers`), every page was loaded at 1440 px and 390 px, plain and with a read-only stand-in wallet connected: website, Markets, Bold, Steady, Recorded evidence, Co-sign, Rewards, Positions. Result, 18 of 18 loads: no CSP violation, no console error, no failed request, no horizontal overflow, the testnet and unaudited warning present, no mock or dev-wallet text. (Scripted run on 23 October 2026, local server, live testnet RPC.)
- The production bundle contains no dev-wallet code and none of the local test key values.
- The hosted site, 23 October 2026: it serves the same build as `main` at `44414ce` (identical asset hashes); every response carries the policy above plus HSTS; `/app` and `/app/` both open the app; unknown paths return 404. A scripted browser walk of the website and every app page, desktop and phone, plain and with a read-only stand-in wallet (20 loads) found no policy violation, console error or failed request, no horizontal overflow, live reads from `rpc.test.mezo.org` on every app page, and working explorer links from the loss replay.
- Not yet checked: a real browser wallet (Rabby) on the hosted domain. See [WALLET_ACCEPTANCE.md](WALLET_ACCEPTANCE.md).

## Vercel

Deploy from `main` only (Production Branch `main`). The project needs no environment variables and any Node 20 or newer; leave Framework Preset as "Other" so `vercel.json` controls the build.

1. Import `bunnyyxtan/cosign`. Leave the root directory as the repository root; `vercel.json` sets the build command and output directory.
2. Deploy. No environment variables are needed. Do **not** set `VITE_RPC` or any `VITE_DEV_*` value.

## Cloudflare Pages or Netlify

Build command `cd web && npm ci && npm run build`, output directory `web/dist`, root directory the repository root. Headers come from `web/public/_headers`. Use Node 22 or 24 to match CI.

## After the first deploy

- Open the URL in a clean browser profile with no wallet: the first page and the loss replay must work.
- Check the browser console for blocked requests (the policy lists exactly what is allowed).
- Run the wallet checklist in [WALLET_ACCEPTANCE.md](WALLET_ACCEPTANCE.md) against the public URL.
- The URL is in the README and the GitHub repository's website field.

## Things to know about running in public

- **Public RPC.** Every visitor's browser calls `https://rpc.test.mezo.org`. It can rate-limit; the app retries and shows an error rather than zeros when reads fail.
- **Loss history.** It scans 10,000-block windows from the deployment block, a few more windows every day (about 55,000 blocks by 23 October). Beyond a few hundred windows it should start from a checkpoint.
- **Redeploying contracts changes every address.** The app and website read them from `contracts/deployments/31611.json` at build time.
- **Everything is testnet.** The footer and the unaudited-prototype wording must stay on every page.
