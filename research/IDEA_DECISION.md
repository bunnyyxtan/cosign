# Idea decision: Backstop (lending gauges for MUSD)

Date: 20 Oct 2026. Research route: Agent-Reach → Exa search (Reddit, X, blogs indexed) + Jina Reader, plus `gh` on mezo-org.
X and Reddit live search need login cookies in Agent-Reach (twitter-cli / rdt-cli / OpenCLI); none were configured, and Reddit 403s anonymous reads. Reddit content came through Exa's index. Raw dumps are in `research/raw/`.

## The pick

**Backstop: Aerodrome-style gauges for MUSD lending. veBTC voters route MEZO emissions to MUSD lending markets and put their own rewards up as first-loss cover.**

Track 1 (DeFi). Deploy on Mezo testnet.

### Why this one

1. **Mezo asked for it, publicly, and hasn't built it.** In [Aerodrome for Lending](https://mezo.org/blog/aerodrome-for-lending/) (28 Apr 2026), Mezo argues that lending never got its gauge. They want veBTC votes to route supply *and* price risk ("Mezo asks whether the people setting the price should be the people holding the bag"). The post ends: "The mechanism that turns those votes into a verdict on creditworthiness is the subject of a future post." No follow-up post was found.
   Current gauges cover DEX pools, the MUSD savings rate, veBTC boosts, validators and ecosystem programmes. None cover lending markets ([gauges & splitters](https://mezo.org/blog/how-gauges-and-splitters-work-on-mezo/), [Mezo Earn](https://mezo.org/blog/mezo-earn-a-ve-3-3-system-for-bitcoin-lending/)).
   The judges are the people who wrote that post.
2. **It hits the rubric where it's heaviest.** "Composability wins: plug into lending markets, DEXs, vote-escrow systems": this plugs into two of those. The Track 1 examples ask for "lending protocols accepting MUSD/MEZO as collateral". That covers 30% Integration plus 30% Viability.
3. **Nobody in the field does it.** All 20 current AKINDO entries are payments, alerts, savings, vaults or leverage. Past winners (Mezoir, BynD, Fractals, Matchbox, Boar) work on voting UX and boost markets, not lending gauges.
4. **It has one memorable demo moment.** Crash the collateral price, a loan goes bad, and the voters' backstop absorbs the bad debt on-chain. The lenders' share price doesn't move.
5. **Real users fear this problem.**
   - "I'm more interested in how they work when BTC drops 15-20% quickly. That seems like the point where the differences actually matter." ([r/CryptoCurrency, Aug 2026](https://www.reddit.com/r/CryptoCurrency/comments/1vu9hzo/best_bitcoinbacked_loans_platforms_looking_for/))
   - "Trust is based on history of exploits and hacks." (same thread)
   - Another user cites "risk of what happened with Aave last month" ([r/btc, Jun 2026](https://www.reddit.com/r/btc/comments/1uddcv6/best_platform_for_bitcoin_backed_loan/)).
   Backstop makes "who eats the loss" explicit, on-chain, and priced by voters.

### Honest weaknesses

- Most of the evidence comes from the sponsor, not from users. No lender has told us they want this. Mitigation: show the mechanism to 3 people (one veBTC holder, one MUSD holder, one DeFi lender) before 25 Oct, and quote them.
- Mezo may have its own design in progress. Pitch this as "a working prototype of your April thesis" and invite them to tear it apart. Don't claim it's *the* design.
- It's new lending code written in days. Keep it testnet-only, label it unaudited, keep it small, and test liquidation and bad-debt paths hard. The 19 Oct reply from Mezo's `civ_defi_mezo` stressed "no obvious security flaws".

## Mechanism (Wave 1)

| Piece | What it does |
|---|---|
| `LendingMarket` (×2 instances) | Isolated market. Lenders deposit MUSD and get ERC-4626 shares. Borrowers post **MEZO** as collateral and borrow MUSD. Each market has its own LLTV: one conservative, one aggressive. |
| `BackstopGauge` | Each epoch, veBTC holders vote their voting power (read from Mezo's testnet `VeBTC`) across markets. The MEZO incentive budget streams to each market's lenders in proportion to its votes. |
| Underwriting | Voters earn their market's reserve-factor interest (in MUSD). It vests over 2 epochs into a per-market **backstop buffer**. If a liquidation leaves bad debt, that buffer is burned first and lenders lose only what the buffer can't cover. |
| Oracle | Wave 1 uses an admin-set price, **clearly labelled** (it drives the crash demo). In Wave 2 it becomes a TWAP from the Tigris MEZO/MUSD pool, or a supported oracle. |

Integration touches all three Mezo pieces: MUSD (loan asset and voter yield), MEZO (collateral and incentives), and veBTC (vote weight).

Out of Wave 1: attaching to Mezo's real `VeBTCVoter`/`GaugeFactory`, which is governance-gated, so it's a Wave 2 ask to the team. Also out: cross-chain markets (Morpho on Ethereum hosts the existing [MUSD vault](https://mezo.org/blog/stack-sats-and-bitcoin-backed-stables-morpho-vault-incentives-go-live/), a natural Wave 2 target via Merkl, the same way remote gauges already pay out).

## Day-1 gate (21 Oct). If any item fails, cut scope

1. The testnet `VeBTC` from [tigris deployments/testnet](https://github.com/mezo-org/tigris/tree/main/solidity/deployments/testnet) is live, and we can lock faucet BTC and read voting power. The repo was last pushed Nov 2025, so verify on the explorer.
   *Fail →* vote weight comes from MEZO staked into our own contract. That's weaker integration, so say so.
2. We can get testnet MUSD (borrow it in the testnet dApp) and testnet MEZO (faucet).
3. Licence and approach for the market code: write a small one ourselves, or deploy an open-source isolated market. Check the licence before copying anything (Morpho Blue's licence needs checking, not assuming).

## Two-minute demo

- 0–10s: "Backstop is gauges for MUSD lending. veBTC voters route supply to lending markets and back their vote with their own rewards."
- 10–25s: The problem, in Mezo's own words: lending never got its gauge, and depositors absorb listing risk they didn't choose.
- 25–80s: Two MEZO-collateral markets. A voter splits veBTC votes, emissions flow, and lender APR updates. A borrower opens a loan.
- 80–105s: Crash the price, liquidate, bad debt appears, the buffer absorbs it, and the lender share price stays flat. Show the explorer tx.
- 105–120s: What's next for Wave 2: real Voter attachment, a TWAP oracle, Morpho/Ethereum via Merkl. Plus one honest limitation.

## Ranked alternatives (why not)

| Idea | Verdict |
|---|---|
| Mezo Depth (GPT's pick) | The weekly-vote pain is real ("optimizing veBTC yield is a weekly pain", Boar on [r/MezoNetwork](https://www.reddit.com/r/MezoNetwork/comments/1ukhr6s/mezo_earn_automated_by_boar/)), but Boar, Matchbox and Mezoir already solve it. Remote gauges likely need mainnet veMEZO for any judge to test. **Fallback #2.** |
| MEZO-collateral MUSD market only (no gauge) | A strict subset of Backstop. **Fallback #1** if the gauge piece slips. |
| Redemption / liquidation protection | The pain is real: Mezo's docs list redemption as "a taxable event and loss of upside exposure". But Vigil, Lockwatch, Trove Guardian and MUSD Pulse are already in this wave. |
| BTC → MUSD → bank off-ramp | Real complaints exist ("I don't see any option to send to external wallet", [Held Report comments](https://www.theheldreport.com/p/bitcoin-lending-the-trojan-horse/comments)). But it needs licensed partners, and payments is the most crowded category (45% of past entries). |
| Pooled borrowing under the $2,000 MUSD minimum | Weak evidence. Small holders can just swap BTC→MUSD. Pooling also adds a CDP on top of a CDP. |
| MUSD stability-pool yield token | Impossible: the Stability Pool is funded by a protocol bootstrap loan, not user deposits ([MUSD dev docs](https://mezo.org/docs/developers/musd/)). |
| Deprecated-asset bridge-out helper | Timely (SolvBTC withdrawals close 29 Oct, [The Defiant](https://thedefiant.io/news/blockchains/mezo-sets-oct-13-bridge-out-deadline-for-swbtc-and-usde)), but dead before judging ends. |

## Other user signals collected (for the deck / Wave 2)

- Lolli users are pushed to Mezo to withdraw sats and resent it ("I do not want to sign up for Mezo, just want to get my btc", [r/lolli](https://www.reddit.com/r/lolli/comments/1ofxa4j/do_i_have_to_sign_up_for_mezo_to_withdraw_my/)). This is a Track 2 distribution gap.
- Wrapped-BTC choices confuse non-DeFi users on Aave ([r/btc](https://www.reddit.com/r/btc/comments/1sgj1o8/comparing_btc_backed_loans/)).
- MEZO holders ask "what is your profit generating plan for MEZO" ([r/MezoNetwork](https://www.reddit.com/r/MezoNetwork/comments/1t6uycy/mezo_strategywant_feedback/)). Borrowing MUSD against MEZO answers that directly.
- Trustpilot sits at 4.4 from 20 reviews. The one substantive complaint (Aug 2025) was about repay and bridge-out being disabled at launch, which has since been fixed.
