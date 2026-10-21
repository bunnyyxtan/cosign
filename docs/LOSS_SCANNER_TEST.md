# Loss-event scanner: stress test

**What changed.** On 21 October 2026, Mezo's testnet RPC rejected `eth_getLogs` ranges wider than 10,000 blocks ("maximum [from, to] blocks distance: 10000"). The app's 50,000-block windows failed, and the error was caught as an empty list, so market pages showed "No losses yet" despite two recorded losses.

**The fix.** `loadLosses` in `web/src/chain.ts` now scans 10,000-block windows from the deployment block, four in parallel. The app keeps loading, failure and empty as three distinct states:

- "Reading loss events from Mezo testnet…" while the scan runs.
- "Could not read loss events from Mezo testnet. Reload the page to try again." if it fails.
- "No losses yet" only after a successful scan finds none.

The overview omits "Last loss" until losses are known. If the read fails, each market card says that its loss history is unavailable.

**How it was tested.** Production build (`vite preview`), each scenario in a fresh browser context with no cache. Every `eth_getLogs` request to `rpc.test.mezo.org` was intercepted, and the Losses panel on Bold MEZO was sampled every 500 ms. The viem transport retries a failed request four times with exponential backoff.

| Scenario | What the panel showed, in order | Final | Shown "No losses yet" at any point |
|---|---|---|---|
| S1 Cold load, healthy RPC | loading → 2 losses | 2 rows | no |
| S2 Every `getLogs` delayed 4 s | loading → 2 losses | 2 rows | no |
| S3 First attempt of each window fails (HTTP 503) | loading → 2 losses (retried) | 2 rows | no |
| S4 Random 40% of requests fail (HTTP 502) | loading → 2 losses (retried) | 2 rows | no |
| S5 RPC rejects the range (JSON-RPC −32602) | loading → read error after 5 attempts | error | no |
| S6 Logs endpoint down (HTTP 503 always) | loading → read error after 5 attempts | error | no |
| S7 Five reloads mid-scan, then settle | loading → 2 losses on every load | 2 rows | no |
| S8 Held 35 s across two 15 s refreshes | 2 losses throughout, no flicker | 2 rows | no |
| S9 Markets overview with logs down | "Loss history unavailable" on each card | error note | no |

**Coverage.** Every run used windows of at most 10,000 blocks. The first window started at the deployment block (16,261,540) and there were no gaps between windows, including when the chain head advanced during S7. No load produced duplicate rows.

**Known limits.**

- A failed scan is not retried automatically; the user reloads.
- Scan time grows by one request per 10,000 blocks: a few seconds today. Beyond a few hundred windows the app should index from a known checkpoint instead.
