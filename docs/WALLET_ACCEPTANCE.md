# Real-wallet acceptance checklist

**Status: BLOCKED. Not run.** The engineering session has no wallet extension, so no result below is a pass. Every row stays `NOT RUN` until a person completes it with MetaMask (or another EIP-1193 wallet) and records what they saw. The test-only wallet shim used during development is **not** valid evidence and must not be used here.

The redesigned app on `feat/premium-site` (served at `/app/`) changes the layout, not the wallet or transaction flows, so every row below applies to it. Its transaction tray steps through Sign, Mining and Confirmed. When testing, also check that it reads **Confirmed** only once the explorer shows the transaction succeeded, and that action buttons stay disabled while a transaction is in flight.

Run it against the production build, so you test what judges will get:

```bash
cd web
npm ci
npm run build
npm run preview        # serves the production bundle at http://localhost:4173
```

Open the printed URL in a browser with the wallet extension. (Once hosted, use the public URL instead.)

## Before you start (about 20 minutes)

Use a **fresh test account** in the wallet. Never use an account that holds real funds.

| You need | How to get it (testnet only) |
|---|---|
| BTC for gas | Mezo testnet faucet. It has a CAPTCHA, so you complete it. |
| MEZO | Mezo testnet faucet. |
| MUSD | Open a small trove on Mezo testnet, **or** ask engineering to send testnet MUSD from the deployer wallet. Testnet tokens have no value. |
| A veBTC lock (for voting) | Lock a little testnet BTC in Mezo's veBTC lock page, **or** ask engineering to transfer a testnet veBTC position to your account. |

Suggested amounts: 150 MUSD, 20 MEZO, a few cents of testnet BTC for gas.

## How to record a result

For each row, write PASS, FAIL or SKIP, the date, and one line on what you saw. For any FAIL, attach a screenshot and the transaction link from the toast. Mark a row PASS only if the **expected** column happened exactly.

## Walkthrough order for this build

The rows are grouped by feature; run them in this order so each step sets up the next and no transaction is repeated.

**Market state on 21 October 2026** (check the app before starting; it may have changed): Bold MEZO is under-covered by 13.24 MUSD, so its lender deposits are paused. Steady MEZO has no cover and no lenders.

1. **No-wallet profile:** A1, G1, G2, G3.
2. **Wallet profile, before adding Mezo testnet:** A4, A7, A2, A5.
3. **Cover first** (it reopens Bold for lending): C2, then C1 with 20 MUSD on Bold.
4. **Lending on Bold:** B3, B2, B1, B4.
5. **Votes:** D2 (on Steady, where you hold no cover), D1 (on Bold), D3.
6. **Borrowing:** E1, E2, E3, E4, E5.
7. **Resilience:** F3, F2, F1, F4.
8. **Withdrawal notice:** C3, then C4 right away. Come back for C5 after the ready-at time shown in C3.
9. **Rewards:** D4 once the app shows a pending amount.
10. **Accounts and phone:** A6, A3, then F5 in the wallet's built-in browser.

For every transaction, record its hash from the tray and open it in the explorer. The tray must read **Confirmed** only after the explorer shows success.

If you are unsure whether a transaction went through, check the explorer or reload before sending it again. Never resend blind.

Engineering can send testnet MUSD, MEZO or a veBTC position from the deployer wallet, but only once the founder approves the transfer.

## A. Connect, network, accounts

| # | Steps | Expected | Result |
|---|---|---|---|
| A1 | Open the app in a browser **without** a wallet extension. Click Connect wallet. | A clear message that no browser wallet was found. The website replay and the app's Recorded evidence page still work. | NOT RUN |
| A2 | With the wallet installed, click Connect wallet. | Wallet asks for permission, then the header shows your short address and Disconnect. | NOT RUN |
| A3 | Click Disconnect. | Header returns to Connect wallet. No positions shown. Reloading does not reconnect silently. | NOT RUN |
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
| F5 | Open the app on a phone with the wallet's built-in browser. | Layout fits the screen with no sideways scroll. Connect and one transaction work. | NOT RUN |

## G. Understanding (for a first-time visitor)

| # | Steps | Expected | Result |
|---|---|---|---|
| G1 | Ask someone who has not seen Cosign to open the first page with no wallet and explain it back in their own words after 15 seconds. | They say cover pays losses first. | NOT RUN |
| G2 | Replay the recorded loss and open its explorer link. | The transaction opens in the Mezo explorer and matches the numbers shown. | NOT RUN |
| G3 | Find the limits without leaving the page. | They can say that cover can leave, that the deposit cap is not a borrowing cap, and that the price comes from a demo oracle. | NOT RUN |

## Sign-off

| Tester | Wallet and version | Browser | Date | Overall |
|---|---|---|---|---|
| | | | | NOT RUN |

Do not describe browser-wallet flows as verified anywhere (README, pitch, submission) until section A to F are filled in with real results.
