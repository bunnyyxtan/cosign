# Real-wallet acceptance checklist

**Status: IN PROGRESS with Rabby** (started 21 October 2026). Rows not yet run stay `NOT RUN`. The engineering session has no wallet extension, so no result below is a pass. Every row stays `NOT RUN` until a person completes it with a real browser wallet extension (see **Wallets under test**) and records what they saw. The test-only wallet shim used during development is **not** valid evidence and must not be used here.

The redesigned app on `feat/premium-site` (served at `/app/`) changes the layout, not the wallet or transaction flows, so every row below applies to it. Its transaction tray steps through Sign, Mining and Confirmed. When testing, also check that it reads **Confirmed** only once the explorer shows the transaction succeeded, and that action buttons stay disabled while a transaction is in flight.

Run it against the production build, so you test what judges will get:

```bash
cd web
npm ci
npm run build
npm run preview        # serves the production bundle at http://localhost:4173
```

Open the printed URL in a browser with the wallet extension. (Once hosted, use the public URL instead.)

## Wallets under test

| Priority | Wallet | Notes |
|---|---|---|
| 1 | **Rabby Wallet** (browser extension) | Primary. Run every row. |
| 2 | **OKX Wallet** (browser extension) | Alternative. At minimum run W, A, B1, B5, F3, F4 and F5; mark rows you don't run SKIP. |
| 3 | Another EVM wallet that supports custom networks | Only if neither works reliably on Mezo testnet. Record its name and version in the sign-off. |

Enable **only the wallet under test** in the browser's extension settings, except for rows W4 to W6, which test two wallets installed side by side.

**How the app finds the wallet.** The app uses the standard EIP-1193 provider that the extension injects at `window.ethereum`. It does not yet choose between several installed wallets. With Rabby and OKX both enabled, it talks to whichever one currently controls `window.ethereum`; both wallets have a setting for this. Rows W4 to W6 check the result. If the wrong wallet opens, engineering will add EIP-6963 wallet selection, which lets the app list installed wallets and talk to the one you pick.

### Mezo testnet network settings

Use these to add the network by hand if the app's add-network prompt fails (W1). They were checked against the live RPC on 21 October 2026, which returned `eth_chainId` `0x7b7b` and `net_version` `31611`.

| Field | Value |
|---|---|
| Network name | Mezo Testnet |
| Chain ID | 31611 (hex `0x7b7b`) |
| RPC URL | `https://rpc.test.mezo.org` |
| Currency symbol | BTC (18 decimals) |
| Block explorer | `https://explorer.test.mezo.org` |

## Before you start (about 20 minutes)

Use a **fresh test account** in the wallet. Never use an account that holds real funds.

| You need | How to get it (testnet only) |
|---|---|
| BTC for gas | Mezo testnet faucet. It has a CAPTCHA, so you complete it. |
| MEZO | Mezo testnet faucet. |
| MUSD | Open a small trove on Mezo testnet, **or** ask engineering to send testnet MUSD from the deployer wallet. Testnet tokens have no value. |
| A veBTC lock (for voting) | Lock about 0.001 testnet BTC in Mezo's veBTC contract from your own test wallet (two transactions: approve BTC, then create the lock). The deployer holds no veBTC on 21 October 2026, so there is none to transfer. |
| A funded rewards epoch (D4 only) | Anyone can fund the gauge with MEZO. Engineering can fund it from the deployer, with founder approval. Epochs last 10 minutes; distribution is permissionless once the epoch ends. |

Minimum for sections B to F: about 35 MUSD (20 cover, 10 lending, a little to repay interest) and 5 MEZO (collateral). Suggested: 50 MUSD and 10 MEZO. Gas is negligible: a heavy transaction costs about 0.00000000006 BTC at 21 October 2026 prices. The withdrawal notice period is 10 minutes.

## How to record a result

For each row, write PASS, FAIL or SKIP, the date, and one line on what you saw. For any FAIL, attach a screenshot and the transaction link from the toast. Mark a row PASS only if the **expected** column happened exactly.

## Walkthrough order for this build

The rows are grouped by feature; run them in this order so each step sets up the next and no transaction is repeated.

**Market state on 21 October 2026** (check the app before starting; it may have changed): Bold MEZO is under-covered by 13.24 MUSD, so its lender deposits are paused. Steady MEZO has no cover and no lenders.

1. **No-wallet profile:** A1, G1, G2, G3.
2. **Rabby only, before adding Mezo testnet:** A4 (the app adds the network), A7, A2, A5. Then W2 and W3.
3. **Cover first** (it reopens Bold for lending): C2, then C1 with 20 MUSD on Bold.
4. **Lending on Bold:** B3, B5, B2, B1, B4.
5. **Votes:** D2 (on Steady, where you hold no cover), D1 (on Bold), D3.
6. **Borrowing:** E1, E2, E3, E4, E5.
7. **Resilience:** F3, F2, F1, F4.
8. **Withdrawal notice:** C3, then C4 right away. Come back for C5 after the ready-at time shown in C3.
9. **Rewards:** D4 once the app shows a pending amount.
10. **Accounts and phone:** A6, A3, then F5 in the wallet's mobile in-app browser, if it has one (otherwise SKIP).
11. **Two wallets side by side:** W4, W5, W6.
12. **OKX Wallet:** add the network by hand (W1), then its minimum set.

For every transaction, record its hash from the tray and open it in the explorer. The tray must read **Confirmed** only after the explorer shows success.

If you are unsure whether a transaction went through, check the explorer or reload before sending it again. Never resend blind.

Engineering can send testnet MUSD, MEZO or a veBTC position from the deployer wallet, but only once the founder approves the transfer.

## Rabby results log

Only what the founder saw in a real Rabby browser extension at `http://localhost:4173/app/` (production build, live Mezo testnet). Nothing here comes from the development test wallet.

| Date | Observation | Rows | Evidence |
|---|---|---|---|
| 2026-10-21 | Connected Rabby to Cosign. Header shows `0xf080…9371`, the active Rabby account. | W2 PASS, A2 PARTIAL | Founder screenshot |
| 2026-10-21 | App shows "Mezo testnet · 31611" and live market data; no wrong-network banner. Not recorded: whether Rabby was already on Mezo testnet or the app switched it. | A4, A5 still NOT RUN | Founder screenshot |
| 2026-10-21 | Rabby shows 0.0500 testnet BTC. Not yet compared with the app's Positions page or the explorer. | W3 still NOT RUN | Founder report |
| 2026-10-21 | Browser console not yet inspected. | — | Pending |
| 2026-10-21 | **Bug:** after a refresh, Cosign showed the disconnected state although Rabby was still connected to the site. Cause: the app never asked the wallet for already-authorised accounts on startup. Fixed in commit `50d65d8`: the app restores the account with `eth_accounts` (no prompt), skips that after an explicit Disconnect, and handles late provider injection. 17 scripted scenarios pass with a stand-in provider; that is not Rabby evidence. | A8 FAIL before the fix; retest with Rabby pending | Founder report |

## W. Wallet setup and selection

| # | Steps | Expected | Result |
|---|---|---|---|
| W1 | Add Mezo testnet by hand using the network settings table, then open the app. | The wallet shows Mezo Testnet, chain 31611. The app shows no wrong-network banner. | NOT RUN |
| W2 | Connect, then compare the address in the app header with the wallet's active account. | The wallet under test opens its own prompt. Both show the same address. | PASS (Rabby, 2026-10-21): connected; header shows `0xf080…9371`, matching the active Rabby account. Founder screenshot. |
| W3 | Compare balances: MUSD and MEZO on the app's Positions page against the wallet and the explorer's token page for your address. | All three agree, allowing for display rounding. | NOT RUN |
| W4 | Enable Rabby and OKX Wallet together, with Rabby set as the default wallet. Reload and click Connect. | Rabby opens, not OKX, and the app shows the Rabby account. Write down which wallet opened. | NOT RUN |
| W5 | Same, with OKX Wallet set as the default (Rabby's default-wallet switch off). Reload and click Connect. | OKX Wallet opens and the app shows the OKX account. If the other wallet opens, both open, or neither opens, mark FAIL and tell engineering. | NOT RUN |
| W6 | With both enabled and connected, change which wallet is the default, then reload. | The app shows one account only, from the wallet now in control. Positions never mix accounts. | NOT RUN |

## A. Connect, network, accounts

| # | Steps | Expected | Result |
|---|---|---|---|
| A1 | Open the app in a browser **without** a wallet extension. Click Connect wallet. | A clear message that no browser wallet was found. The website replay and the app's Recorded evidence page still work. | NOT RUN |
| A2 | With the wallet installed, click Connect wallet. | Wallet asks for permission, then the header shows your short address and Disconnect. | PARTIAL (Rabby, 2026-10-21): Rabby connected and the header shows the short address. The Disconnect button is checked in A3. |
| A3 | Click Disconnect, then reload. | Header returns to Connect wallet and no positions are shown. After the reload it stays disconnected, even if the wallet still lists the site as connected. Connect works again afterwards. | NOT RUN |
| A8 | While connected, reload the page; then close the tab and open the URL in a new tab. | Both times the same account is back without any wallet prompt, read from the wallet (`eth_accounts`). The header and Positions match the wallet. | NOT RUN |
| A4 | Remove Mezo testnet from the wallet, then Connect. | Wallet offers to add the network (chain 31611, RPC `rpc.test.mezo.org`, symbol BTC). Approve. | NOT RUN |
| A5 | Switch the wallet to another network (for example Ethereum). | A red banner says the wallet is on another network, with a Switch button. Switch works. | NOT RUN |
| A6 | Switch to a second account in the wallet while on a market page. | Positions update to the new account. The old account's numbers never show. | NOT RUN |
| A7 | Reject the connect or network request in the wallet. | A plain message ("You rejected the request in your wallet."). No crash. | NOT RUN |

## B. Lending (senior)

| # | Steps | Expected | Result |
|---|---|---|---|
| B1 | Open a market that is **not** under-covered (post cover first in C2 if both are). Enter 10 MUSD and deposit. | Approve MUSD, then deposit. Each step shows "confirm in your wallet", then "waiting", then "done" with a transaction link. Your lender balance updates. | NOT RUN |
| B2 | In the approval prompt, lower the spending cap below the deposit and confirm. | The app says the approved amount is too low and does not continue. | NOT RUN |
| B3 | Try to deposit more than the market's room to lend. | A plain message that there is not that much room. No funds move. | NOT RUN |
| B4 | Withdraw part, then all, of your lender balance. | Balance updates. If the Morpho market has too little unborrowed MUSD, a plain "not enough unborrowed MUSD" message appears. | NOT RUN |
| B5 | Enter a deposit larger than your MUSD balance. | The field is flagged with your wallet balance and the button is disabled. Nothing is sent to the wallet. | NOT RUN |

## C. Cover (junior) and withdrawal notice

| # | Steps | Expected | Result |
|---|---|---|---|
| C1 | Co-sign page, Bold: post 20 MUSD cover. | Approve, then deposit. "Your cover" shows about 20. | NOT RUN |
| C2 | Check "Opens room for up to…" before posting. | Shows 19 × the amount for Bold, 9 × for Steady. | NOT RUN |
| C3 | Click Request to withdraw all cover. | A ready-at time appears. Your cover still shows and still pays losses until then. | NOT RUN |
| C4 | Before the time passes, try to withdraw (use the wallet's contract interaction or reload and look for the button). | The Withdraw button is absent. If reachable, a plain "notice period has not ended" message. | NOT RUN |
| C5 | After the time passes, click Withdraw cover. | Cover returns to your wallet. If it would drop the market below minimum cover, a plain message says so and nothing moves. | NOT RUN |

## D. Voting and rewards

| # | Steps | Expected | Result |
|---|---|---|---|
| D1 | Vote your veBTC position for a market where you hold cover. | Vote succeeds. Effective weight is the smaller of your votes and the market's cover cap. | NOT RUN |
| D2 | Try to vote for a market where you hold **no** cover. | A plain "post cover on a market before voting for it" message. | NOT RUN |
| D3 | Vote twice in one epoch with the same position. | A plain "already voted this epoch" message. | NOT RUN |
| D4 | When rewards are available, click Claim. | MEZO arrives in the wallet. Pending drops to about 0. A second claim pays nothing. | NOT RUN |

## E. Borrowing

| # | Steps | Expected | Result |
|---|---|---|---|
| E1 | Add 5 MEZO as collateral on a market. | Approve MEZO, then supply. Collateral shows 5. | NOT RUN |
| E2 | Borrow a small amount of MUSD. | MUSD arrives. LTV shown is below the market limit. | NOT RUN |
| E3 | Try to borrow beyond the limit. | The transaction is refused with a readable message. Nothing moves. | NOT RUN |
| E4 | Repay in full. | Debt returns to 0. | NOT RUN |
| E5 | Withdraw your collateral. | MEZO returns to the wallet. | NOT RUN |

## F. Resilience

| # | Steps | Expected | Result |
|---|---|---|---|
| F1 | Start a transaction, confirm it, then reload the page immediately. | After reload, balances are correct once the transaction lands. No duplicate transaction. | NOT RUN |
| F2 | Throttle the network (browser dev tools, "Slow 3G") and run any transaction. | The toast stays on "waiting" until the receipt arrives. It does not report a false failure for a transaction that succeeded. | NOT RUN |
| F3 | Reject a transaction in the wallet. | A plain rejection message. The form is still usable. | NOT RUN |
| F4 | Spend nearly all gas BTC, then try a transaction. | The wallet or app reports insufficient gas in plain words. No stuck spinner. | NOT RUN |
| F5 | Open the app on a phone in the wallet's built-in browser, if its mobile app has one (otherwise SKIP). | Layout fits the screen with no sideways scroll. Connect and one transaction work. | NOT RUN |

## G. Understanding (for a first-time visitor)

| # | Steps | Expected | Result |
|---|---|---|---|
| G1 | Ask someone who has not seen Cosign to open the first page with no wallet and explain it back in their own words after 15 seconds. | They say cover pays losses first. | NOT RUN |
| G2 | Replay the recorded loss and open its explorer link. | The transaction opens in the Mezo explorer and matches the numbers shown. | NOT RUN |
| G3 | Find the limits without leaving the page. | They can say that cover can leave, that the deposit cap is not a borrowing cap, and that the price comes from a demo oracle. | NOT RUN |

## Sign-off

| Tester | Wallet and version | Browser | Date | Overall |
|---|---|---|---|---|
| | Rabby, version: | | | NOT RUN |
| | OKX Wallet, version: | | | NOT RUN |

Do not describe browser-wallet flows as verified anywhere (README, pitch, submission) until sections W and A to F are filled in with real results.
