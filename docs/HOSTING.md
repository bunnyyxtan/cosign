# Hosting the app

The app is a static Vite build. It reads the Mezo testnet RPC from the browser and needs no server, database or secret. Hosting it is **not done yet**: it needs the founder's approval and an account connection.

## What is ready

| Item | State |
|---|---|
| Build | `cd web && npm ci && npm run build` writes `web/dist`. `npm run build` first copies `contracts/deployments/31611.json` and `demo-run.json` into the bundle. |
| Routing | Hash routes (`#/`, `#/markets`, `#/market/<vault>`, `#/cosign`), so no rewrite rules are needed on any host. |
| Headers | `vercel.json` (Vercel) and `web/public/_headers` (Cloudflare Pages): strict Content-Security-Policy that allows only the app itself, Google Fonts and `rpc.test.mezo.org`; no framing; no referrer. |
| Secrets | None. The production bundle contains no private key, no `.env` value and no dev-wallet code (checked by the bundle scan in the release steps). |
| Contracts | Only the verified v2 testnet addresses from `31611.json`. |
| Warnings | Footer on every page and a guarantee panel on market pages state that this is an unaudited testnet prototype. |

## Vercel

1. Import `bunnyyxtan/cosign`. Leave the root directory as the repository root; `vercel.json` sets the build command and output directory.
2. Deploy. No environment variables are needed. Do **not** set `VITE_RPC` or any `VITE_DEV_*` value.
3. Proposed project name: `cosign-testnet` (the URL `https://cosign-testnet.vercel.app` if free).

## Cloudflare Pages

Build command `cd web && npm ci && npm run build`, output directory `web/dist`, root directory the repository root. Headers come from `web/public/_headers`.

## After the first deploy

- Open the URL in a clean browser profile with no wallet: the first page and the replay must work.
- Check the browser console for blocked requests (the CSP lists exactly what is allowed).
- Run the wallet checklist in `WALLET_ACCEPTANCE.md` against the public URL.
