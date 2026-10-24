# Cosign v2: historical testnet status report

**Historical snapshot: 20 October 2026.** Mezo testnet, chain 31611. The results below describe that recorded v2 run and have not been rewritten as a newer test execution. Cosign is an unaudited prototype; there were no mainnet transactions or real funds. Every figure comes from chain state or transaction logs; the full tables are in [`TESTNET_EVIDENCE.md`](TESTNET_EVIDENCE.md), generated from the recorded run. The archived v1 report is [`archive/TESTNET_REPORT_v1.md`](archive/TESTNET_REPORT_v1.md).

For current status, use the [project README](../README.md); for the latest contract result, use [`test-results.txt`](test-results.txt); for real-wallet evidence, use [`WALLET_ACCEPTANCE.md`](WALLET_ACCEPTANCE.md); and for current addresses, use [`contracts/deployments/31611.json`](../contracts/deployments/31611.json).

## What changed from v1

| Issue found | Fix | Verified |
|---|---|---|
| Interest accrued since the last sync could be netted against a loss | `CosignLiquidator` (sync, liquidate, sync) | Live: interest booked before the loss, tx `0x9e3b672c…` |
| Premium accrued to a wiped, empty cover round | `_books()` sends all interest to senior when there are no junior shares | Foundry test |
| Stale veBTC votes kept full weight after power decayed | `CosignGauge.poke(tokenId)`, down-only, callable by anyone | Live poke: 747260802206100 → 746696758996422 |
| 1 wei of senior dust with no shares blocked the last co-signer's exit | Dust-aware coverage check | Foundry stdstore reproduction and fuzz test |

## Live v2 result

- Cover posted (400 MUSD), votes capped by cover, lender deposit capped by `19 × cover` (a deposit of capacity + 1 reverts).
- Self-funded MEZO: 8 funded, 8 distributed, 8 claimed, 0 left in the vault; a second distribution and a second claim pay nothing.
- First loss, direct Morpho liquidation: 300.5 MUSD recognised, all from cover (400 → 99.5). Lenders' last-synced principal untouched; **0.000004 MUSD of unbooked interest was forgone**.
- Second loss, through `CosignLiquidator`: 60.1 MUSD, all from cover; senior credited its interest first; vault became under-covered and blocked new deposits.
- The app displays these transactions from the recorded run.

Checks: 52 pass, 6 fail as recorded. The failures are kept in the evidence with causes: all six were flaws in the test script, not the contracts (a non-idempotent rerun after an RPC null receipt, a check that compared against an interest-inclusive preview, thresholds that ignored streaming rewards). The live `poke` stage also did not record its last check, which is covered by Foundry tests instead.

## Tests and tooling

| Item | Result |
|---|---|
| Foundry | 40 pass, 0 fail, 2,000 fuzz runs in the 20 October report. See [`test-results.txt`](test-results.txt) for the latest, separately recorded result. |
| Frontend `tsc` and production build | Pass |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Deployment verification against chain | 43/43 |
| Deployed bytecode against compiled source | 8/8 |
| Secret scan, working tree and full git history | No wallet key, token or key block found; `.env` never committed (re-run 23 October over every reachable commit) |
| Production bundle | No dev-wallet code, no key material |

## Release-readiness

| Item | Status | Note |
|---|---|---|
| Contracts deployed and wired on testnet | PASS | 43/43 |
| First-loss waterfall on a real liquidation | PASS | Measured twice |
| Self-funded rewards reconcile | PASS | Exact to the wei at end of stream |
| UI claims no stronger guarantee than the contracts | PASS | Guarantee panel states the limits |
| Real-wallet acceptance on testnet (Rabby) | **PARTIAL** (subsequent evidence, not part of the 20 October run) | See [`WALLET_ACCEPTANCE.md`](WALLET_ACCEPTANCE.md) for the current PASS, PARTIAL and NOT RUN counts and every supported transaction hash. That living log supersedes older summaries of which rows remained open; OKX Wallet has not been run. |
| Independent audit | **NOT DONE** | Required before any mainnet use |
| Production oracle | **BLOCKED for mainnet** | Single-owner demo oracle |
| Direct-liquidation interest netting | Known limit | Bounded by interest since last sync; fixed only for the liquidator path |
| Exit before realisation shifts loss onto stayers | Known limit | Needs loss settlement at liquidation time |
| Borrowing not capped by cover | Known limit | The 19× rule caps vault deposits only |
| Morpho GPL libraries and Cosign's MIT licence | Open | See `NOTICE.md`; needs legal review |

This historical report supports external evaluation of the recorded testnet work. Items marked BLOCKED or NOT DONE are blockers for any launch with real funds; the current project status and limitations are maintained in the [README](../README.md).
