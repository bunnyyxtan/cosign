# Mezo Buildathon research and strategy

Research date: 20 October 2026. Team: solo founder using Codex for research/product direction and Claude for implementation. Starting from scratch.

## Recommendation

Validate **Mezo Depth**, a working name for a product that connects MUSD liquidity analysis to MEZO incentive allocation.

Proposed pitch: “See where MUSD liquidity needs support, understand your allocation, and direct veMEZO votes from one workspace.”

This is my strategic recommendation, not a prediction of a winning score. Its feasibility and customer demand remain to be established. Do not spend several days building the interface before proving the contract integration.

The strongest reason to investigate it is a specific ecosystem change: Mezo introduced remote MEZO gauges in September, connecting votes on Mezo to MUSD pools on Ethereum and Base. The launch announcement explicitly links off-chain liquidity constraints to MUSD growth. [Official announcement](https://mezo.org/blog/introducing-mezo-gauges/)

There is also a documented information gap. The official voting guide says destination-pool TVL, fees, and vAPR are absent from its MEZO Gauge table. That makes a pool-aware allocation workflow plausible. It does not prove customers want our product. [Voting guide](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/how-to-vote/)

## Competition and rules

The live AKINDO page showed **20 submissions** when checked on October 20. This is a snapshot, not the final field or the number of eligible competitors. I inspected both pages of submission cards and public comments, not all repositories or demos.

| Milestone | Dates | Pool |
|---|---|---|
| Wave 1 build | October 16–26, 2026 | $2,000 worth of MEZO |
| Wave 1 judging | October 27–November 1 | — |
| Wave 2 build | November 2–15 | $5,000 worth of MEZO |
| Wave 2 judging | November 16–22 | — |
| Announcement and demos | November 23 | — |

There are roughly six days until the Wave 1 closing date. The browser timeline displayed “10/26 20:30 Deadline,” but I did not independently establish the display timezone. Confirm the authoritative cutoff in AKINDO and submit on October 25 as an internal target.

The pool is distributed proportionally to evaluation points. There is no fixed top-three prize ladder. A hypothetical 20% point share would yield $400 from Wave 1 and $1,000 from Wave 2; it is not an expected payout. Rewards are paid in MEZO, with conversion based on the stated 14-day TWAP at KYB completion. Verification is mandatory.

Hard requirements:

- Meaningful MUSD and/or MEZO integration.
- A working supported deployment: Mezo, Ethereum, Base, or BNB Chain; Mezo testnet explicitly accepted.
- New work during the program, or an identifiable new extension of an existing product.
- Public GitHub, live project link, product deck, two-minute pitch video, and completed submission details.
- Wave 2 resubmissions must explain meaningful progress.
- Every member registers individually, joins Mezo Discord, and agrees to the terms. Participants must be 18+, satisfy location restrictions, and join only one team per wave.

As a solo founder, clarify what Mezo accepts for individual recipients under its “KYB” process; the page welcomes individuals but does not resolve every verification detail. A registered company should not be assumed mandatory or unnecessary.

The form asks for category, one-line summary, problem and mechanism, audience, stack, track, deployment chain, project status/readiness, three future milestones, and team details.

[Live program and rules](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10). These requirements also appear in the brief supplied by the user.

## What to optimize

| Criterion | Weight | Evidence our project should supply |
|---|---:|---|
| Mezo integration | 30% | Real MEZO/veMEZO state and a confirmed protocol action; MUSD pool integration with verified addresses |
| Product and business viability | 30% | A specific recurring user problem, user feedback, and a credible continuation plan |
| Technical implementation | 20% | Correct protocol semantics, reliable data, transaction simulation, appropriate tests, and clear failure states |
| UX | 10% | A user can understand and complete the main task without our help |
| Submission quality | 10% | A short, reproducible demo showing outcome and evidence |

Our strategic inference: prioritize one complete workflow, then validate its usefulness. Adding a second token, chain, AI agent, or new contract does not automatically earn more points.

A public October 19 reply by `civ_defi_mezo` emphasizes working features, full testability, and absence of obvious security flaws. This supports treating implementation quality as a practical threshold, rather than relying on a polished pitch.

## Current competitors

Descriptions below summarize public submission-card claims; deployments and claims have not been independently audited.

| Project | Advertised focus |
|---|---|
| Liqvera | BTC market reports purchased with MUSD |
| Lockwatch | veBTC/veMEZO expiry and redemption monitoring |
| Vigil | Loan alerts and pre-signed rescue |
| Remitsheet for Mezo | Spreadsheet-driven batch payments |
| Mezo Flow | Cross-chain capital management |
| MUSD Books | Statements and invoice payments |
| Trove Guardian | Liquidation warning bot |
| MUSD Subs | Subscriptions and revenue splitting |
| MUSD Pay Links | Checked payment links and QR payments |
| MUSD Yield Vault | Automated yield |
| MezoRoute | Risk-aware borrowing and deployment routes |
| Coil | Leveraged BTC with pre-signed stop-loss |
| MUSD Pocket | Savings and family remittances |
| MezoGig | Freelance milestone escrow |
| Pocket | Social payments; card marked hidden |
| MUSD Pulse | Read-only health and borrowing dashboard |

The other four cards were two sparse TAWFIK entries and the hidden `kept` and `Origame` entries. Their visible information was insufficient to assess. Comments additionally described PayLink, Assumable, and Mezo Auth Dev; those comments do not establish screened submission status.

Conclusion: generic payments, subscriptions, liquidation alerts, leverage, and yield aggregation have visible overlap. This does not make them unwinnable, but they would need a much more specific advantage.

[Submission listing](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10?tab=products)

## Past winners and existing products

Mezo's June 2026 results include Cermin for automated borrowing/risk management, TreasuryOS for corporate treasury workflows, MezoPay for everyday payments, SuperPage for agent payments, Mezoir for ve-economy assistance, BynD for pooled voting power, and Fractals for fractionalized locked positions. The same report says payments/commerce represented 45% of submissions. These are overlap signals, not evidence every project remains operational. [Hackathon 2 results](https://mezo.org/blog/announcing-mezo-hackathon-2-winners/)

The 2025 results include TrovePilot for keepers, BTCShield for position support, StratumFi for self-repayment, KhipuVault for savings, Invoiced for BTC-to-MUSD invoicing, and BountyPay for developer bounties. [2025 results](https://mezo.org/blog/mezo-hackathon-winners/)

Matchbox already presents boost matching, incentives, and analytics. Boar already offers automated veBTC strategy management. A generic voting optimizer would face these products as well as Mezoir. Our proposed differentiation is **remote MUSD pool liquidity, the associated MEZO allocation, and evidence of subsequent outcomes**. Verify the actual overlap before committing. [Matchbox](https://matchbox.markets/), [Boar announcement](https://mezo.org/blog/set-it-and-earn-automated-vebtc-yield-with-boar-finance/)

I could read Matchbox's public landing page. The native Mezo voting page returned “Something went wrong” in this browser session, so I could not verify its current rendered table against the documentation. This is an observation about this session, not a claim that the product is generally unavailable.

## Proposed product

Initial user: a veMEZO holder who wants to support an MUSD pool, especially an LP or ecosystem operator with an existing interest in that pool.

The initial job: “Before I commit this epoch's vote, show me the destination pool's usable liquidity, incentives, and my transaction constraints.”

### Wave 1 scope

1. Connect an EVM wallet and load its eligible veMEZO positions.
2. Show an allowlisted set of remote MUSD pools and associated gauges.
3. Compare timestamped pool data and executable quotes at clearly stated sizes.
4. Let the user create a percentage allocation and inspect the rationale.
5. Simulate the actual protocol transaction, request the user's signature, submit, and show confirmed vote state with an explorer link.

The complete workflow needs a working chain integration. A chart plus outbound links is materially weaker.

For the first release, target one destination venue with reliable quote support, then add a second adapter if time permits. Label unsupported or unavailable pools explicitly. A small, accurate coverage set is preferable to pretending all four pools work.

Use live market reads for research, and clearly separate them from testnet transaction demonstrations. If the relevant official contracts do not exist on Mezo testnet, do not quietly replace them with mocks and claim a live integration.

### Wave 2 scope

- A second venue adapter and clearer comparison of reward paths.
- Direct posting of MUSD incentives to an existing eligible gauge, if supported by the verified contracts.
- An epoch report linking allocated votes, observed incentives, liquidity changes, and quote quality.
- Improvements demonstrated by several real target-user tests.
- A reusable read API or integration component for other ecosystem products, if demanded by testers.

Do not promise that additional votes cause a specific increase in liquidity. Votes influence an incentive allocation; other voters, token prices, market makers, and distribution delays affect the result.

### What makes the product distinct

Proposed contribution is a measurable decision-and-action workflow:

`Destination liquidity evidence → understandable allocation → signed protocol action → later outcome report`

Separate two objectives in the UI: personal voter incentives and support for destination liquidity. They can conflict. A thin pool is not automatically the best place to allocate emissions.

Avoid a black-box “AI optimal allocation” claim. Explain the inputs and leave the final allocation with the user.

### Business hypothesis

Free tools for holders; paid reporting and campaign coordination for ecosystem teams or liquidity managers. This is an unvalidated hypothesis. Interview target users before choosing pricing or claiming revenue potential.

A useful validation target is three conversations or observed tests: a veMEZO holder, an MUSD LP, and an ecosystem operator. Record the actual friction, their current workaround, and whether this workflow changes a decision.

## Important technical facts

Remote MEZO gauges are distinct from veBTC staking gauges and boost matching. The official documentation names four launch pools: Uniswap USDC/MUSD and Curve USDT/USDC/MUSD on Ethereum; Aerodrome USDC/MUSD and MEZO/MUSD on Base. Remote gauges use a governance-controlled registry. Do not assume anyone can permissionlessly add a destination. [MEZO Gauges overview](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/)

Voting requires an active veMEZO position and BTC for gas. The documented system permits one voter action per lock per epoch; allocations persist. It has a weekly voting window. These restrictions must be read and enforced in the product rather than hidden until a failed transaction. [Voting guide](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/how-to-vote/)

Reward paths differ. Curve/Uniswap LP rewards are described as three-month locked veMEZO through Merkl. Aerodrome veAERO voters receive MEZO incentives, while Aerodrome LPs receive AERO emissions. A vote is not an immediate LP payout. [Claiming guide](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/claiming-incentives/)

Mezo is EVM-compatible. Testnet chain ID is 31611; mainnet is 31612. BTC pays gas and uses 18 decimals on Mezo. The developer guide recommends compiling for the London EVM target. Testnet RPC: `https://rpc.test.mezo.org`. [Getting started](https://mezo.org/docs/developers/getting-started/)

Resolve token, gauge, registry, and voter addresses from official references and current deployment artifacts. Verify bytecode, chain, ABI, decimals, and runtime permissions. A documentation example is not sufficient proof of a deployed interface. [Contract reference](https://mezo.org/docs/users/resources/contracts-reference), [Mezo GitHub](https://github.com/mezo-org/)

Mezo's October 7 incident report says a veBTC issue had been fixed and that meta-transactions were disabled. Use current deployment state; do not build around old forwarding assumptions. This does not establish that unrelated MUSD permit flows are disabled. [Incident report](https://mezo.org/blog/incident-report-october-5-2026/)

## First-day decision gate

Before committing the concept:

1. Identify the remote gauge registry, voter, escrow, pool, and token contracts, including the deployed revision.
2. Prove that we can read at least one remote MUSD pool and its real gauge.
3. Produce size-dependent quotes from the destination venue with recorded block/time.
4. Establish a reproducible supported-chain path for a real vote. Record whether it is testnet, mainnet, or a local fork.
5. Confirm a judge can test the core flow without acquiring costly assets or trusting us with custody.
6. Check overlap with Mezoir and Matchbox, and validate the proposed problem with actual users.

If this cannot be established within one focused day, reduce scope or reconsider the concept. A local fork validates code but is not, by itself, the required public chain deployment.

## Options considered

| Direction | Assessment for our situation |
|---|---|
| Mezo Depth | Best current research lead: timely protocol extension and a documented information gap; deployment/demo access is the key uncertainty |
| MUSD subscriptions or payment links | Feasible, but directly overlaps several current projects |
| Borrowing guard / leveraged vault | Direct Mezo relevance, but crowded and substantially more security-sensitive |
| Generic x402 agent marketplace | Existing official integration support, past winner, and current competitors weaken differentiation |
| New lending market or cross-chain leverage engine | Too many unresolved financial and infrastructure dependencies for the initial deadline |

This is a qualitative product assessment, not an estimate of judges' scores.

## Execution schedule

| Date | Outcome |
|---|---|
| October 20 | Registration, Discord, exact deadline/KYB clarification, feasibility evidence |
| October 21 | Freeze the integration path and implement one complete transaction flow |
| October 22–23 | Pool adapter, allocation UI, error handling, and focused tests |
| October 24 | Public deployment and fresh-wallet walkthrough; target-user tests |
| October 25 | Deck, two-minute recording, README, and submission |
| October 26 | Buffer for fixes and confirmation that all materials are accessible |
| October 27–November 1 | Gather feedback and define the Wave 2 delta |
| November 2–13 | Implement the validated upgrades and repeat user testing |
| November 14 | Submit Wave 2 with explicit before/after evidence |
| November 15 | Final buffer |

### Two-minute demo

- 0–15 seconds: name the user and the specific allocation problem.
- 15–40 seconds: compare real MUSD liquidity and explain the data source.
- 40–75 seconds: construct and simulate an allocation, then execute on the stated network.
- 75–95 seconds: show the receipt and confirmed protocol state.
- 95–110 seconds: show one failure case handled correctly.
- 110–120 seconds: state the Wave 2 milestone and user-validation result.

Do not fabricate activity, TVL, revenue, APY, or adoption. Distinguish live execution, replayed footage, simulations, and roadmap work.

## Questions for the organizers

These are prepared questions, not messages sent on the user's behalf.

- Which current testnet deployments support remote MEZO gauges, including registry, voter, escrow, and incentive deposits?
- Can participants obtain a test veMEZO position suitable for a reproducible judge demo?
- Does the core team see destination-pool liquidity analysis and voting as a useful gap beyond the existing native interface?
- What is the exact Wave 1 deadline timezone?
- What verification documents are accepted for a solo individual under the stated KYB process?
- Where should the required track/deck/video fields go if the visible AKINDO form differs from the written instructions?

[Mezo Discord](https://discord.mezo.org), [October 13 kickoff recording](https://www.youtube.com/live/eAiaQpzvVE0)

No wallet was connected, no account was registered, no funds were moved, and no organizer or participant was contacted during this research.
