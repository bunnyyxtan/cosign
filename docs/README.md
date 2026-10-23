# Documentation

Cosign is an unaudited prototype on Mezo testnet. Start with the [project README](../README.md); this page lists everything else and what each document is for.

## Understand the product

| Document | What it covers |
|---|---|
| [PRODUCT.md](PRODUCT.md) | The idea, why first-loss cover differs from a plain pool, roles, money flow with a worked example, relation to Morpho Blue, rewards, contracts and parameters, limits |
| [architecture.svg](architecture.svg) | Diagram of participants, Cosign contracts and Morpho Blue |

## Deployment and evidence

| Document | What it covers |
|---|---|
| [`contracts/deployments/`](../contracts/deployments/README.md) | Addresses and recorded runs; what each file is |
| [TESTNET_EVIDENCE.md](TESTNET_EVIDENCE.md) | The recorded v2 run: 35 transactions, 58 checks, with links |
| [TESTNET_REPORT.md](TESTNET_REPORT.md) | Test results, findings, open items, security notes |
| [test-results.txt](test-results.txt) | Output of the latest Foundry run (40 tests) |
| [LOSS_SCANNER_TEST.md](LOSS_SCANNER_TEST.md) | Stress test of the app's loss-event scanner against RPC limits |

## Real-wallet acceptance

| Document | What it covers |
|---|---|
| [WALLET_ACCEPTANCE.md](WALLET_ACCEPTANCE.md) | The checklist and the log of every real-browser-wallet session (Rabby). PASS, PARTIAL and NOT RUN are kept strictly apart; simulations are labelled and never counted |
| [`contracts/script/acceptance`](../contracts/script/acceptance/README.md) | The read-only checkers used during those sessions |

## Build, run, host

| Document | What it covers |
|---|---|
| [DEVELOPMENT.md](DEVELOPMENT.md) | Requirements, commands, layout, verification scripts, keys, Git rules |
| [HOSTING.md](HOSTING.md) | Static hosting, headers, what has and has not been checked. No live URL exists yet |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Design tokens, type, motion and components |
| [ASSET_REVIEW.md](ASSET_REVIEW.md) | How the supplied artwork was reviewed and placed |
| [screenshots/](screenshots/README.md) | The images used in the README and how they were captured |

## Policy

| Document | What it covers |
|---|---|
| [SECURITY.md](../SECURITY.md) | How to report a vulnerability; known limitations |
| [NOTICE.md](../NOTICE.md) | Third-party licences, including the open Morpho GPL question |
| [LICENSE](../LICENSE) | MIT, for Cosign's own source |

## Archive

Superseded records, kept because they are evidence of earlier work, not current claims:

| Document | What it is |
|---|---|
| [archive/TESTNET_REPORT_v1.md](archive/TESTNET_REPORT_v1.md) | Report for the first (v1) deployment |
| [archive/TESTNET_EVIDENCE_v1.md](archive/TESTNET_EVIDENCE_v1.md) | Evidence for the v1 run (45 transactions, 39 checks) |

The v1 addresses and run data are in `contracts/deployments/` (`31611-v1.json`, `demo-run-v1.json`, `migration-v1.json`).
