# Claude handoff: prove the integration before building the product

Read `MEZO_BUILDATHON_RESEARCH.md` in this directory first. Research date: October 20, 2026.

We are a solo founder building a new project for the Mezo Buildathon. The proposed working name is **Mezo Depth**. The concept is provisional until this feasibility task passes.

Product hypothesis: veMEZO holders need destination-pool liquidity context when allocating MEZO emissions to remote MUSD pools. Provide evidence, let the user choose an allocation, execute a real protocol vote, and explain the resulting state.

The first assignment is a working integration spike, not a landing page.

## Deliverable

Create a concise integration report plus the smallest reproducible script demonstrating:

1. A verified real MUSD pool on a supported destination chain.
2. That pool's remote MEZO gauge and relevant on-chain registry.
3. Current voter/escrow addresses, chain IDs, deployed code, ABI, and any permissions needed.
4. A real pool quote or the venue's supported quote mechanism at multiple stated sizes.
5. Eligibility checks for an active veMEZO position and the current voting window.
6. Simulation of the correct vote call, and a clearly documented route to test it on a public supported chain.

Do not invent contract addresses, signatures, token balances, permissions, or testnet availability. Start with official deployed artifacts and contract references. Compare their ABIs with the deployed revision. Record source URLs and the verification date.

If remote gauges are absent from official testnet, make that a visible blocking finding for this concept. A locally deployed mock or fork can help investigate but must not be represented as the official public integration or as satisfaction of the deployment requirement.

Mainnet reads are useful; do not require real-money deposits or locked funds merely to make the demo appear complete. Ask the founder for any wallet action that is actually needed.

## Evidence to return

Provide `integration-findings.md` with:

- An address table: network, chain ID, contract role, address, evidence URL, deployed revision.
- Commands to reproduce the read-only queries and simulations.
- Quote output with input/output token decimals, block/time, venue fees, and failure conditions.
- Voting requirements, relevant epoch restrictions, and what changes after confirmation.
- Supported testnet status and exact remaining prerequisites.
- A go/no-go recommendation with the smallest credible Wave 1 scope.

The spike succeeds only if it establishes a plausible end-to-end live integration. Attractive mock data is not a substitute.

## Proposed implementation after the gate passes

- TypeScript web frontend; use a familiar React framework and viem/wagmi if compatible.
- A small, explicitly allowlisted deployment configuration for each network.
- Read adapters for destination pools; start with one venue.
- A transaction preparation layer that validates the chain, selected lock, gauge addresses, allocation, eligibility, and current epoch before simulation.
- Direct calls to existing verified contracts where practical. New Solidity must justify its necessity.
- Data freshness indicators, exact units, pending/rejected/reverted states, and explorer links.
- No custody, arbitrary-call executor, unconstrained approvals, custom bridge, or autonomous financial agent in the initial scope.

Mezo testnet uses chain ID 31611; mainnet uses 31612. Native gas is BTC with 18 decimals on Mezo. Confirm current compiler/EVM requirements from the developer documentation.

## Product constraints

The main flow is:

`Inspect MUSD liquidity → choose vote allocation → review/simulate → sign → verify confirmed state`

Distinguish incentives earned by the voter from emissions directed toward the pool. Do not promise a future APR or liquidity improvement. Separate the user's own reward objective from the objective of supporting MUSD liquidity.

Do not infer usability from TVL alone. Executable quotes depend on size, pool structure, fees, and liquidity distribution. Keep spot-price deviation, price impact, venue fees, and gas separate.

Treat data as unavailable when a query fails. Never replace a failed live query with synthetic values in the normal product path.

## Verification

Test the failure cases that matter: wrong network, stale quotes, decimals, invalid gauges, inactive lock, already-used epoch action, closed window, rejected signature, reverted simulation, and a pending transaction.

If new contracts hold or route funds, test authorization, accounting, recovery paths, and inappropriate recipients. AI-generated contracts are not “audited” because tests pass.

The judge walkthrough must start from a clean browser and explain where test assets come from. Clearly label any mainnet market data displayed beside testnet actions.

## Buildathon output

Wave 1 requires a working public deployment, public repository, deck, two-minute video, and completed AKINDO submission. Internal submission target: October 25. The published closing date is October 26; confirm the exact time and timezone.

Wave 2 should add validated integrations, incentive execution if supported, epoch reporting, and evidence of user feedback. Avoid committing to a long roadmap before the first transaction works.

## Primary references

- [Buildathon](https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10)
- [MEZO Gauges](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/)
- [Voting behavior](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/how-to-vote/)
- [Reward paths](https://mezo.org/docs/users/mezo-earn/vote/mezo-gauges/claiming-incentives/)
- [Contract reference](https://mezo.org/docs/users/resources/contracts-reference)
- [Developer setup](https://mezo.org/docs/developers/getting-started/)
- [Mezo GitHub](https://github.com/mezo-org/)
- [Recent incident and forwarding changes](https://mezo.org/blog/incident-report-october-5-2026/)
