# Development

How to build, test and change Cosign. Everything runs on Mezo testnet; nothing here needs real funds.

## Requirements

- [Foundry](https://book.getfoundry.sh/) 1.8.5 (the version CI uses).
- Node 24 (CI) or any current LTS for the build. `npm run check` runs a TypeScript file directly with Node's type stripping, which needs Node 22.6 or newer.
- Git with submodules (`contracts/lib` holds Morpho Blue, OpenZeppelin and forge-std).
- Python 3 for the deployment verification and demo scripts.

## Layout

| Path | What is in it |
|---|---|
| `contracts/src` | The Cosign contracts. See [PRODUCT.md](PRODUCT.md). |
| `contracts/test` | Foundry unit, edge, adversarial and Pyth-oracle tests (51 passing tests, plus 1 opt-in fork test skipped by default). |
| `contracts/script` | `Deploy.s.sol`, the resumable live demo (`demo.py`), evidence and verification scripts, and [`acceptance/`](../contracts/script/acceptance), the read-only checkers used in the real-wallet sessions. |
| `contracts/deployments` | Addresses and recorded runs. See its [README](../contracts/deployments/README.md). |
| `contracts/broadcast` | Foundry broadcast logs for the deployment transactions. |
| `web/src/site` | The website: chapters, the recorded loss replay. |
| `web/src/app` | The app: markets, co-sign, rewards, portfolio, recorded evidence. |
| `web/src/ui` | Design tokens, shared components, icons and the self-hosted fonts. |
| `web/src/art` | The provided artwork and the slot system that places it. |
| `web/scripts` | `sync.mjs` (copies deployment data into the bundle and guards the evidence), checks for money math, transaction activity and routes, plus `devkey.mjs` (dev wallet, see below). |
| `docs` | Documentation. Start at the [index](README.md). |

## Everyday commands

```bash
# contracts
cd contracts
forge build
forge test -vv                        # FOUNDRY_FUZZ_RUNS=2000 to match CI

# website and app
cd web
npm ci
npm run dev                           # http://localhost:5173 (site) and /app/
npm run check                         # money math, transaction-activity and route assertions
npm run build                         # sync, type check, production bundle in web/dist
npm run preview                       # serve the production bundle
npm audit --omit=dev                  # dependency audit
```

`npm run dev` also serves a component specimen at `/system.html` (see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)); it is not part of the production build.

## Verifying the deployment

```bash
python -I contracts/script/verify_deploy.py     # 43 checks against the chain
python -I contracts/script/verify_bytecode.py   # deployed bytecode against compiled source
python -I contracts/script/evidence.py          # regenerates docs/TESTNET_EVIDENCE.md from the recorded run
```

## Environment and keys

- `.env.example` lists the variables the demo scripts read. Copy it to `.env` (git-ignored) and use **testnet-only** keys.
- `web/scripts/devkey.mjs` writes a git-ignored `web/.env.development.local` that lets `vite dev` install a test-only wallet shim (`web/src/devWallet.ts`) for screenshots and automated runs. The shim installs only under `vite dev`, and the production bundle contains none of it. Do not use it as evidence of wallet behaviour: [WALLET_ACCEPTANCE.md](WALLET_ACCEPTANCE.md) counts only real browser-wallet runs.
- Never commit a key. CI uses no secrets.

## Git

- There is one branch, `main`. Commit small and often straight to it; CI must stay green.
- Commits use the configured author identity (Bunnyy). Do not add `Co-Authored-By` trailers for AI tools or anyone else.
- Do not rewrite or force-push `main`.

## Real-wallet acceptance and its tooling

[WALLET_ACCEPTANCE.md](WALLET_ACCEPTANCE.md) is the checklist and the evidence log. Each real-wallet session ran with a person signing every transaction in Rabby and a **read-only checker** ([`contracts/script/acceptance`](../contracts/script/acceptance)) that matched each transaction against an agreed manifest onchain. The checkers hold no keys and send nothing. Simulations on a local fork are labelled as such and never counted as wallet evidence.
