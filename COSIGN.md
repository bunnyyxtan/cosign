# COSIGN: full product brief for any AI or human joining this project

> Read this whole file before writing code, a pitch, or a deck. It is the single source of truth for **what Cosign is, why it exists, how it works, what to build first, and what not to claim**.
> v2, 20 Oct 2026. **Live on Mezo testnet**: addresses, transactions and verification in `docs/TESTNET_REPORT.md`. v2 replaces the v1 "cushion = earned fees" design after review (see §10). Supporting research: `research/IDEA_DECISION.md`, raw sources in `research/raw/`.
> `research/COSIGN_VISION.md` is v1 pitch notes: its mechanism is outdated, so trust this file. `research/MEZO_BUILDATHON_RESEARCH.md` and `research/CLAUDE_FIRST_BUILD_BRIEF.md` describe an older idea ("Mezo Depth") and are **superseded**; their rules and dates are still accurate.

---

## 0. TL;DR

**Cosign lets Bitcoin holders co-sign lending markets: they put money in front of lenders, get paid for it, and pay first if loans go bad.**

- Lenders deposit **MUSD** (Mezo's Bitcoin-backed stablecoin) into a market. Borrowers borrow it against **MEZO** collateral.
- **Co-signers** are veBTC holders (BTC locked on Mezo). They vote for the market *and* post MUSD **cover** in front of the lenders.
- **A market can only lend 19× its cover.** No cover, no lending. Co-signers' money sets the credit limit.
- Co-signers earn a large cut of the market's interest plus MEZO rewards. If a loan goes bad, **their cover is burned first**.
- Lenders see one honest number: **"covered for the first X% of losses."**

The design in three words: **Vote = Bond = Credit limit.** (Bond is the MUSD cover a co-signer posts. 19× lending on 1× cover means cover is 5% of everything lent.)

One image sums up the product: **a bar of lender money with a coloured cover block in front of it. The price crashes, the cover shrinks, and the lender's bar doesn't move.**

---

## 1. Context: the hackathon

| Item | Value |
|---|---|
| Event | Mezo Buildathon on AKINDO: https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10 |
| Requirement | Must integrate **MUSD and/or MEZO**. Deploy on Mezo, Ethereum, Base or BNB Chain; **Mezo testnet is accepted** |
| Wave 1 | Build 16–26 Oct 2026 (internal target: submit **25 Oct**). Pool $2,000 in MEZO |
| Wave 2 | Build 2–15 Nov 2026. Pool $5,000 in MEZO. Must show meaningful progress since Wave 1 |
| Payout | Proportional to judges' points, not top-3 |
| Judges | The Mezo core team |
| Submission | Live link, public GitHub, deck, **2-minute video**, form (name, category, TL;DR, how it works, target group, stack, track, chain, status, readiness, 3 future milestones, team) |
| Track | **Track 1: DeFi** (borrowing, lending, looping, yield) |

**Scoring rubric:**

| Criterion | Weight | How Cosign wins it |
|---|---|---|
| Mezo integration | 30% | All three Mezo assets in real roles: MUSD (loan asset and cover), MEZO (collateral and rewards), veBTC (who may co-sign, and vote weight) |
| Product & business viability | 30% | Implements the mechanism Mezo publicly asked for. Real economics (§4.3). Path to a large business (§7) |
| Technical implementation | 20% | Reuses Morpho Blue for lending. Our own code is a small tranche vault and gauge with invariant tests |
| UX | 10% | Three screens, one memorable visual |
| Submission quality | 10% | A demo with one "oh" moment (the crash), voiced by a human |

Mezo's stated priorities: "Extend, don't detour." "**Composability wins**: projects that plug into existing DeFi infrastructure (lending markets, DEXs, vote-escrow systems) score higher than isolated consumer apps." Cosign plugs into a lending market (Morpho Blue) and a vote-escrow system (veBTC).

---

## 2. Why this idea (evidence)

### 2.1 Mezo asked for it, and hasn't built it
- Mezo blog, **"Aerodrome for Lending"** (28 Apr 2026): https://mezo.org/blog/aerodrome-for-lending/
  - Thesis: swaps got gauges; **lending never did**. Nobody can bid for lending supply, and depositors absorb listing risk they didn't choose.
  - Their goal: one vote that **routes supply and prices risk**. Emissions as "a risk-pricing signal". "Mezo asks whether the people setting the price should be the people holding the bag."
  - It ends: *"The mechanism that turns those votes into a verdict on creditworthiness is the subject of a future post."* No follow-up post was found as of 20 Oct 2026.
- Current Mezo gauges cover DEX pools, the MUSD savings rate, veBTC boosts, validators and ecosystem programmes. **None cover lending markets** (https://mezo.org/blog/how-gauges-and-splitters-work-on-mezo/).
- **Cosign is a working prototype of that unshipped mechanism.** The judges wrote the post.

### 2.2 Nobody in the competition does it
The 20 Wave 1 entries (as of 20 Oct) are payments, subscriptions, invoicing, liquidation/redemption alerts (Vigil, Lockwatch, Trove Guardian), savings, yield vaults, leverage (Coil), escrow and dashboards. Past Mezo winners and ecosystem products (Mezoir, BynD, Fractals, Matchbox, Boar) work on voting UX and boost markets. **None are lending gauges or first-loss underwriting.**

### 2.3 Real user wounds (Reddit, via Exa)
- Bitcoiners lost coins in the 2022 Celsius/BlockFi/Voyager bankruptcies. "Trust is based on history of exploits and hacks." (r/CryptoCurrency, Aug 2026)
- Lenders care about tail events: "I'm more interested in how they work when BTC drops 15-20% quickly." (same thread)
- MEZO holders want productive uses: "what is your profit generating plan for MEZO" (r/MezoNetwork, May 2026). Borrowing MUSD against MEZO is one answer.
- veBTC holders already vote weekly ("a weekly pain", Boar on r/MezoNetwork). Cosign adds a reason to vote, not a new habit.

### 2.4 Prior art (name it before judges do)
- **Aave Umbrella** (live mid-2025): stakers of aTokens are slashed automatically to cover bad debt.
- **Blend** (Stellar): each isolated pool has a backstop of BLND:USDC LP tokens acting as first-loss capital, with a withdrawal queue.
- **Tranching** (senior/junior) is decades old in TradFi.

| | Umbrella / Blend | Cosign |
|---|---|---|
| Who underwrites | Stakers of that protocol's token or deposits | **veBTC holders** (Bitcoin holders) |
| Does cover set the credit limit? | No | **Yes**: a market can lend at most 19× its cover |
| Does the vote move liquidity? | No, cover is passive | **Yes**: votes route MEZO rewards, but only count when backed by cover |
| Scope | One protocol | A **market** where any lending market can compete for co-signers |

---

## 3. The three wounds we heal (use this framing in all copy)

1. **The Bitcoiner: "In 2022 I lent my coins out for yield and lost them. I never knew what risk I was taking."**
   Heal: your BTC stays locked. You *choose* which market to back, you *see* exactly what you're risking (your cover), and you're *paid* for it. Risk you pick, see, and get paid for, instead of risk hidden from you.
2. **The lender: "I earn 5% and secretly carry a risk nobody priced."**
   Heal: every market shows **"covered for the first X% of losses"**, backed by real money from the people who vouched for it.
3. **Mezo (the judges): "Emissions get farmed and dumped; MUSD needs demand; lending never got its gauge."**
   Heal: emissions only flow where someone has posted cover. MUSD demand comes from both sides: lenders hold MUSD, and co-signers often **mint MUSD against BTC on Mezo to post as cover**. MEZO gains collateral utility, veBTC gains a new income stream, and their April thesis ships.

---

## 4. How it works

### 4.1 Plain language

```
   Borrowers ──(MEZO collateral)──► Morpho Blue market (MUSD loans)
                                          ▲  supplies all MUSD
                                   ┌──────┴──────┐
                                   │ Cosign Vault│
                                   ├─────────────┤
            Lenders (senior) ───►  │ ███████████ │  paid 2nd, lose last
            Co-signers (junior) ─► │ ▓▓▓         │  paid 1st, lose FIRST
                                   └─────────────┘
   Rule: senior ≤ 19 × junior    (cover ≥ 5% of the vault)
   veBTC votes (backed by junior cover) → MEZO rewards → this vault
```

1. **Co-sign.** A veBTC holder deposits MUSD cover (junior) into a market's vault and votes for it.
2. **Unlock lending.** Each 1 MUSD of cover lets 19 MUSD of lender deposits in. Cover is the credit limit.
3. **Earn.** Borrowers pay interest. Co-signers get a fixed, large cut of it (e.g. 20%) plus MEZO rewards. Lenders get the rest.
4. **Pay first.** A liquidation leaves bad debt, so the vault's value drops. The loss is charged to cover first. Lenders lose only after cover is gone.

### 4.2 Why the vote now means something (the answer to "can raters bear enough risk?")
- **No cover, no vote.** A veBTC vote for a market only counts up to the cover that voter has posted there.
- **No cover, no lending.** A market's size is capped by its cover. Vouching for a market means paying to grow it.
- **Cover can't run.** Withdrawing cover needs a cooldown (1 epoch) and can't push coverage below the minimum. Co-signers can't flee the moment trouble appears.

### 4.3 The numbers (illustrative; no real market data yet)
A vault with 100,000 MUSD senior and 5,263 MUSD cover (5% coverage), fully borrowed at 10% APR:

| | Senior (lenders) | Junior (co-signers) |
|---|---|---|
| Interest/yr (10,526 total, 20% to junior) | 8,421 → **8.4% APR** | 2,105 → **40% APR** (before MEZO rewards) |
| 1% bad debt (1,053 MUSD) | **0 loss** | −1,053 (−20%) |
| 5.26% bad debt | 0 loss | wiped out |
| 8% bad debt | −2.7% | wiped out |

This answers the critique of v1: fee-only cover would have absorbed about 4% of a 1% loss. Bonded cover absorbs **100% of it**, and co-signers are paid enough to take the risk. The minimum coverage, the junior cut and the cooldown are the levers. Riskier markets need more cover.

### 4.4 Honest limits
- Cover protects only the first X% of losses. **Never say "protected" or "insured"; say "covered for the first X%."**
- Co-signers who borrow MUSD against BTC to post cover are leveraged. If their cover is burned, they still owe that MUSD. Say so in the UI.
- Wave 1 MEZO rewards are funded by us/sponsors (self-funded gauge). **Real protocol emissions need Mezo governance** (§6). Never present Wave 1 as an official Mezo gauge.
- The rater risks posted MUSD cover, not their locked BTC. (veBTC-as-cover is a research item, §6.)

---

## 5. Wave 1 technical spec (Mezo testnet)

### 5.1 Network facts (from Mezo docs; re-verify before deploying)

| Item | Value |
|---|---|
| Chain ID | 31611 (testnet); 31612 (mainnet) |
| RPC / Explorer | https://rpc.test.mezo.org / https://explorer.test.mezo.org |
| Gas | BTC, 18 decimals |
| EVM target | Mezo docs recommend **London**. Morpho Blue compiles for **paris**: check that it deploys and runs on day 1 |
| Testnet MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Testnet MEZO | **Resolve** from the faucet/docs (not verified) |
| Testnet veBTC / Voter | Listed in https://github.com/mezo-org/tigris/tree/main/solidity/deployments/testnet (`VeBTC.json`, `VeBTCVoter.json`, …). The repo was last pushed Nov 2025, so **confirm the bytecode is live and read the ABI** |
| Faucet / MUSD | https://faucet.test.mezo.org (BTC + MEZO). Get MUSD by borrowing at https://testnet.mezo.org |
| Viem chain config | https://github.com/mezo-org/chains |

### 5.2 Components

**Reused (not written by us):**
- **Morpho Blue** (`morpho-org/morpho-blue`, `src/Morpho.sol` under GPL-2.0-or-later; other files MIT). We deploy our own unmodified instance on Mezo testnet and credit it in the README. It handles supply, borrow, collateral, liquidation and **bad-debt realisation** (`liquidate` reduces `totalSupplyAssets` by the bad debt, so suppliers absorb it pro rata). The Morpho protocol fee stays **0**; the interest split happens in our vault.
- OpenZeppelin (ERC20, SafeERC20, ReentrancyGuard).

**Written by us (keep small):**

| Contract | Job |
|---|---|
| `FixedRateIrm` | A tiny Morpho IRM with a fixed borrow rate per market (e.g. 10%). Enabled on our Morpho instance |
| `AdminOracle` | Morpho `IOracle` (`price()` scaled 1e36). Owner sets the MEZO price. **Labelled "demo oracle" everywhere.** It exists to show the crash |
| `CosignVault` (one per market) | The **tranche vault**. It is the supplier into its Morpho market. Two share tokens: `senior` (lenders) and `junior` (co-signers). Waterfall accounting below |
| `CosignGauge` | Epochs, veBTC votes capped by cover, MEZO reward distribution to vaults |
| `CosignLiquidator` | Added after live testing: syncs the vault, liquidates on Morpho, syncs again, so interest earned before a loss is booked before the loss is charged (see `docs/TESTNET_REPORT.md`, bug 1) |

**`CosignVault` accounting (the heart of the system):**
- State: `seniorAssets`, `juniorAssets` (book values in MUSD), plus share supplies for each tranche.
- `_sync()` runs before every action: `total = morpho supply position value (after accrueInterest) + idle MUSD`, then `delta = total − (seniorAssets + juniorAssets)`.
  - `delta ≥ 0` (interest): `juniorAssets += delta × JUNIOR_CUT`, and `seniorAssets += the rest`.
  - `delta < 0` (loss): `hit = min(−delta, juniorAssets)`, `juniorAssets −= hit`, `seniorAssets −= (−delta − hit)`. Emit `LossAbsorbed(loss, byJunior, bySenior)`. **This event is the demo.**
- Interest is never "transferred" anywhere. Both tranches hold *claims* on the same Morpho position, realised on withdrawal when market liquidity allows. (This fixes the v1 bug of sending accrued-but-uncollected interest.)
- `depositSenior` is allowed only if `seniorAssets + amount ≤ MAX_LEVERAGE × juniorAssets` (MAX_LEVERAGE = 19).
- `depositJunior` is open. `requestJuniorWithdraw`, then after `COOLDOWN` (1 epoch), `withdrawJunior`; it must keep `seniorAssets ≤ MAX_LEVERAGE × juniorAssets`.
- `withdrawSenior` is any time, limited by Morpho liquidity (utilisation).
- Both tranches use virtual-share offsets (protection against the inflation attack). Rounding favours the vault.
- Note: anyone can also supply to the Morpho market directly, outside Cosign. Bad debt is then shared pro rata with them, uncovered. Document it; the demo market has only the vault as supplier.

**`CosignGauge`:**
- Epochs: configurable length. **Short on testnet (e.g. 1 hour) for the demo.** Weekly on mainnet (Mezo's Thursday epoch).
- `vote(tokenId, vaults[], weights[])`: the caller owns, or is approved for, the veBTC NFT. Power is read from Mezo's `VeBTC` (expected Solidly-style `balanceOfNFT` / `ownerOf` / `isApprovedOrOwner`; **verify against the deployed ABI**). **Effective vote on a vault = min(allocated power, voter's junior cover in that vault × POWER_PER_MUSD).** One vote per tokenId per epoch. Votes persist.
- `notifyRewardAmount(MEZO)`: anyone funds the next epoch. Each vault gets `budget × effectiveVotes / totalEffectiveVotes`. Inside a vault the split is `REWARD_JUNIOR_SHARE` (e.g. 30%) to junior holders and the rest to senior holders, pro rata to tranche shares (Synthetix-style accumulators).
- Undistributed rewards (no votes) roll to the next epoch.

### 5.3 Invariants: tests that must exist (Foundry)
1. If `loss ≤ juniorAssets`, the senior share price **does not decrease**. This is the headline guarantee.
2. `byJunior + bySenior == loss`, always. `seniorAssets + juniorAssets == total` after every sync, up to rounding.
3. `seniorAssets ≤ 19 × juniorAssets` holds after every deposit and every junior withdrawal.
4. Junior can't withdraw before the cooldown, or below the coverage minimum.
5. A vote's effective weight never exceeds the voter's veBTC power, nor its cover cap. One vote per tokenId per epoch.
6. Rewards distributed per epoch total `≤ budget`.
7. End-to-end on a fork or testnet: supply → borrow → price crash → Morpho `liquidate` with bad debt → vault sync → junior absorbs → senior share price flat.
8. Interest split matches `JUNIOR_CUT` exactly, up to rounding. The inflation attack on either tranche fails.

### 5.4 Security checklist
Reentrancy guards. Pull-based claims. SafeERC20. Zero/stale price checks (even on the admin oracle). No `delegatecall`, no upgradeability. Events for every state change. Our Morpho instance's owner can enable IRMs/LLTVs (disclose this; Wave 2 can renounce ownership). README and UI footer say **"Unaudited prototype, testnet only."**

### 5.5 Frontend (three screens; Next.js + wagmi/viem; Mezo testnet only)
1. **Markets:** each row shows the bar (lender MUSD with the cover block in front), **"Covered for first X% of losses"**, senior APR, junior APR (+ MEZO), borrow rate, and remaining lending capacity (19 × cover − senior).
2. **Co-sign:** connect, show veBTC power, post or withdraw cover, allocate votes (with a hint showing the cap each vault's cover allows), epoch countdown.
3. **Market detail:** lend/withdraw (senior), borrow/repay (MEZO collateral), the big bar. A **"Demo: crash price"** panel (oracle owner only, clearly labelled) runs crash → liquidation → `LossAbsorbed`, animating the cover shrinking while the lender bar stays flat. Every action links to the explorer tx.

### 5.6 Day-1 gate (21 Oct). Do this before any UI
1. Deploy Morpho Blue + `FixedRateIrm` + `AdminOracle` on Mezo testnet; create a MUSD/MEZO market (check the paris-vs-London deploy).
2. Confirm testnet `VeBTC` is live; lock faucet BTC; read voting power. **Fail →** weight votes by cover alone and say so plainly (weaker integration).
3. Obtain testnet MUSD and MEZO.
4. Run one cycle by script: junior deposit → senior deposit → borrow → crash → liquidate with bad debt → sync → check that the senior share price is flat.

---

## 6. Wave 2 plan (2–15 Nov)
- **Official emissions:** the vault share tokens are a *natural staking token*, the exact pattern Mezo's staking gauges use. Ask Mezo governance to register a real gauge for a Cosign vault, so real MEZO emissions flow with no code change on our side.
- **Real oracle:** a TWAP from a Mezo pool, or an oracle Mezo supports.
- **Risk-based coverage:** minimum coverage per market set by collateral volatility (riskier collateral needs more cover).
- **Ethereum:** a Cosign vault in front of the existing MUSD Morpho markets on Ethereum mainnet (https://mezo.org/blog/stack-sats-and-bitcoin-backed-stables-morpho-vault-incentives-go-live/). Same Morpho stack, real liquidity.
- **Cosign score:** public, cover-weighted credit signal per market.
- **Research:** veBTC itself as cover (the rater stakes locked BTC). Depends on veBTC transferability and how a locked position could be liquidated. Ask Mezo.
- Quoted feedback from 3+ real users (a veBTC holder, an MUSD holder, a DeFi lender).

---

## 7. The big vision (deck, and the last 15s of the pitch)

**2008 in one sentence:** rating agencies stamped AAA on junk because they never paid when it failed. **Cosign is a credit rating where the rater pays first, and the rater's money sets the credit limit.**

| Stage | Cosign is | Revenue |
|---|---|---|
| Now | MUSD lending markets on Mezo, co-signed by veBTC holders | (testnet) |
| Year 1 | Cosign vaults in front of any Morpho/Euler market on any chain; markets compete for Bitcoin co-signers | A small cut of the junior tranche's interest |
| Year 2 | The Cosign score: a skin-in-the-game ratings API for vaults, curators and wallets | Data fees |
| Year 3+ | First-loss underwriting for onchain private credit and RWAs (global private credit ≈ $3.5T AUM, Alternative Credit Council, Dec 2025) | Underwriting take rate |

Thesis: **Bitcoin is the largest pool of patient capital in the world. Cosign turns Bitcoin holders into the underwriters of onchain credit.**

---

## 8. The pitch

### 8.1 One-liners
- Product: **"Cosign lets Bitcoin holders co-sign lending markets. They put money in front of lenders, get paid for it, and pay first if loans go bad."**
- Mechanism: **"Vote = Bond = Credit limit."**
- For Mezo: **"Lending never got its gauge. Here it is, working on Mezo testnet."**
- Form category (3–5 words): **"Lending gauges, first-loss underwriting"**

### 8.2 First 60 seconds (skeleton; the founder rewrites it in their own voice; judges penalise AI scripts and AI voices)
> In 2022 Bitcoiners lent their coins out for yield and lost them. They never knew what risk they were taking.
> Cosign flips that. You choose the risk, you see it, and you get paid for it.
> You're a co-signer. You put MUSD in front of a lending market's lenders and vote for it with your locked Bitcoin.
> Your cover is the credit limit: the market can only lend 19 dollars for every dollar you put up.
> Borrowers pay interest. You get a big cut of it, plus MEZO rewards.
> And if a loan goes bad, you pay first. Not the lender.
> *[demo: crash → bad loan → cover shrinks → lender bar doesn't move]*
> That's a credit rating where the rater pays first.

### 8.3 Two-minute video structure
| Time | Content |
|---|---|
| 0–10s | One-liner + the co-signer analogy |
| 10–25s | The wound: the 2022 losses, plus Mezo's "lending never got its gauge" |
| 25–75s | Live: post cover → lending capacity opens → lender deposits → vote → MEZO rewards → borrower opens a loan |
| 75–105s | Live: crash → liquidation → `LossAbsorbed` → cover shrinks, lender share price flat → explorer tx |
| 105–120s | "Rater pays first" → the ladder; one honest limit (self-funded rewards until Mezo governance attaches a gauge) |

Record with a screen recorder with auto-zoom (Cap / Screen Studio / OBS). Use a human voice. Start recording when the build is about 90% done.

---

## 9. Hard rules for anyone working on this

**Do:**
- Use real MUSD, real MEZO and real veBTC on Mezo testnet wherever they exist.
- Label every mock (oracle, short epochs, self-funded rewards) in the UI and README.
- Reuse Morpho Blue for lending. Don't write a lending engine.
- Keep scope to §5. The vision lives in the pitch, not in Wave 1 code.
- Name the prior art (Aave Umbrella, Blend, tranching) and our difference.
- Write the README in plain human language, with every deployed address linked on the explorer.

**Do not:**
- Say "insurance", "protected" or "safe". Say **"first-loss cover"** and **"covered for the first X% of losses."**
- Claim it is Mezo's official design, or an official Mezo gauge. Say "a working prototype of the idea in Mezo's April post", with "self-funded rewards in Wave 1".
- Forecast "multi-billion". Show the ladder.
- Invent APY, TVL, users or revenue. §4.3 numbers are labelled illustrative.
- Put services, chains or features in the form or deck that aren't in the repo.
- Add an AI agent, extra chains or extra tokens in Wave 1.
- Touch mainnet funds.

---

## 10. Design log: what changed from v1 and why

| v1 problem (from review) | v2 fix |
|---|---|
| The cushion was earned fees only: about 38 MUSD/week on a 100k market, covering ~4% of a 1% loss. Meaningless | The cushion is **bonded MUSD cover** with a hard minimum (5%) that caps market size. A 1% loss is fully absorbed (§4.3) |
| A whole lending protocol written from scratch in 5 days | **Morpho Blue reused** for lending, liquidation and bad debt. We write a tranche vault, a gauge, a fixed IRM and an admin oracle |
| Accrued interest was "sent" to the cushion before it was collected | **Tranche accounting**: both tranches hold claims on the same Morpho position. Nothing moves until withdrawal |
| The custom gauge could be mistaken for an official Mezo gauge | Labelled **self-funded** in Wave 1. Vault shares are a natural staking token, so Mezo governance can attach a real gauge in Wave 2 |
| Votes cost nothing | **Votes count only up to posted cover.** Cover has a cooldown and can't drop below the minimum |

---

## 11. Open questions (owner: founder)
1. Is testnet `VeBTC` live? Does boosted voting power (veMEZO boost) appear on `VeBTC` or only on the Voter?
2. Does Morpho Blue (compiled for paris) deploy and run on Mezo testnet?
3. Exact Wave 1 deadline timezone (AKINDO showed "10/26 20:30").
4. Is there a MEZO/MUSD pool on Mezo testnet for a Wave 2 TWAP?
5. Would Mezo register a gauge for a Cosign vault in Wave 2? Is veBTC transferable or escrowable (for veBTC-as-cover research)?
6. What KYB documents does Mezo accept for a solo individual?

---

## 12. File map
| Path | What |
|---|---|
| `COSIGN.md` | This brief: the source of truth (v2) |
| `research/IDEA_DECISION.md` | Why Cosign beat the alternatives, with sources |
| `research/COSIGN_VISION.md` | v1 pitch notes (mechanism outdated; trust this file) |
| `research/raw/` | Raw Exa / Jina / gh dumps (Reddit, Trustpilot, Mezo blog, docs, AKINDO listing) |
| `research/MEZO_BUILDATHON_RESEARCH.md`, `research/CLAUDE_FIRST_BUILD_BRIEF.md` | **Superseded** idea ("Mezo Depth"); rules and dates still accurate |
| `.tools/Agent-Reach`, `.tools/mcporter` | Research tooling (Exa search via mcporter) |
