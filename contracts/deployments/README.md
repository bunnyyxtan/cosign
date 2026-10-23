# Deployment records (Mezo testnet, chain 31611)

These files are evidence and configuration. Do not edit them by hand: scripts write them, and the website build checks them.

| File | What it is | Used by |
|---|---|---|
| `31611.json` | **The current (v2) deployment:** every contract address, the deployment block, and Mezo's MUSD, MEZO and veBTC addresses. | The app and website (copied into the bundle at build time), all scripts, the README |
| `demo-run.json` | **The recorded live run** against v2: 35 transactions and 58 checks (the loss replay, the self-funded rewards, the failures kept with their causes). | The website's loss replay, `docs/TESTNET_EVIDENCE.md`. `npm run build` fails if a transaction hash shown on the website is missing from this file. |
| `verify-31611.json` | Output of `script/verify_deploy.py`: 43 checks of the deployment against the chain. | `docs/TESTNET_EVIDENCE.md` |
| `bytecode-31611.json` | Output of `script/verify_bytecode.py`: deployed bytecode against the compiled source, 8 of 8 contracts. | `docs/TESTNET_EVIDENCE.md` |
| `demo-live.log` | The console log of the live run that produced `demo-run.json`. | Reference |
| `31611-v2rc.json`, `verify-31611-v2rc.json` | An earlier snapshot of the v2 addresses and its verification output, kept for provenance. | Reference |
| `31611-v1.json`, `demo-run-v1.json`, `migration-v1.json` | **Archived v1 deployment:** addresses, its recorded run (45 transactions, 39 checks) and the migration steps. Superseded by v2. | [`docs/archive/`](../../docs/archive/) |

The Foundry broadcast logs for the deployment transactions are in [`../broadcast/Deploy.s.sol/31611/`](../broadcast/Deploy.s.sol/31611): `core-v1`, `addMarket-v1` for v1, and `core-v2-partial`, `core-v2`, `addMarket-v2-bold`, `addMarket-v2-steady` for v2.

To re-check a deployment against the chain:

```bash
python -I contracts/script/verify_deploy.py      # 43 checks
python -I contracts/script/verify_bytecode.py    # deployed bytecode against compiled source
```
