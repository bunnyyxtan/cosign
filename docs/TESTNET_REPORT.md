# Cosign v2: testnet status report

20 October 2026. Mezo testnet, chain 31611. Unaudited prototype; no mainnet transactions, no real funds. Every figure comes from chain state or transaction logs; the full tables are in [`TESTNET_EVIDENCE.md`](TESTNET_EVIDENCE.md), generated from the recorded run. The archived v1 report is [`archive/TESTNET_REPORT_v1.md`](archive/TESTNET_REPORT_v1.md).

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
| Foundry | 40 pass, 0 fail, 2,000 fuzz runs (at this report; 51 pass now, with the experimental, undeployed Pyth oracle) |
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
| Real-wallet acceptance on testnet (Rabby) | **PARTIAL** (since 23 October) | A person has signed the connect and reload flows, cover and lender deposits, the full borrow lifecycle, senior withdrawals and a partial cover withdrawal in Rabby, each verified onchain: see [`WALLET_ACCEPTANCE.md`](WALLET_ACCEPTANCE.md) for every row, hash and the rows still open (voting and rewards, a second wallet, a first-time tester). OKX Wallet has not been run |
| Independent audit | **NOT DONE** | Required before any mainnet use |
| Production oracle | **BLOCKED for mainnet** | Single-owner demo oracle |
| Direct-liquidation interest netting | Known limit | Bounded by interest since last sync; fixed only for the liquidator path |
| Exit before realisation shifts loss onto stayers | Known limit | Needs loss settlement at liquidation time |
| Borrowing not capped by cover | Known limit | The 19× rule caps vault deposits only |
| Morpho GPL libraries and Cosign's MIT licence | Open | See `NOTICE.md`; needs legal review |

Nothing here is a blocker for external evaluation on testnet. Items marked BLOCKED or NOT DONE are blockers for any launch with real funds.
