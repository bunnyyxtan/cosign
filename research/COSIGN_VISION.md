# Cosign: the big version

> **Outdated mechanism (v1).** The fee-only cushion here was replaced by bonded cover in `../COSIGN.md` (v2). Use that file.

Renamed from "Backstop": Blend already uses that word for its first-loss module, and judges who know DeFi would hear "copy".
The Wave 1 build is unchanged (see `IDEA_DECISION.md`). This file is the story and the ladder.

## One line

**Cosign pays Bitcoin holders to co-sign loans instead of lending their Bitcoin out.**

Everyone understands a co-signer: they vouch for a loan, they get paid for it, and if the loan goes bad, they pay first.

## The three wounds

### 1. The Bitcoiner's wound: "Every time I chased yield, I lost my coins."
In 2022, Bitcoiners lent their BTC to Celsius, BlockFi and Voyager for yield, and lost it in those bankruptcies.
The lesson they took: **never hand your Bitcoin to someone else for yield.** So their BTC sits idle.
Reddit today: "best is not about yield or interest, it's about Trust. Trust is based on history of exploits and hacks."

**Heal:** Your BTC never leaves your veBTC lock on Mezo. You earn by *judging* credit, not by handing over coins. The only thing at risk is the co-signing fees you've earned, never your Bitcoin.

### 2. The lender's wound: "I earn 5% and secretly carry a risk nobody priced."
A stablecoin depositor in a lending pool can't see who is responsible when a loan blows up. The answer is always: you are.
Reddit: "I'm more interested in how they work when BTC drops 15-20% quickly."

**Heal:** Every market shows a **cushion**: real money, posted by the people who vouched for it, sitting in front of your deposit. The rule is visible: the cushion pays before you do.

### 3. Mezo's wound (the judges): "Emissions get farmed and dumped, MUSD needs places to live, and we promised a mechanism we haven't shipped."
- Mezo's own words (Apr 2026): lending "never got its gauge". They want emissions to be "less of a subsidy and more of a risk-pricing signal". The design is promised for "a future post", and it hasn't appeared.
- Every Cosign market lends **MUSD**, so each market is new MUSD demand.
- MEZO gets two jobs: collateral, and emissions that now buy *underwriting* instead of mercenary liquidity.
- veBTC gets a new revenue stream (co-signing fees) on top of chain fees.

**Heal:** Cosign is their April thesis, working on testnet.

## How it works (show this, don't say it)

```
          Lenders' MUSD   ███████████████████████████   ← protected
          Cosign cushion  ▓▓▓▓▓                         ← pays first
                          ▲
   veBTC holders vote ────┘  "I vouch for this market"
     → market gets MEZO rewards → lenders arrive
     → voters earn a cut of the interest → it builds the cushion
```

1. **Vouch.** veBTC holders vote on lending markets they trust.
2. **Flow.** Votes pull MEZO rewards to that market, so lenders bring MUSD.
3. **Earn.** Voters take a cut of the market's interest. It vests into the market's cushion.
4. **Pay first.** A loan goes bad, the cushion is burned, and lenders stay whole.

Good judgment earns. Bad judgment costs the judge, not the lender.

## The 60-second explanation (rewrite in your own voice; judges punish AI scripts)

> In 2022 Bitcoiners lent their coins out for yield, to Celsius, to BlockFi, and lost them.
> So most Bitcoin just sits there.
>
> Cosign pays you to co-sign loans instead.
>
> You lock Bitcoin on Mezo. You vote for the lending markets you trust.
> Your vote sends MEZO rewards there, so lenders show up with MUSD.
> You earn a cut of the interest.
>
> The catch is the point: if a loan in your market goes bad, your earnings pay first. Not the lender.
>
> *[demo: crash the price → bad loan → cushion shrinks → lender balance doesn't move]*
>
> Your Bitcoin never leaves your lock. You get paid for judgment, not for handing over coins.
>
> Mezo wrote in April that lending never got its gauge. Here it is, live on Mezo testnet.

That's about 50 seconds. The demo carries the rest.

## Why this is a very big company, not a hackathon toy

**2008 in one sentence:** rating agencies stamped AAA on junk because they never paid when it failed.
Cosign is a credit rating where **the rater pays first.**

| Stage | What Cosign is | Who pays us |
|---|---|---|
| Wave 1–2 (now) | MUSD lending markets on Mezo. MEZO collateral, co-signed by veBTC | (testnet) |
| Year 1 | Any lending market on any chain bids for Bitcoin co-signing: Morpho and Euler isolated markets, starting with the existing MUSD Morpho vault on Ethereum | A cut of every co-signing fee |
| Year 2 | The **Cosign score**: vote-weighted, skin-in-the-game ratings for every market, sold as an API to vaults, curators and wallets | Data / ratings fees |
| Year 3+ | Onchain private credit and RWAs, where underwriting is the bottleneck. Global private credit is about **$3.5T AUM** (Alternative Credit Council, Dec 2025) | Underwriting take rate |

**The thesis: Bitcoin is the biggest pile of long-term, idle capital in the world. Cosign turns it into the world's underwriting capital, without anyone lending a single sat.**

Comparables to name out loud: rating agencies and reinsurers (Lloyd's) are huge businesses built on "who carries the risk". In DeFi, Aave Umbrella and Blend prove that first-loss capital works.

## Why not just Aave Umbrella or Blend? (say this before a judge asks)

| | Aave Umbrella / Blend | Cosign |
|---|---|---|
| Who underwrites | Stakers of that protocol's own token or deposits | **Bitcoin holders**: the largest, most patient capital |
| What they risk | Their staked principal | Only their earned co-signing fees. BTC stays locked |
| Does the vote move liquidity? | No, cover is passive | **Yes**: one vote routes rewards *and* takes the risk |
| Scope | One protocol | A market: any lending market can bid for cover |

## What we build vs. what we say

**Wave 1 (ship by 25 Oct):** two MEZO-collateral MUSD markets on Mezo testnet, veBTC voting, cushion accounting, the crash demo, and an explorer link for every step.
**Wave 2 (by 15 Nov):** real Mezo gauge attachment (ask the team), a TWAP oracle, a deep-cover tier (underwriters can post extra MUSD for a bigger fee), and the Ethereum Morpho market via Merkl.

**Do not claim** in the pitch:
- "Multi-billion" as a forecast. Say "the endgame is underwriting for onchain credit", and let the judges do the maths.
- "Insurance". Say "first-loss cover". The insurance word carries regulatory weight.
- Any APY, TVL or user numbers we don't have.
- That this is Mezo's official design. Say "a working prototype of your April idea".

## The one image judges should remember

A bar showing the lender's money with a coloured cushion in front of it. Price crashes, the cushion shrinks, and the lender's bar doesn't move.

That's the whole company in one picture. Build the UI around it.
