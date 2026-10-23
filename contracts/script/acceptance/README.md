# Real-wallet session checkers

Read-only scripts used during the real-wallet acceptance sessions recorded in [`docs/WALLET_ACCEPTANCE.md`](../../../docs/WALLET_ACCEPTANCE.md). A person signed every transaction in Rabby; the checker watched the wallet's address and, as each transaction landed, matched it onchain against the agreed manifest (target contract, exact calldata or amounts, receipt, token transfers, resulting balances) and stopped on any deviation. They **hold no keys, sign nothing and send nothing**; every call is a read.

| Script | Session | Transactions |
|---|---|---|
| `borrow-session.mjs` | Borrow, repay, withdraw collateral | 5 |
| `lending-session.mjs` | Lender deposit and withdrawals, partial cover withdrawal | 6 |
| `rewards-session.mjs` | veBTC lock, vote, fund, distribute, claim | 7 |
| `steady-session.mjs` | Activate Steady: approve and post 5 MUSD cover, approve and lend 10 MUSD | 4 |

They are **journey-specific**: each encodes one manifest and the starting state of the test wallet (`0xF080…9371`) at the time, and refuses to start if that state differs. They are kept as a record of how the evidence was produced, not as a general framework.

```bash
# needs Foundry's `cast` on PATH (or CAST=/path/to/cast) and Node 20+
node borrow-session.mjs selftest     # reads the chain, checks the checker against a real transaction
node borrow-session.mjs run          # waits for the manifest's transactions and verifies each as it lands
```

`WATCH_RPC` points them at another RPC (the default is `https://rpc.test.mezo.org`). `WATCH_WAIT_BASELINE=1` and, for the rewards script, `WATCH_TOKEN=<id>` exist for rehearsing on a local fork; rehearsals on a fork are simulations and are never counted as wallet evidence.
