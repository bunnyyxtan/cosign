# Replacing the demo oracle with Pyth: findings and migration plan

Status, 24 October 2026: **study only.** Nothing was deployed, no price was changed, no liquidity moved and no transaction
was signed. The contract and tests below exist in the repository; the live app still runs on `AdminOracle`.

## 1. The feeds, read live on Mezo testnet

Two Pyth contracts are on Mezo testnet. Only one of them carries MEZO.

| Contract | Version | MEZO/USD `0x80be…26df` | MUSD/USD `0x0617…c6de` |
| --- | --- | --- | --- |
| `0x2880aB155794e7179c9eE2e38200202908C17B43` (the address in Mezo's docs, "Pyth Core") | 1.4.6 | **does not exist** (`PriceFeedNotFound`) | last updated 89 days ago; `getPrice` reverts `StalePrice` |
| `0x933aDeC2C7624b11E4B2b80ACE15BF9a71a31315` ("Pyth Core Compatible" in Pyth's contract list) | 1.4.5-alpha.1 | **live**: 0.003328 USD, conf ±0.000038 (1.1%) | **live**: 0.98944 USD, conf ±0.08% |

Both contracts use a 60 s valid-time period. On the Compatible contract the update fee is 0.

Updates on the Compatible contract were measured over the last 7.5 days (440 MEZO updates). A sponsored pusher,
`0x2585…2dfd`, publishes when the price moves past its deviation trigger, with a 1-hour heartbeat:

- **Update gaps:** median 251 s, p90 3,602 s, longest 3,668 s.
- **Price age:** older than 300 s 88% of the time, older than 1,800 s 46%, older than 3,600 s 0.1%.
- **MEZO price swings:** largest move between consecutive updates 23%; largest within one hour 69%; range for the week 0.00264–0.00484 USD.
- **MEZO confidence interval:** median 0.83%, p99 4.3%, worst 8.3%.
- **MUSD:** confidence interval at most 1.6%; price 0.9887–0.9941 USD all week.

On 26 August 2026 Pyth's Hermes started requiring an API key. Without one, every price-update request returns 401
(tested, including BTC/USD). Running Cosign's own pusher therefore needs a key from Pyth Terminal; there is a free trial,
and paid plans after that.

## 2. Pyth's Morpho wrapper

`pyth-network/pyth-morpho-wrapper` (`MorphoPythOracle`, deployed through a factory) computes
`SCALE_FACTOR × base feeds / quote feeds` with one `getPriceNoOlderThan` age limit. Its limitations:

- It accepts a price of **zero**: the check is `price >= 0`.
- It has **no confidence check**.
- It fixes each feed's exponent **at deploy time**.

The wrapper also needs a pusher. Pyth's guide says to rely on sponsored feeds or to run the price pusher.

## 3. The oracle Cosign would use: `contracts/src/CosignPythOracle.sol`

`price = 1e36 × (MEZO/USD) / (MUSD/USD)`. This is Morpho's scale: both tokens have 18 decimals, and 1e36 means
1 MUSD per MEZO. Today that is 3.3635e33, i.e. 0.0033635 MUSD per MEZO.

It reverts in each of these cases instead of returning a price:

- `InvalidPrice`: a price of zero or below, an exponent outside [-18, 0], a feed never published (all fields zero), or a result that rounds to 0.
- `StalePrice`: either feed older than `maxAge`, or published further than `maxAge` in the future. This matches the two-sided test in Pyth's `getPriceNoOlderThan`.
- `WideConfidence`: a confidence interval wider than `maxConfBps` of the price.

Two parameters set the limits. Both are immutable and set at deploy time:

- **`maxAge` = 3,700 s:** the 1-hour heartbeat plus 100 s. Pyth's own 60 s period would reject the MEZO price about 97% of the time.
- **`maxConfBps` = 500 (5%):** this rejects under 1% of this week's MEZO updates.

While the price is refused, Morpho refuses three actions that read the oracle: borrowing, withdrawing collateral and
liquidation. Repaying and adding collateral never read it.

### Tests

- **`test/CosignPythOracle.t.sol`** (11 tests, using a mock Pyth):
  - scale and exponents
  - stale on both sides and on either feed
  - feed never published, price ≤ 0, bad exponents, price that rounds to zero
  - the 5% confidence boundary and the constructor's limits
  - fuzzing that it never overflows
  - against a local Morpho market with a Cosign vault:
    - borrowing, partial repayment, then a freeze once the price is stale while repayment keeps working
    - a 35% fall, after which liquidation through `CosignLiquidator` is paid entirely by cover
    - a 45% fall at 74% LTV, which **uses up Bold's 5% cover and reaches lenders**: cover is charged first and the waterfall is exact
    - repaying in full, then withdrawing collateral
- **`test/CosignPythFork.t.sol`** (run with `PYTH_FORK=1`; skipped in CI) runs against a fork of Mezo testnet. It uses the
  real Compatible contract, the real Morpho Blue, the real MUSD and Bold's real IRM; a scratch ERC20 stands in for the
  MEZO precompile. Results on 24 October:
  - **Price:** feeds 904 s old; price 3.3635e33.
  - **Docs address:** confirmed to have no MEZO feed.
  - **Borrowing:** 100,000 MEZO is worth 336.35 MUSD, with a borrow limit of 258.99; borrowing above 77% reverts; a partial repayment works.
  - **Stale feed:** once the real feed passes the age limit, borrowing and liquidation revert `StalePrice` and repayment still works.
  - **Simulated 35% fall:** 19.23 MUSD of bad debt, all paid by cover, with lenders' booked principal unchanged.

Every contract test passes (51), and the fork test passes too (2).

## 4. Must Bold and Steady be replaced? Yes.

A Morpho market's ID is the hash of its parameters, including the oracle, and a `CosignVault` stores its `oracle` and
`marketId` as `immutable`. No oracle switch is possible for the existing markets. The other pieces carry over:

- **`CosignGauge`:** stays. The owner registers the new vaults with `addVault`. It cannot remove the old vaults, so votes still placed on them keep their capped share of rewards.
- **`CosignLiquidator`:** stays; it works with any vault.
- **Morpho Blue:** stays. LLTV 0.77 and 0.625 and both IRMs are already enabled, so `createMarket` needs no owner action.

The old markets don't need to be closed. They keep working on `AdminOracle`, and the recorded evidence stays valid
because it consists of transactions and `LossAbsorbed` events on the old Bold vault. The app must keep reading those
addresses for the replay and the loss table.

### Positions on the old markets

| Market | Position | Holder | Notes |
| --- | --- | --- | --- |
| Bold | lending 1,000.00 | demo `LENDER` (team key) | must leave first, because Bold's cover can only shrink to 1,000 / 19 = 52.63 while it stays |
| Bold | cover 39.40 | demo `COSIGNER` (team key) | |
| Bold | cover 15.00 | founder | #402's vote for Bold must be reset before a full exit (`VotesActive`) |
| Steady | lending 10.00, cover 5.00 | founder | |

Nothing is borrowed on either market, so all lending can be withdrawn at once.

## 5. Feasibility and blockers

| Item | Severity | Detail |
| --- | --- | --- |
| The documented Pyth address has no MEZO feed | blocker if you follow Mezo's docs | Use the Compatible contract `0x933a…1315` instead. It is version `1.4.5-alpha.1`. |
| The price only moves when the sponsored pusher runs | high | The feed has no service guarantee on testnet, and the relayer on the documented contract stopped 89 days ago. If the pusher stops, borrowing and liquidation freeze after 62 minutes. Running our own pusher needs a Hermes API key and a funded keeper; the fee is 0. |
| Prices can be up to an hour old | high | MEZO has moved up to 69% within an hour. Liquidations act on prices up to an hour old, so with Bold's 5% cover a 45% fall at 74% LTV reaches lenders (tested). Consider lower LLTVs or thicker cover for Pyth markets. A pusher with a tighter heartbeat needs the API key. |
| Real MEZO is worth about $0.0033 | **blocker for demos** | The deployer (86.3 MEZO) and the founder (98.2 MEZO) hold about $0.62 together, enough to borrow about 0.47 MUSD. A 250 MUSD loan needs about 100,000 MEZO, and I found no source for that much testnet MEZO. |
| No controllable price crash | medium | The first-loss demo can no longer be staged on the new markets. The recorded replay on the old Bold remains the evidence. |
| Acceptance evidence | medium | Every wallet PASS row names the old vaults. Journeys B, C, D and E would need to be run again on the new markets. |
| App changes | medium | The `bold`/`steady` slugs would point at new vaults, the old vaults would need to stay as evidence, the oracle text ("team-controlled demo oracle") would need rewriting, and the app would need to show a price as stale and explain the freeze. |

## 6. Recommendation and exact migration plan

**Wave 1: keep `AdminOracle`.** Say plainly in the app and the submission that a Pyth oracle is built and tested on a
fork, and that it is planned for Wave 2. **Wave 2: migrate, if the demo-MEZO and pusher questions have answers.**

Each step below needs its own approval. Every transaction is signed by its owner, one at a time.

0. **Decide.**
   - LLTVs for the Pyth markets: keep 77% / 62.5%, or lower them (a new LLTV needs a Morpho owner transaction).
   - `maxAge`.
   - Whether to run our own pusher (needs a Pyth Terminal API key, which the founder signs up for).
   - Where enough testnet MEZO comes from.
1. **Preflight, read only.**
   - Recheck both feeds on `0x933a…1315`: they exist, their age is under `maxAge`, the confidence interval is under 5%, and the computed price is in range.
   - Rerun the fork test at the latest block.
2. **Deploy (deployer key):**
   - two `CosignPythOracle` contracts (same feeds and limits; one each, so each market's ID is unique and readable)
   - `createMarket` for each
   - two `CosignVault` contracts with Bold and Steady's parameters
   - `setGauge` on each
   - `gauge.addVault(vault, 1e13)` for each
   - Verify the bytecode and the reads, as `script/verify_deploy.py` does today.
3. **Seed (one transaction at a time):** post cover first, then lending, on each new vault, with exact approvals.
4. **App:**
   - Add the new vaults to `31611.json`.
   - Keep the old addresses as `legacy` for the evidence page, the replay and the loss table.
   - Show oracle age and freeze status.
   - Rewrite the oracle text.
   - Ship behind the existing checks.
5. **Wind down the old positions (optional; the old markets can stay open):**
   - Bold: the demo `LENDER` withdraws its 1,000 lending, then the demo `COSIGNER` requests its 39.40 of cover (10-minute notice), then withdraws.
   - The founder resets #402's vote and moves their own Bold cover the same way.
   - Steady: the founder withdraws the 10 MUSD of lending, then requests the 5 MUSD of cover, then withdraws.
   - Claim pending rewards before leaving.
6. **Acceptance:** run journeys B, C, D and E again on the new markets with Rabby, then a real borrow, a repayment and (when prices allow) a liquidation.

## Sources

- [Mezo oracle documentation](https://mintlify.wiki/mezo-org/documentation/developers/architecture/oracles)
- [Pyth contract addresses](https://docs.pyth.network/pro/contract-addresses)
- [Pyth Core upgrade (API key requirement)](https://docs.pyth.network/price-feeds/core/upgrade/preparing)
- [Use Pyth for Morpho markets](https://docs.pyth.network/price-feeds/core/use-pyth-for-morpho)
- [pyth-morpho-wrapper](https://github.com/pyth-network/pyth-morpho-wrapper)
