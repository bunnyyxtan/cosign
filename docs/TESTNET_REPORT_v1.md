> **Archived v1 report.** Superseded by the v2 deployment; see `TESTNET_REPORT.md` and `TESTNET_EVIDENCE.md`. Kept as a record, including its failures.

# Cosign: Mezo testnet deployment and end-to-end verification

Engineering Directive 004 report. 20 October 2026. Network: **Mezo testnet, chain ID 31611** (RPC `https://rpc.test.mezo.org`, explorer `https://explorer.test.mezo.org`).
Every number below comes from on-chain state or transaction logs. The full tables (every contract, deployment transaction, demo transaction and check, with explorer links) are in [`TESTNET_EVIDENCE.md`](TESTNET_EVIDENCE.md), generated from `contracts/deployments/*.json` and Foundry's broadcast logs.

> Unaudited prototype on testnet. No mainnet transactions, no real funds, nothing published.

## Result

The definition of success holds on live testnet. A wallet can post cover, lend MUSD, borrow against MEZO, vote with veBTC, earn and claim self-funded MEZO, and watch a real Morpho liquidation whose loss is charged to cover first. Every step has an explorer link.

- **First loss (direct Morpho liquidation):** 300.50 MUSD of bad debt, of which cover paid 300.50 and lenders 0.00 ([sync tx](https://explorer.test.mezo.org/tx/0xc884e956e06303b477add9a8c4c0b10e62d12fd707cc26b8897b26dfc83d3465)).
- **Second loss (through `CosignLiquidator`):** 60.10 MUSD, of which cover paid 60.10 and lenders 0.00, and lenders kept every bit of interest earned before the loss ([tx](https://explorer.test.mezo.org/tx/0x9e42ce86822aab81d363ab7d26ffe1120bbb85170df6a039c9034ac1ac935679)).
- **Recorded run:** 45 demo transactions and 39 recorded checks, 37 pass. The 2 failures are kept with notes: one found a real accounting flaw, now fixed and re-verified live; one was a flaw in my own check.
- **Tests:** 25 Foundry tests pass. Both fuzz tests ran 5,000 times each.

## Phase 1: funding and environment

| Wallet | Address | BTC at start | MEZO at start |
|---|---|---|---|
| Deployer / oracle owner / liquidator | `0x5C601923FE736A2dcA69D892c10720fb584dd1e4` | 0.05 | 100 |
| Co-signer | `0xCA84E8370d18bf6059FE34133f12770AD9671255` | 0 | 0 |
| Lender | `0x0D098D3C7A009973d228aea5A1EC7c8b762FEf04` | 0 | 0 |
| Borrower | `0xA93a62aaB9aAFB581d1A5340CFE51ddAA405917F` | 0 | 0 |

- **The faucet delivered less than planned.** The plan assumed about 0.07 BTC; the deployer received 0.05, a shortfall of about 0.02 BTC.
- **The demo was resized to fit.** The deployer opened a Mezo trove with 0.0465 BTC at **148.3% collateral ratio** (Mezo minimum 110%) and borrowed 2,350 MUSD. A later top-up raised it by 300 MUSD.
- **The demo oracle price was set high, on purpose.** It starts MEZO at **10 MUSD** so that 100 MEZO could collateralize the loans. It is labelled as a demo price everywhere.
- **Environment checks:**
  - Chain ID 31611 confirmed.
  - MUSD `0x118917a4…c503` and MEZO `0x7B7c…0001` (precompile) are live. MUSD BorrowerOperations, PriceFeed and Multicall3 are also live.
  - Mezo testnet veBTC `0xB63fcCd0…9231` is live (389 locks existed before ours).
- **Keys** live only in the gitignored `.env`. The dev wallet key lives in the gitignored `web/.env.development.local`. Neither has ever been committed.
- **Toolchain:** Foundry 1.8.5. Morpho Blue (unmodified, commit `9cf6d5b`, `Morpho.sol` GPL-2.0-or-later) compiles with solc 0.8.19, and our contracts with solc 0.8.24. Everything targets the **London EVM** that Mezo recommends.

## Phase 2: deployment

| Contract | Address |
|---|---|
| Morpho Blue (our instance) | [`0xb62a0458dC292c022A05EDcc304CD3300a33DbE5`](https://explorer.test.mezo.org/address/0xb62a0458dC292c022A05EDcc304CD3300a33DbE5) |
| AdminOracle (demo only) | [`0x3040b46D1E04d3248e8D5217F65cD875cb25511c`](https://explorer.test.mezo.org/address/0x3040b46D1E04d3248e8D5217F65cD875cb25511c) |
| CosignGauge | [`0x2CFd9144D4789FF20c0996e8AB3035cAC2f4825c`](https://explorer.test.mezo.org/address/0x2CFd9144D4789FF20c0996e8AB3035cAC2f4825c) |
| CosignVault, Bold (77% LLTV, 12% APR, min cover 5%) | [`0xE63760ef37aCb3582fc3E54CB4091a421BFf092b`](https://explorer.test.mezo.org/address/0xE63760ef37aCb3582fc3E54CB4091a421BFf092b) |
| CosignVault, Steady (62.5% LLTV, 8% APR, min cover 10%) | [`0xb027B495A82376dBef620DFb901DC392D75A6cdD`](https://explorer.test.mezo.org/address/0xb027B495A82376dBef620DFb901DC392D75A6cdD) |
| CosignLiquidator | [`0xF07C60aA6DE6066fCF92fA41EfAde13ff97415b1`](https://explorer.test.mezo.org/address/0xF07C60aA6DE6066fCF92fA41EfAde13ff97415b1) |
| FixedRateIrm Bold / Steady | `0x50C1fECC…2085` / `0x816dbB41…37d4` |

- **Order.** Bold was deployed first, in blocks 16260389–16260400; all 10 transactions have status-1 receipts. Steady was added only after Bold had passed the full cycle.
- **Steady receipts.** 6 of Steady's 7 deployment receipts are retrievable with status 1. The RPC still returns a null receipt for the vault-creation transaction (`0x1bf46978…`). Its bytecode (12,467 bytes) is at the expected address, and its deployer-only `setGauge` call succeeded, so it exists.
- **Wiring verified on-chain:**
  - each vault's `gauge()` is the gauge;
  - `capRate` is set per vault and `vaultCount = 2`;
  - both Morpho markets exist, with their IRMs and LLTVs enabled;
  - Morpho's owner is the deployer;
  - the oracle reads 10 MUSD per MEZO.
- **No fork deployment is reported as live.** Local fork rehearsals were deleted after each run.

## Phase 3: the real transaction flow (Bold)

| Step | What happened on-chain | Evidence |
|---|---|---|
| MUSD via Mezo | `openTrove` borrowed 2,350 MUSD against 0.0465 BTC | [0x18b26ba2…](https://explorer.test.mezo.org/tx/0x18b26ba2ef669f0d43ceeee6cc9126856b11684c6dcf3c78b05da4a8d5c53c35) |
| veBTC | Co-signer locked 0.001 BTC for 4 weeks: tokenId **390**, voting power 0.00075 | [0xe80fd089…](https://explorer.test.mezo.org/tx/0xe80fd08939c445c2b556f2224279b64bfb5b83553c3ceabfc6d2e96d86ceefd4) |
| 1. Cover | 10 MUSD of junior cover posted, then 390 more. Shares and value checked | [0xab1cd7a4…](https://explorer.test.mezo.org/tx/0xab1cd7a40bf51b704f30fd09e3b0def6eb12d0dfa4151e8167d3885d0ab606d4) |
| 3. Vote, cap binds | With 10 MUSD of cover: votes 7.53e14, cover cap 1.0e14, **effective 1.0e14** | [0xf39914f9…](https://explorer.test.mezo.org/tx/0xf39914f93cae27e0d6ebee9ea8a0e0babd496303738490dbd0c865609756d846) |
| 3. Weight follows cover | After 400 MUSD of cover: cap 4.0e15, effective 7.53e14 (the votes themselves) | [0x2239c62e…](https://explorer.test.mezo.org/tx/0x2239c62e9859202f8d3e9b3014161ba1d62dc235fdd809c14cb73208e9287b17) |
| 2. Cap enforced | Room 7,600 MUSD (= 400 × 19). `depositSenior(7,600 + 1 wei)` reverts `CapacityExceeded(7600e18)` | check #10 in evidence |
| 2. Lend | Lender deposited 1,000 MUSD. Books: senior 1,000, junior 400, coverage 28.57%. Morpho supply 1,400 | [0x6730a330…](https://explorer.test.mezo.org/tx/0x6730a330afdd5a2dc727737914defbb20e2215e9e3aaa94f28b0a83fb12d2be5) |
| 4. Rewards | 8 MEZO funded to epoch 0. The gauge held exactly 8 | [0x3cec3c1d…](https://explorer.test.mezo.org/tx/0x3cec3c1d08e1c0256850558193a75daa2862406820bcb2b85a8c352160c578f8) |
| 5. Borrow | 71.4286 MEZO posted as collateral, 500 MUSD borrowed. Morpho records 70.00% LTV (LLTV 77%) | [0xe192d8d9…](https://explorer.test.mezo.org/tx/0xe192d8d96f46b8b4c5e15ab044adb94989ee869eecb64a168972bfd16162620b) |
| 6. Crash | A borrower call to `setPrice` reverts `OwnableUnauthorizedAccount`. The owner set MEZO from 10 to 3 MUSD, putting LTV at 233% | [0x4d10d211…](https://explorer.test.mezo.org/tx/0x4d10d211329d4d2310bbbcfd480b1ddddfee39abd1593922e672f82409fde73b) |
| 6. Liquidation | A genuine Morpho `liquidate` seized all collateral and **realised 300.50 MUSD of bad debt** | [0x2493df18…](https://explorer.test.mezo.org/tx/0x2493df18ac5a416b44205bfa4d0c343225a7ac9746d984334a5452105de10b6a) |
| 7. First loss | `LossAbsorbed(loss 300.50, byJunior 300.50, bySenior 0)` | [0xc884e956…](https://explorer.test.mezo.org/tx/0xc884e956e06303b477add9a8c4c0b10e62d12fd707cc26b8897b26dfc83d3465) |

**Balances around the first loss:**

| | Before (with unbooked interest) | After |
|---|---|---|
| Junior (cover) | 400.0000132 MUSD | **99.5 MUSD** |
| Senior (lenders) | 1,000.0000153 MUSD | **1,000.0 MUSD** |
| Lender share value | 1.0000000153 | 1.0 |

`juniorLoss + seniorLoss = recognizedLoss` holds: 300.50 + 0 = 300.50.

**Lenders lost no principal. They did forgo 0.0000153 MUSD of interest.** That interest had accrued but wasn't yet booked, and the same-interval bad debt was netted against it. See the bugs section below; this is now fixed and re-verified.

**Rewards** ([distribute](https://explorer.test.mezo.org/tx/0x3abab68ae159293458b9e0cff26990958ecc0b092330593d3369817c4cb6ab9a)):
- 8 MEZO were funded and all 8 sent to Bold, leaving 0 in the gauge. A second `distribute` reverts `AlreadyDistributed`.
- The co-signer and lender claimed **7.999999999 MEZO** in total; the remaining 1e-9 is rounding dust in the vault.
- After the reward stream ended, pending was 0 and a second claim paid 0.
- Later, a 10 MEZO epoch split across **both** markets exactly by effective weight: 6.0 to Bold and 4.0 to Steady ([tx](https://explorer.test.mezo.org/tx/0x598ff367778f0d08958282610fd70e9b35d8a0d163623d24eaee0c7af2c1e75d)).
- These are **self-funded rewards**, not Mezo emissions.

**Second loss, through `CosignLiquidator`:**
- A 100 MUSD loan accrued interest for 3 minutes before the crash.
- One transaction ran sync, then Morpho liquidation, then sync.
- `InterestAccrued` (senior +0.0000552867 MUSD) was emitted **before** `LossAbsorbed(60.10, junior 60.10, senior 0)`.
- The senior book went from 1,000.0 to 1,000.0000552867: lenders kept all their interest.
- Coverage then fell to **3.79% (< 5% minimum)**. Room to lend became 0, and a lender deposit reverted `CapacityExceeded(0)`.
- A co-signer then **recapitalised from the browser** with 60 MUSD, bringing coverage back to 9.9%.

## Phase 4: security and edge cases

Commands, run from `contracts/` with Foundry 1.8.5:

```
forge test                      # 25 passed, 0 failed
forge test --fuzz-runs 5000     # 25 passed; both fuzz tests 5,000 runs each
```

Full output: [`test-results.txt`](test-results.txt). The suite runs against a **real Morpho Blue** instance.

| Directive item | Test(s) | Live testnet evidence |
|---|---|---|
| 1. Wipeout then recap, no revival | `test_LossBeyondJunior_SplitsAndWipes_ThenRecapitalises`, `test_WipedRound_DoesNotReviveOnRecap`, `test_RewardsEarnedBeforeWipeStayClaimable` | (not wiped live: kept MUSD for the rest of the run) |
| 2. Coverage below minimum after a real loss | `test_Undercovered_AfterRealLoss_ThenRecovers` | Bold at 3.79%, deposits rejected, then recapitalised via UI |
| 3. Cooldown and withdrawal restrictions | `test_JuniorWithdraw_CooldownWindowCoverage`, `test_JuniorFullExitBlockedWhileVoting` | Request recorded with 10-minute notice; early withdraw reverts `NotReady`; no request reverts `NoRequest` |
| 4. Insufficient Morpho liquidity | `test_SeniorWithdraw_LimitedByMorphoLiquidity` (reverts `insufficient liquidity`; a partial exit within liquidity works) | n/a |
| 5. Interest, rounding, withdrawal, bad debt | `test_InterestSplit_JuniorEarnsPremium`, `testFuzz_LossWaterfall` (conservation, senior untouched while covered), `testFuzz_RoundTripNoFreeValue` (≤ 2 wei rounding, never a profit) | Both losses conserve exactly |
| 6. Vote weight after cover withdrawal or loss | `test_WeightFollowsCoverWithdrawal`, `test_Gauge_NoWeightAfterWipe_CleanRemovesStaleVotes` | Cap bound at 10 MUSD of cover, lifted at 400; weight = min(votes, live cap) after the loss |
| 7. Unauthorized oracle, withdrawals, voting, claims | `test_Unauthorized_AdminAndOwnerPaths`, `test_CannotTouchOtherAccounts`, `test_Gauge_NoCoverNoVote_WeightCapped_OneVotePerEpoch` | Non-owner `setPrice` reverts `OwnableUnauthorizedAccount` |
| 8. Reentrancy and share inflation | `test_Reentrancy_GuardBlocksTokenCallback` (a malicious token re-enters and gets `ReentrancyGuardReentrantCall`), `test_InflationAttackUnprofitable` | n/a |
| 9. No double claim or over-distribution | `test_TwoVaults_SplitByWeight_NoOverDistribution_NoDoubleClaim`, `test_Gauge_DistributeAndClaim` | `AlreadyDistributed`; claims + remainder = distributed; second claim pays 0 |
| 10. Multi-user isolation | `test_MultiUser_IsolationAndProRataLoss` (3:1 pro-rata cover loss; one exit doesn't move another account's value) | Four separate wallets throughout |

**Compiler and lint warnings: every one was investigated, not dismissed.**
- **Fixed:**
  - `missing-zero-check`: `setGauge` now rejects the zero address.
  - `arbitrary-send-erc20` in the liquidator callback: it was already safe, because Morpho only calls back the contract that initiated the liquidation. It's now also pinned to an in-progress `_payer` that only `liquidate` sets.
- **Kept, with reasons:**
  - `reentrancy-*`: every state-changing function is `nonReentrant`. External calls go only to Morpho (with empty callback data) and MUSD/MEZO, and a reentrancy test proves the guard.
  - `calls-loop`: at most 8 owner-registered vaults.
  - `block-timestamp`: minute-scale cooldowns and streams.
  - `unused-return`: deliberate. The vault measures what it was credited from its Morpho position instead of trusting return values.
  - `require-revert-in-loop`: input validation is meant to be atomic.
  - `uninitialized-local`: zero accumulators.
  - `missing-events-access-control`: `voterOf` changes are covered by `Voted` and `VotesReset`.

**The vault deposit cap is not a borrowing cap.** It limits how much MUSD enters *through this Cosign vault*. Anyone can supply to the same Morpho market directly, without cover, and those suppliers share any bad debt pro rata. This is stated in the contract NatSpec and on the market detail page.

## Bugs found and fixes applied

| # | Found where | Problem | Fix |
|---|---|---|---|
| 1 | **Live testnet**, first loss | The vault sees only the net change of its Morpho position between syncs, so lenders' accrued but unbooked interest was netted against a same-interval bad-debt loss (0.0000153 MUSD here). Lenders' interest absorbed loss before cover's principal | New `CosignLiquidator` (sync, liquidate, sync). Verified live on the second loss. Liquidations sent to Morpho directly still net; this is pinned by `test_DirectLiquidation_NetsUnsyncedSeniorInterest` and listed as a risk below |
| 2 | Live, frontend | A successful withdrawal showed "receipt could not be found": viem gave up while Mezo's load-balanced RPC lagged | Patient receipt polling (up to 3 minutes) |
| 3 | Live, frontend | Balances read back as stale for 5–20 s after a transaction (RPC lag) | Wait until the RPC reaches the receipt block, refresh, then refresh again. Loading states replace misleading zeros |
| 4 | Frontend | The "last loss" line on market rows never showed: an address case mismatch | Case-insensitive match |
| 5 | Tooling | `cast send` can't parse receipts for Mezo precompile transactions (`blockTimestamp 0x0`), so it reported failures for transactions that succeeded | The demo script sends async and polls raw `eth_getTransactionReceipt`. Sends never auto-retry, so nothing can double-send |
| 6 | Tests | Two fuzz-bound and two check-timing mistakes in my own tests/scripts | Corrected. The failing checks are kept in the evidence, with notes |
| 7 | Lint | `setGauge(0)` accepted | Rejected |

## Remaining risks (honest list)

1. **Unaudited.** The code is new, and a full independent review is still needed.
2. **Direct Morpho liquidations bypass `CosignLiquidator`.** Lenders can then forgo up to their interest since the last sync. Mitigations: a keeper that calls `sync()` often, or a liquidation hook in a future market design.
3. **Lenders can exit before a loss is realised.** After a price crash but before liquidation, lenders can withdraw at full value (subject to Morpho liquidity), leaving more loss on cover and on the remaining lenders. This is inherent to Morpho-style lazy bad-debt realisation.
4. **Demo oracle.** One owner key sets the price, by design, for the demo. It must be replaced by a TWAP or a Mezo-supported oracle.
5. **Self-funded rewards.** Real Mezo emissions need Mezo governance to attach a gauge.
6. **Weights read at distribution time.** The gauge reads weights live when `distribute` runs, not from end-of-epoch checkpoints. veBTC power is snapshotted at vote time and decays until the next re-vote.
7. **Rewards to empty tranches.** Rewards streamed to a tranche with 0 shares, for example right after a wipe, stay in the vault.
8. **Admin power.** We own our Morpho instance (we can enable IRMs and LLTVs) and the gauge (we can add vaults).
9. **veBTC power is reused.** The same veBTC power can also vote in Mezo's own gauges. We only read it.

## Phase 5: frontend

**Run it:** `cd web && npm run dev`, then open http://localhost:5174. It reads `contracts/deployments/31611.json` directly.

Every transaction below was made **through the UI** against the deployed contracts, using the dev-only test wallet:

| Role | Action from the browser | Result |
|---|---|---|
| Co-signer | Post 60 MUSD cover on under-covered Bold (approve + deposit) | Bold went from 3.8% to 9.0% cover, and room to lend reopened (889 MUSD) |
| Co-signer | Post 150 MUSD cover on Steady | Room 1,350 MUSD |
| Co-signer | Vote veBTC #390 60/40 across both markets | Weights 0.000451 / 0.000301; the UI then blocks a second vote that epoch |
| Lender | Deposit 500 MUSD on Steady | "You have 500 here", room 850 |
| Lender | Withdraw 100 MUSD from Bold | Wallet +100. This exposed bug #2, now fixed |
| Lender | Claim MEZO from Bold | Pending 1.848 → 0.077 (new streaming) |
| Borrower | Add 20 MEZO collateral, borrow 100, repay 50 (Steady) | Morpho shows 50 MUSD debt at 25% LTV |
| Anyone | Replay the 300.50 MUSD loss | The cover block shrinks with a crimson loss segment, and the lender bar stays still. Numbers come from the on-chain `LossAbsorbed` event, not our JSON |

**Data sources:**
- Figures are read from contract state via Multicall3: tranche books, coverage, room to lend, share values, utilisation, the IRM rate and gauge weights.
- APRs are labelled as simple rates: borrow APR × utilisation, with the junior premium applied.
- The MEZO price is labelled as coming from the demo oracle.

**Screenshots** (in `docs/screenshots/`, light and dark): `markets-*.png`, `cosign-*.png`, `market-bold-*.png`, `market-bold-mobile.png`. At 390px wide there is 0px of horizontal overflow.

**Known gaps:**
- Untested with a real browser wallet extension: MetaMask approval prompts and the chain-switch / add-chain path. The pane has no extension, so all browser testing used the dev wallet, which reports chain 31611 directly.
- Cover withdrawal in the UI is all-or-nothing. Partial withdrawals work on-chain and in the script.
- Vote sliders start at 0%, not at the current allocation.
- No liquidation button in the UI. Liquidations are run by script.

The dev-only wallet (`web/src/devWallet.ts`) installs only under `vite dev` with the gitignored key file, and never over a real wallet. A production build was checked and contains neither the code nor any key fragment.

## Files and commits

Added or changed:
- `contracts/src/{CosignVault,CosignGauge,CosignLiquidator,FixedRateIrm,AdminOracle,MorphoImport}.sol`
- `contracts/test/{Cosign,CosignEdge}.t.sol`
- `contracts/script/{Deploy.s.sol,demo.py}`
- `contracts/deployments/{31611,demo-run}.json`, plus broadcast logs
- `web/src/*`, `web/scripts/*`
- `docs/*`

All commits are authored `Bunnyy <129172221+bunnyyxtan@users.noreply.github.com>`, follow Conventional Commits, and have no attribution trailers. History is linear and local only: nothing pushed or published.

## Reproduce

```
cd contracts
forge test --fuzz-runs 5000
python -I script/demo.py fund        # then: bold, rewards/claims, restore, liqproof, restore, ...
```

Deployment: `forge script script/Deploy.s.sol --sig "core()" --broadcast`, then `--sig "addMarket(string)" steady`. Keys come from `.env`; see `contracts/script/demo.py` for the stage list.
