# Cosign: product and architecture

Cosign is an unaudited prototype on Mezo testnet. This document explains what it does and why; the contracts and their tests are the final authority where the two differ. Parameters below are read from the deployed v2 contracts (23 October 2026).

## The idea in one paragraph

A lending market asks lenders to trust a risk they cannot see: if a loan goes bad, who pays first, and how much of their own money have the people who vouched for the market put at stake? Cosign makes the answer visible and enforceable. A veBTC holder (a **co-signer**) posts MUSD as **cover** in front of a market's lenders and votes for it. A loss is charged to cover first; lenders lose money only once the cover is gone. The cover also sets the credit limit: the market can only take deposits up to a multiple of it. **Vote = bond = credit limit.**

Cosign does not replace a lending protocol. It sits in front of one market on [Morpho Blue](https://github.com/morpho-org/morpho-blue), unmodified.

## Why first-loss cover is different from a vote or a badge

| | A rating, badge or allowlist | Cosign cover |
|---|---|---|
| Who pays if the loan goes bad | Nobody who endorsed it | The co-signer, first, with posted MUSD |
| What limits the market's size | A parameter someone sets | The cover itself: lenders are accepted only up to `maxLeverage × cover` |
| What a vote is worth | Free | Counts only up to what the voter's cover backs |
| Can the endorser leave when trouble starts | Yes | Only after a notice period, and never below the market's minimum cover |

Cover is first-loss capital, not insurance. It protects lenders only up to its size, and the contracts say so.

## Who does what

| Role | What they do | What they earn | What they risk |
|---|---|---|---|
| **Co-signer** (veBTC holder) | Posts MUSD cover (junior tranche), votes MEZO rewards toward the market | A premium out of the senior tranche's interest, their own interest, and 30% of the market's MEZO rewards | The cover, first |
| **Senior lender** | Deposits MUSD behind the cover | The market's interest after the junior premium, and 70% of the market's MEZO rewards | Only the part of a loss larger than the cover |
| **Borrower** | Posts MEZO collateral and borrows MUSD from the Morpho market | Access to MUSD at a fixed rate | Liquidation above the market's loan-to-value limit |
| **Anyone** | Funds a rewards epoch, distributes it once it ends, syncs a vault, pokes stale votes | Nothing | Nothing |

## How the money flows

```
 Borrowers ──(MEZO collateral)──► Morpho Blue market (MUSD loans)
                                        ▲  supplies all of the vault's MUSD
                                 ┌──────┴──────┐
                                 │ CosignVault │
                                 ├─────────────┤
          Lenders (senior) ───►  │ ███████████ │  paid second, lose last
          Co-signers (junior) ─► │ ▓▓▓         │  paid first, lose FIRST
                                 └─────────────┘
   Rule: senior ≤ maxLeverage × junior   (19× on Bold, 9× on Steady)
   veBTC votes, capped by junior cover  →  MEZO rewards  →  this vault
```

- **One vault per market.** The vault is the supplier into its Morpho market. It keeps two share classes: senior (lenders) and junior (cover).
- **Interest.** Each tranche earns on its own capital, and the junior tranche also takes a premium out of the senior tranche's interest (25% on Bold, 20% on Steady). Both tranches hold claims on the same Morpho position; nothing is "sent" until a withdrawal.
- **Losses.** Before every action the vault re-reads its Morpho position (`_sync`). If the value fell, the loss is charged to junior up to its balance and only then to senior, and a `LossAbsorbed(loss, byJunior, bySenior, …)` event is emitted. `byJunior + bySenior == loss`, always.
- **Deposits.** Senior deposits are accepted only while `seniorAssets ≤ maxLeverage × juniorAssets`. Cover deposits are always accepted, including to recapitalise.
- **Exits.** Lenders can leave whenever the Morpho market has unborrowed MUSD. A co-signer requests a withdrawal, waits the notice period (10 minutes on testnet), then has a 24-hour window to withdraw. The withdrawal is refused if it would leave the market below its minimum cover, and a co-signer cannot withdraw all their cover while a vote of theirs is active. Partial requests are supported.
- **Share accounting** uses virtual offsets against inflation attacks, and rounding favours the vault.

### Illustrative numbers

Not market data. A Bold-style vault with 1,000 MUSD of lenders and 52.6 MUSD of cover (5%), fully borrowed at the fixed 12% APR:

| | Lenders | Co-signers |
|---|---|---|
| Yearly interest on 1,052.6 MUSD at 12% (126.3) | 9.0% APR after the 25% premium | 69% APR before MEZO rewards |
| Bad debt of 10.5 MUSD (1%) | no loss | cover falls from 52.6 to 42.1 (−20%) |
| Bad debt of 52.6 MUSD (5%) | no loss | cover wiped out |
| Bad debt of 80 MUSD | about 2.7% of lenders' principal (27.4 of 1,000) | cover wiped out |

## The relationship with Morpho Blue

- We deploy our **own instance** of Morpho Blue, vendored unmodified (commit `9cf6d5b`), and create the MUSD/MEZO markets on it. Morpho handles supply, borrowing, collateral, liquidation and bad-debt realisation.
- A liquidation that leaves bad debt reduces the market's total supply; the vault sees the drop at its next sync and allocates it to cover first.
- **Direct liquidations can net a little unbooked interest against the loss.** `CosignLiquidator` removes that: it syncs, liquidates, then syncs again. On the live run the difference was 0.000004 MUSD.
- Anyone can also supply to the Morpho market directly, outside Cosign. They share bad debt pro rata with no cover in front of them. The demo market has only the vault as supplier.
- Whoever owns our Morpho instance can enable interest models and loan-to-value limits and set a fee on interest (0 today). That is disclosed; it cannot move anyone's principal.

## veBTC votes and self-funded MEZO rewards

**Why it matters.** Lending markets compete for lenders and co-signers, and rewards should flow to markets someone has actually put money behind. Voting without a stake would only attract mercenary votes.

- **Voting power** comes from Mezo's veBTC (BTC locked for a period). A position can vote once per epoch and its votes persist.
- **Weight is capped by cover.** A market's effective weight is `min(votes, live cover × capRate)`; `capRate` is 1 veBTC of power per 100,000 MUSD of cover. You can vote only for a market where you hold cover; no cover means no weight.
- **Rewards are self-funded.** Anyone adds MEZO to the current epoch with `fund`. Once the epoch is over, anyone calls `distribute`: the budget is split across markets by weight (unspent budget rolls forward) and each vault streams its share over 10 minutes. Cover holders receive 30%, lenders 70%, pro rata to shares, and claim with `claimRewards`.
- **Staleness.** `poke` lets anyone scale down votes whose veBTC power has decayed; `clean` removes votes whose voter no longer holds cover.
- **Honest limit.** These are not Mezo protocol emissions and not an official Mezo gauge. An official gauge would need Mezo governance (see the roadmap).

Testnet epochs are 10 minutes so the loop can be demonstrated in a session; epoch length is a deployment parameter.

## The contracts

| Contract | Role |
|---|---|
| [`CosignVault`](../contracts/src/CosignVault.sol) | One per market. Tranche accounting, interest split with a junior premium, loss waterfall, cover exit rules, reward streaming. Supplies MUSD to the Morpho market. |
| [`CosignGauge`](../contracts/src/CosignGauge.sol) | Reads live veBTC power, caps each market's weight by its cover, distributes self-funded MEZO by weight each epoch. |
| [`CosignLiquidator`](../contracts/src/CosignLiquidator.sol) | Syncs the vault, liquidates on Morpho, syncs again. |
| [`AdminOracle`](../contracts/src/AdminOracle.sol) | Owner-set price. **Demo only**, so a price crash can be shown on testnet. |
| [`FixedRateIrm`](../contracts/src/FixedRateIrm.sol) | Fixed-APR interest model per market. |
| Morpho Blue | Vendored unmodified, deployed as our own instance. |

External: Mezo MUSD, the MEZO precompile and the Mezo veBTC contract.

| Market | Loan-to-value | Cover multiple | Borrow APR | Junior premium | Reward split (junior / senior) |
|---|---|---|---|---|---|
| Bold MEZO | 77% | 19× (minimum cover 5%) | 12% fixed | 25% of senior interest | 30% / 70% |
| Steady MEZO | 62.5% | 9× (minimum cover 10%) | 8% fixed | 20% of senior interest | 30% / 70% |

Addresses are in the [README](../README.md#live-deployments) and `contracts/deployments/31611.json`.

## What the contracts do not do

See [Security and limitations](../README.md#security-and-limitations) for the full list. In short: cover protects only up to its size; a co-signer whose notice has ended can leave before a loss is booked; the vault's deposit limit does not cap borrowing on the Morpho market; the oracle is a single-owner demo oracle; nothing has been audited.

## Prior art

First-loss capital is an established idea. Aave's Umbrella has stakers slashed to cover bad debt; Blend (Stellar) backs each isolated pool with a first-loss backstop; senior/junior tranching is decades old in traditional credit. What Cosign adds is that **the cover sets the credit limit** and **the vote only counts when backed by cover**, with veBTC holders as the underwriters.

## How v2 differs from v1

| v1 problem found in review | v2 |
|---|---|
| The cushion was earned fees only, far too small to matter | Bonded MUSD cover with a hard minimum that caps market size |
| A lending engine written from scratch | Morpho Blue reused unmodified; Cosign writes the tranche vault, the gauge and small helpers |
| Accrued interest "sent" to the cushion before it was collected | Both tranches hold claims on one Morpho position |
| A custom gauge that could be mistaken for an official one | Labelled self-funded |
| Votes cost nothing | Votes count only up to posted cover |

The v1 report and evidence are kept in [`archive/`](archive/).

## Roadmap (none of this is built)

1. An independent audit of the vault and gauge accounting.
2. A production oracle, and borrowing gated on cover.
3. Settle losses at liquidation time, so exits just before realisation cannot shift losses onto those who stay.
4. Ask Mezo governance to attach an official gauge to a Cosign vault, so real emissions can flow without code changes.
5. A per-market minimum cover set by collateral volatility, and a public cover-weighted credit signal.
6. Mainnet readiness: parameter review with Mezo, monitoring, keeper operation for `CosignLiquidator`.
