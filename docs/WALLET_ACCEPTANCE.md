# Real-wallet acceptance checklist

**Status, 23 October 2026: PARTIAL.** Real-wallet acceptance with **Rabby** is under way: **12 rows PASS, 4 PARTIAL, 25 NOT RUN, none failed.** A row is PASS only when a person completed it in a real browser-wallet extension and the result was checked against the chain; PARTIAL means part of the expected result is evidenced; NOT RUN means nothing is claimed. Scripted browser runs, simulations on a local fork and the development wallet shim are **never** counted as wallet evidence, and are labelled as simulations in the log. OKX Wallet has not been run. The log of every session, with transaction hashes and before/after balances, is the table titled **Rabby results log** below.

The checklist applies to the current app (served at `/app/`). Since 23 October 2026 transactions are shown as notices: "Confirm in your wallet" while signing, "Sent. Waiting for Mezo testnet" until the receipt, then "Confirmed in block …" once the figures are re-read. A success hides itself after about 6 seconds and stays in **Activity** (the icon next to your address); a failure stays until you close it. When testing, also check that a notice reads **Confirmed** only once the explorer shows the transaction succeeded, and that action buttons stay disabled while a transaction is in flight. An approval stops at "MUSD approved. Next: …"; the form's button then reads "Deposit …" (or the matching action), and the action is a separate click.

**Rows marked PASS before 23 October were recorded on the earlier interface.** The redesign changed layout, wording and notices, not the transactions: contract calls, arguments, approvals and withdrawal rules are the same. The new interface has been exercised only with simulated wallets and a local fork so far; re-run A2, A3, A8, B1 and C3 in Rabby to confirm it.

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

**How the app finds the wallet.** Cosign's wallet dialog lists the wallets the browser announces through EIP-6963 and talks only to the one you pick: account reads, network switching and transaction signing all go through that wallet's own provider. It falls back to `window.ethereum` only when no wallet announces itself. It remembers which wallet you picked (not your address) so a reload restores through the same wallet. Rows W4 to W6 check this with real extensions.

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

For every transaction, record its hash from the notice or from Activity and open it in the explorer. A notice must read **Confirmed** only after the explorer shows success.

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
| 2026-10-21 | New wallet dialog (EIP-6963 selection) replaces the direct Connect button. 46 scripted checks with two stand-in wallets pass, including Rabby being used while OKX controls `window.ethereum`; that is not Rabby evidence. Rows A1, A2, A7 and W4 to W6 now describe the dialog. | Retest A2, A3, A7, A8 and W4 to W6 with Rabby | Scripted only |
| 2026-10-21 | Refresh restored the authorised Rabby account with no popup. Explicit Disconnect stayed disconnected after a refresh. | A8 PASS, A3 PARTIAL | Founder, real Rabby extension |
| 2026-10-21 | UX note for later: clicking the connected address showed the wallet list instead of account management. Not reproduced with a stand-in wallet (after a fresh connect, after a reload restore and on Positions, the address opened "Your wallet"); exact steps needed. | Open issue, not fixed | Founder report |
| 2026-10-21 | Founder-approved funding: the deployer sent exactly 50 MUSD to the test wallet `0xF080…9371`. Tx [`0xa54aa30f…f7d1`](https://explorer.test.mezo.org/tx/0xa54aa30f7d17de22321acf6fee1b9ac7b351020b8bddaf20d36880f31ab7f7d1), block 16,281,236, status success. MUSD before → after: deployer 360.60 → 310.60, test wallet 0 → 50.00. The test wallet already held 100 MEZO (not from the deployer) and 0.05 BTC. | Funding, not a test row | Chain reads |
| 2026-10-21 | Cosign's Positions page, for the test wallet's address, reads MUSD 50.00, MEZO 100.0000, BTC 0.050000 and 0 veBTC, matching the chain. Read through a stand-in that only reports the address, so this is not Rabby evidence. | W3 still needs the founder's Rabby and explorer comparison | Scripted read |
| 2026-10-21 | Positions page in Rabby: 50.00 MUSD, 100.0000 MEZO, 0.050000 BTC, zero positions for `0xF080…9371`. | W3 PARTIAL | Founder screenshot, real Rabby |
| 2026-10-21 | **Rabby evidence.** Cosign's tray read "Approve MUSD: Confirmed in block 16283159", then "Post cover: Confirmed in block 16283162". The plan was to reject the deposit prompt after the approval; the deposit was signed in Rabby as well. Right after the second toast, the Bold card still showed 39.40 cover and UNDER-COVERED. | C1 PARTIAL; F3 not exercised | Founder screenshots, real Rabby |
| 2026-10-21 | **On-chain verification (engineering).** Approve [`0x41166d3a…117c`](https://explorer.test.mezo.org/tx/0x41166d3ac8f74df3d2fd354c2e84bc1818e25baa01f440bd71c3a18881cb117c): status success, block 16,283,159, nonce 0, Approval(owner `0xF080…9371`, spender Bold vault `0x49C8…7D7`, 20 MUSD). Deposit [`0xc7941ccb…8588`](https://explorer.test.mezo.org/tx/0xc7941ccb9f1b4a2a17b3c1e2479a780a907dc16bcdf789efa9ec4d2db2fc8588): status success, block 16,283,162, nonce 1, `depositJunior(20 MUSD)`, Transfer of 20 MUSD to the vault, Morpho Supply of 20 MUSD, JuniorDeposited(20 MUSD, 203,045,959.5 × 10¹⁸ shares, round 0). The wallet nonce is 2 with nothing pending, so there was no duplicate. After: wallet 30.00 MUSD; allowance to Bold 0; your cover 19.999999999999999999 MUSD (33.67% of shares); Bold cover 59.3999 MUSD; lenders 1,000.000053 (unchanged); minimum 52.6316, so covered; room for lenders 128.5989 MUSD. | Verification, not a test row | Chain reads |
| 2026-10-21 | A fresh load of Cosign shows Bold "Open to lenders", your cover 20.00, market cover 59.40 and wallet 30.00 MUSD. Whether the already-open tab updated by itself is not yet known. After a receipt the app shows "Confirmed" at once, then re-reads once the RPC reaches the next block, again 5 s later, and every 15 s; the old figures in the meantime are a known gap. | Open issue: post-transaction UI sync | Scripted read |
| 2026-10-21 | Fixed in `f82a342`. After a receipt the tray reads "Confirmed onchain · updating balances…" and a banner says the figures are from before the transaction, until reads at or after the receipt's block land. If they fail, the tray keeps "Confirmed in block N" and says not to send again. Approvals stop at "Allowance approved — ready to deposit", with a separate button for the action. 39 scripted checks pass on a local fork of Mezo testnet (the MEZO precompile stubbed on the fork only); that is not Rabby evidence. | Sync issue fixed pending Rabby retest | Scripted, local fork |
| 2026-10-21 | Without a manual refresh, the open Co-sign tab caught up: Bold OPEN TO LENDERS, your cover 20.00, market cover 59.40. The live refresh works; only the stale window right after "Confirmed" was the problem. | C1 PASS | Founder, real Rabby |
| 2026-10-21 | **Rabby evidence.** Lending Stage A on the new build: Bold Lend tab, 10 MUSD, Deposit. Rabby showed one approval; after it confirmed, Cosign showed "Approve MUSD: Allowance approved — ready to deposit" with a separate "Deposit 10.00 MUSD" button. No second wallet prompt opened. | Two-step approval confirmed with a real wallet | Founder screenshot, real Rabby |
| 2026-10-21 | **On-chain verification (engineering).** Approve [`0x9a47c299…6be8`](https://explorer.test.mezo.org/tx/0x9a47c299ea301c00589a475148b12acc1517be26e4906112ea43517507ba6be8): status success, block 16,284,603, nonce 2, 46,394 gas, Approval(owner `0xF080…9371`, spender Bold vault, 10 MUSD). Afterwards: allowance to Bold exactly 10 MUSD; wallet still 30.00 MUSD; lending 0 and Bold lenders unchanged at 1,000.0001, so no deposit was sent; nonce 3 with nothing pending. | Verification, not a test row | Chain reads |
| 2026-10-23 | **Rabby evidence.** Lending Stage B: Deposit 10 MUSD on Bold with the existing allowance. One Rabby prompt; Mezo Explorer shows SUCCESS at block 16,313,941, 10 MUSD from the test wallet to Bold and on to Morpho. Cosign Positions afterwards: wallet MUSD 20.00, Bold lending 10.00, Bold cover 20.00, wallet MEZO 100.0000, borrow shares 0. | B1 PASS | Founder screenshots (Cosign and explorer), real Rabby |
| 2026-10-23 | **On-chain verification (engineering).** Deposit [`0x128ccab0…76c8`](https://explorer.test.mezo.org/tx/0x128ccab0c6c399aefeae82be615e199c7651d19bf876d097d579c4af6e2276c8): status success, block 16,313,941, nonce 3, 180,667 gas, `depositSenior(10 MUSD)`. Events: MUSD Transfer wallet → vault 10; Morpho Supply 10 (vault on behalf); MUSD Transfer vault → Morpho 10; SeniorDeposited(10 MUSD, 9,999,999.4679 × 10¹⁸ shares). Afterwards: lender shares 9,999,999.4679 × 10¹⁸ of 1,009,999,999.4679 (0.99%), worth 9.999999999999999999 MUSD (share price 1.0000000532); wallet 20.00 MUSD; allowance to Bold 0; Bold lenders 1,010.0001, cover 59.3999 (unchanged), room 118.5989, not under-covered; nonce 4, nothing pending. The wallet has sent four transactions in total (approve, cover deposit, approve, lender deposit) and no duplicates. | Verification, not a test row | Chain reads |
| 2026-10-23 | **Compatibility note, for later review.** Rabby showed "Simulation Not Supported / Unknown Signature Type" on a Cosign vault transaction. The transaction itself worked. Likely causes, not yet confirmed: Rabby has no simulation or decoding for Mezo testnet or for this unverified contract. Not a Cosign defect so far. To review: verify the vault contracts on Mezo Explorer so their ABIs are public, then recheck what Rabby shows; also check the same screen in OKX Wallet. | Open, non-blocking | Founder report |
| 2026-10-23 | **Borrowing plan, prepared and not authorized.** Bold market, Morpho: LLTV 77%, fixed 12% APR, demo oracle 10 MUSD per MEZO, 1,069.4 MUSD supplied and 0 borrowed. Test wallet: 100 MEZO, 20 MUSD, no position. Proposed amounts: 5 MEZO collateral (worth 50 MUSD, borrow limit 38.50 MUSD), borrow 10 MUSD (20% LTV). Sequence, one wallet prompt each, a separate authorization for each: (1) approve 5 MEZO to Morpho, (2) supply 5 MEZO collateral, (3) borrow 10 MUSD, (4) approve about 10.01 MUSD to Morpho, (5) repay in full, (6) withdraw the 5 MEZO. | E1 to E5 NOT RUN | Plan |
| 2026-10-23 | **Rabby evidence.** Borrowing Stage 1: Bold Borrow tab, Add collateral 5 MEZO. Rabby showed the approval; Mezo Explorer shows SUCCESS at block 16,314,082; Cosign then showed "Allowance approved — ready to add collateral" with a separate "Add collateral" button, and no second wallet prompt. | E1 step 1 of 2 only; E1 stays NOT RUN until collateral is supplied | Founder screenshots, real Rabby |
| 2026-10-23 | **On-chain verification (engineering).** Approve [`0x1ffa2d7e…8e8e`](https://explorer.test.mezo.org/tx/0x1ffa2d7ead074c50fa90b4d13958697dca6911e02374112500ef336dc19a8e8e): status success, block 16,314,082, nonce 4, 25,552 gas, to MEZO `0x7B7c000000000000000000000000000000000001`, value 0, calldata identical to the expected `approve(Morpho, 5e18)`. Approval(owner `0xF080…9371`, spender Morpho `0xC6db4999d8428b259FD198A88d2B8E6494045A48`, 5 MEZO). Afterwards: allowance exactly 5 MEZO; wallet still 100 MEZO and 20 MUSD; Morpho position on Bold 0 / 0 / 0 (no collateral); market unchanged (1,069.4 MUSD supplied, 0 borrowed); nonce 5, nothing pending, no duplicate. | Verification, not a test row | Chain reads |
| 2026-10-23 | **Borrowing session manifest, awaiting ONE scoped founder authorization.** Five wallet prompts, in order, each inspected and signed by the founder in Rabby; each verified onchain by a read-only checker before the next. Network 31611. Morpho `0xC6db4999d8428b259FD198A88d2B8E6494045A48`, MEZO `0x7B7c000000000000000000000000000000000001`, MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, market id `0x872e50f5…5d3b`. (1) Morpho `supplyCollateral`, 5 MEZO, using the existing 5 MEZO allowance. (2) Morpho `borrow`, exactly 10 MUSD (0 shares), to the founder. (3) MUSD `approve(Morpho)`, about 10.01 MUSD, ceiling 10.02. (4) Morpho `repay` by shares (assets 0, shares = the whole borrow position, 10^25), which clears the debt exactly. (5) Morpho `withdrawCollateral`, 5 MEZO. Stop on any difference in address, calldata, amount, network, oracle price or balances. | Plan | Plan |
| 2026-10-23 | **Simulation (local fork, not real-wallet evidence).** The whole borrowing journey was rehearsed through the real UI on a local fork of Mezo testnet, with a stand-in wallet and a scratch ERC20 replacing the MEZO precompile on the fork only: 19/19 checks passed, including byte-exact calldata for all five prompts, borrow shares exactly 10^25, repayment of the 10.01 MUSD bounded approval plus interest, and exactly five wallet prompts with no automatic chaining. The read-only session checker verified all five steps on the fork, rejected a dirty starting state, and halted on a deliberately wrong 4 MEZO supply. | None (automation) | Scripted, local fork |
| 2026-10-23 | **Borrowing journey complete (real Rabby, one scoped authorization).** Five transactions, each signed by the founder and verified onchain before the next: (1) supplyCollateral [`0x36b96b80baf3c35450a320d3aa9004b91b65f8b6abfd1cad1797728a91c74bab`](https://explorer.test.mezo.org/tx/0x36b96b80baf3c35450a320d3aa9004b91b65f8b6abfd1cad1797728a91c74bab), block 16,314,582, nonce 5, 58,606 gas; (2) borrow [`0x03d16f343ca760e7c4d8fbcf5eb33aaab4e05db797d8a656797820504f075113`](https://explorer.test.mezo.org/tx/0x03d16f343ca760e7c4d8fbcf5eb33aaab4e05db797d8a656797820504f075113), block 16,314,589, nonce 6, 100,897 gas; (3) approve MUSD [`0x13185c8c0d75923a5e6663627264b0e191f73c39cb5d1b3c814d1002ac7e59d2`](https://explorer.test.mezo.org/tx/0x13185c8c0d75923a5e6663627264b0e191f73c39cb5d1b3c814d1002ac7e59d2), block 16,314,599, nonce 7, 46,406 gas; (4) repay by shares [`0x200e44cee58cada8753fd94cb68a9459413e2399c6a69cf253f6a5cc2ec9c83c`](https://explorer.test.mezo.org/tx/0x200e44cee58cada8753fd94cb68a9459413e2399c6a69cf253f6a5cc2ec9c83c), block 16,314,603, nonce 8, 79,242 gas; (5) withdrawCollateral [`0x2ae0e4f9c997cdc21d5da47bfbf71b72103ea469a7d228cd10c434cb49be320c`](https://explorer.test.mezo.org/tx/0x2ae0e4f9c997cdc21d5da47bfbf71b72103ea469a7d228cd10c434cb49be320c), block 16,314,610, nonce 9, 54,217 gas. Calldata matched the manifest byte for byte each time. Before → after: MEZO 100.00 → 100.00; MUSD 20.00 → 19.999997793 (interest paid 0.00000221 MUSD); collateral 0 → 0; borrow shares 0 → 0; allowance to Morpho: MEZO 5 → 0, MUSD 0 → 0.009997793 (residual). Peak: collateral 5.00, debt 10.000000, LTV 20.0%. Nonce 10, nothing pending. Morpho market back to 0 borrowed (1,069.4 supplied); oracle unchanged; Bold not under-covered; your lending 10.0000000155 and cover 20.0000002167 (the borrow interest accrued to the tranches). | E1, E2, E4, E5 PASS; E3 NOT RUN | Founder, real Rabby; chain reads |
| 2026-10-23 | **Rabby UI evidence for the borrowing journey.** Founder screenshots: supply 5 MEZO confirmed at block 16314582, borrow 10 MUSD at 16314589, repay MUSD at 16314603, withdraw 5 MEZO at 16314610, and the final Cosign UI showing 0 collateral and 0 debt. All match the chain reads above; the checker and an independent read found no duplicate transaction (nonce 10, nothing pending). | Supports E1, E2, E4, E5 | Founder screenshots, real Rabby |
| 2026-10-23 | **Partial junior-cover withdrawal added** (`8db5fa6`, no contract change). The Co-sign form now has a "Withdraw cover" amount with Max, limited to what the minimum-cover rule lets leave (Bold today: 6.24 of 20.00 MUSD). Simulation on a local fork, 24/24 (not real-wallet evidence): amounts above the limit refused in the form; request calldata exact; the vault's own 10-minute notice; early withdrawal refused (NotReady) by simulation; lenders arriving during the notice make the app warn and disable the button, and the vault would indeed refuse (Undercovered); withdrawal succeeds once the lenders leave; an unused request shows as expired after 24 h (RequestExpired). Earlier suites re-run on the final build: dialog 46/46, reconnect 17/17, transaction UX 39/39. | C3 to C5 NOT RUN (real) | Scripted, local fork |
| 2026-10-23 | **Journey 2 complete (real Rabby, one scoped authorization, optional step 7 excluded).** Six transactions, each signed by the founder and verified onchain before the next: (1) approve MUSD to Bold, cap edited to exactly 1 [`0x6e597561ae2ba8c6c0e05204a638eb6e0467b293250da11b23b42ea9dd07217d`](https://explorer.test.mezo.org/tx/0x6e597561ae2ba8c6c0e05204a638eb6e0467b293250da11b23b42ea9dd07217d), block 16,315,303, nonce 10; (2) depositSenior 1 MUSD [`0x5967453b53d794116016d81c63ff40ce4589093643f192d533334c0ccf36867c`](https://explorer.test.mezo.org/tx/0x5967453b53d794116016d81c63ff40ce4589093643f192d533334c0ccf36867c), block 16,315,353, nonce 11; (3) withdrawSenior 4 MUSD [`0x7fd6a54dd7b99c02a64373d6ff2fa86cfa792c70780ae4a6aae7afe672841e62`](https://explorer.test.mezo.org/tx/0x7fd6a54dd7b99c02a64373d6ff2fa86cfa792c70780ae4a6aae7afe672841e62), block 16,315,371, nonce 12; (4) withdrawSenior all [`0xb0d380089e88040fc5c44a6ecc0fcf77dd257a8d82da9a43a6c3e53ce6f0751b`](https://explorer.test.mezo.org/tx/0xb0d380089e88040fc5c44a6ecc0fcf77dd257a8d82da9a43a6c3e53ce6f0751b), block 16,315,397, nonce 13; (5) requestJuniorWithdraw 5 MUSD [`0x9ad85812aefd3fbf4f833ab8299c1bb379cac48b41ac7a7559f3c13406c499fc`](https://explorer.test.mezo.org/tx/0x9ad85812aefd3fbf4f833ab8299c1bb379cac48b41ac7a7559f3c13406c499fc), block 16,315,428, nonce 14; (6) withdrawJunior [`0x8db44c5f70f6807280ee4e745de5d73bcecef3c1e8b279a1934ea68f0525c670`](https://explorer.test.mezo.org/tx/0x8db44c5f70f6807280ee4e745de5d73bcecef3c1e8b279a1934ea68f0525c670), block 16,315,576, nonce 15. Before → after: MUSD 19.999997793 → 34.999997808; lending 10.000000 → 0; cover 20.000000 → 15.000000; allowance to Bold 0 → 0; request none. Bold: lenders 1,000.0001 (the deployer's), cover 59.3999 → 54.3999 against a 52.6316 minimum, not under-covered; oracle unchanged; no borrowing. Nonce 16, nothing pending, no duplicates. The checker's recheck before step 6 first reported the notice running (NOT yet safe), then OK to sign. | B2, B4, C3, C5 PASS; C4 PARTIAL | Founder, real Rabby; chain reads |
| 2026-10-23 | **Founder screenshots for Journey 2.** Junior-cover withdrawal confirmed at block 16315576; final Cosign state: wallet MUSD 35.00, Bold junior cover 15.00, senior lending 0, no borrowing debt or collateral, Bold open with a 5.2% cover ratio (54.40 / 1,054.40). All match the chain reads above (independent read at block 16,315,604: nonce 16, nothing pending, MUSD 34.999997808, cover shares 152,284,470.2 × 10¹⁸, lender shares 0, no request). F3 (rejecting a prompt) and the no-transaction checks were not reported, so they stay NOT RUN. | Supports C5, B4 | Founder screenshots, real Rabby |
| 2026-10-23 | **Journey 3 manifest (veBTC voting and MEZO rewards), awaiting scoped authorizations.** Facts verified read-only against the live contracts: veBTC `createLock` accepts durations of 7 to about 33 days (under a week fails "not in the future", over about 33.6 days fails "too long"); unlock times round down to a Thursday 00:00 UTC (4 weeks from today unlocks 19 Nov 2026); the BTC cannot be withdrawn before then (`LockNotExpired`) and only the owner may withdraw after; 0.001 BTC for 4 weeks gives about 0.00089 voting power. Gauge: one vote per veBTC position per 10-minute epoch; a market's weight is its votes capped by its cover (Bold's cap is 0.000544, already reached), so the vote is accepted but does not change the split; voting for a market without the founder's cover fails (`NoCover`), a second vote in an epoch fails (`AlreadyVoted`). Anyone can fund the current epoch and, once it is over, distribute it; with only Bold weighted, the whole budget goes to Bold, 30% to cover holders (the founder holds 27.57% of cover shares), streaming over 10 minutes. Seven founder-signed transactions: (1) BTC approve to veBTC, 0.001 BTC; (2) `createLock` 0.001 BTC for about 4 weeks (outside Cosign, on Mezo's site or the explorer); (3) `gauge.vote(position, [Bold], [100])`; (4) MEZO approve to the gauge, exactly 2; (5) `gauge.fund(2 MEZO)` from the founder's own MEZO; (6) `gauge.distribute(epoch)` once the epoch is over; (7) `Bold.claimRewards()`, about 0.1654 MEZO after the full stream. No deployer funds are needed. A new Fund and Distribute section on the Rewards page (`425cc38`) makes steps 4 to 6 possible inside Cosign. | Plan | Plan |
| 2026-10-23 | **Simulation (local fork, not real-wallet evidence).** The reward loop was rehearsed through the real UI: vote with an existing veBTC position, the no-cover and double-vote refusals (by simulation), fund with the two-step approval, distribute, claim: 24/24, claim 0.165441 MEZO matching 30% x 2 MEZO x 27.57%. The read-only Journey 3 checker verified steps 3 to 7 on a fork and printed its pre-signing rechecks. The lock steps (1 and 2) cannot run on a fork because the BTC token is a Mezo precompile; they are verified on the real chain only. | None (automation) | Scripted, local fork |
| 2026-10-23 | **Journey 3 lock parameters, confirmed by simulation (local fork with a scratch BTC token; not wallet evidence).** The veBTC contract rounds an unlock time down to a Thursday 00:00 UTC and requires the result to be in the future, so the shortest valid lock is one that reaches the next Thursday: signed any time before Thursday 29 Oct 2026 00:00 UTC, **`createLock(1000000000000000, 604800)` (0.001 BTC, 7 days) unlocks at Thursday 29 October 2026 00:00 UTC**, about 5.6 days after signing on Friday 23 October. Locks that cannot reach that Thursday revert (24 h and 120 h failed; 144 h and above succeeded; the maximum is about 33.5 days). The simulated position held 0.001 BTC, ended 1,793,232,000 (29 Oct 00:00 UTC) and had about 0.000185 voting power. A vote for Bold with it was accepted and a second vote in the same epoch reverted. This replaces the earlier "7 to 33 days" and "4 weeks, 19 Nov" figures: four weeks is not needed. The BTC can be withdrawn only after 29 Oct 00:00 UTC (a further founder signature, outside Journey 3). | Plan | Simulation |
| 2026-10-23 | **Journey 2 manifest, awaiting ONE scoped founder authorization.** Bold vault `0x49C8a8d5106B2878679d10EAEA71D0e6793bd7D7`, MUSD `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`. Seven signed transactions at most (the last optional), each verified onchain before the next: (1) MUSD approve to Bold with the cap edited down to exactly 1 MUSD; Cosign must stop with "approved amount is lower" (B2); (2) depositSenior 1 MUSD; (3) withdrawSenior about 4 MUSD (partial, B4); (4) withdrawSenior all remaining (full, B4); (5) requestJuniorWithdraw about 5 MUSD of cover (C3); (6) withdrawJunior after the 10-minute notice (C5); (7, optional) requestJuniorWithdraw about 0.1 MUSD, left unused to observe expiry. Without transactions: over-limit amounts, over-balance, over-capacity, wrong network, account switch, reconnect, one deliberate rejection, a reload right after a confirmation, a slow-network confirmation. Expected end: MUSD about 35.00, lending 0, cover about 15.00. | Plan | Plan |

## W. Wallet setup and selection

| # | Steps | Expected | Result |
|---|---|---|---|
| W1 | Add Mezo testnet by hand using the network settings table, then open the app. | The wallet shows Mezo Testnet, chain 31611. The app shows no wrong-network banner. | NOT RUN |
| W2 | Connect, then compare the address in the app header with the wallet's active account. | The wallet under test opens its own prompt. Both show the same address. | PASS (Rabby, 2026-10-21): connected; header shows `0xf080…9371`, matching the active Rabby account. Founder screenshot. |
| W3 | Compare balances: MUSD and MEZO on the app's Portfolio page against the wallet and the explorer's token page for your address. | All three agree, allowing for display rounding. | PARTIAL (Rabby, 2026-10-21): Cosign Positions shows 50.00 MUSD, 100.0000 MEZO, 0.050000 BTC and no positions, matching chain reads. Rabby and explorer comparison pending. Founder screenshot. |
| W4 | Enable Rabby and OKX Wallet together. Reload and click Connect wallet. | The dialog lists both as "Detected in this browser", each once, Rabby first and marked Preferred. Choosing Rabby opens Rabby's prompt, not OKX's, whichever extension controls `window.ethereum`. | NOT RUN |
| W5 | Same, but choose OKX Wallet in the dialog. | OKX Wallet opens and the header shows the OKX account. Rabby does not open. | NOT RUN |
| W6 | Connected through Rabby with both enabled: reload, then start one transaction and reject it in the wallet. | The reload restores the Rabby account without a prompt. The transaction prompt appears in Rabby, not OKX, and the app reports the rejection. Nothing is sent. | NOT RUN |

## A. Connect, network, accounts

| # | Steps | Expected | Result |
|---|---|---|---|
| A1 | Open the app in a browser **without** a wallet extension. Click Connect wallet. | The wallet dialog says no wallet extension was found, shows Rabby and OKX Wallet as "Not installed" with Install links to their official sites, and lists nothing as detected. The website replay and the app's Recorded evidence page still work. | NOT RUN |
| A2 | Click Connect wallet, then choose Rabby Wallet in the dialog. | The dialog shows "Approve in Rabby Wallet" while Rabby's own prompt is open, and does not show connected until Rabby approves. Then "Connected", and the header shows your short address (Disconnect is in the account dialog it opens). | PARTIAL (Rabby, 2026-10-21, before the wallet dialog existed): Rabby connected and the header shows the short address. Retest through the dialog. |
| A3 | Click your address in the header, then Disconnect; reload. | Header returns to Connect wallet and no positions are shown. After the reload it stays disconnected, even if the wallet still lists the site as connected. Connect works again afterwards. | PARTIAL (Rabby, 2026-10-21): after Disconnect, a refresh kept the app disconnected (PASS for persistence). Still to check: no positions shown, the wallet's connected-sites list, reconnecting afterwards. |
| A8 | While connected, reload the page; then close the tab and open the URL in a new tab. | Both times the same account is back without any wallet prompt, read from the wallet (`eth_accounts`). The header and Portfolio (formerly Positions) match the wallet. | PASS (Rabby, 2026-10-21): after a refresh the authorised Rabby account came back without a Rabby popup. Founder, real extension. Reopening the tab not reported separately. |
| A4 | Remove Mezo testnet from the wallet, then Connect. | Wallet offers to add the network (chain 31611, RPC `rpc.test.mezo.org`, symbol BTC). Approve. | NOT RUN |
| A5 | Switch the wallet to another network (for example Ethereum). | A red banner says the wallet is on another network, with a Switch button. Switch works. | NOT RUN |
| A6 | Switch to a second account in the wallet while on a market page. | Positions update to the new account. The old account's numbers never show. | NOT RUN |
| A7 | Reject the connect request in the wallet; separately, reject the network switch. | Connect rejected: "Request declined", nothing shared, with Try again and Choose another wallet. Switch rejected: "Your wallet is on another network" with Switch to Mezo testnet and Not now. No crash. | NOT RUN |

## B. Lending (senior)

| # | Steps | Expected | Result |
|---|---|---|---|
| B1 | Open a market that is **not** under-covered (post cover first in C2 if both are). Enter 10 MUSD and deposit. | Approve MUSD, then deposit. Each step shows "confirm in your wallet", then "waiting", then "done" with a transaction link. Your lender balance updates. | PASS (Rabby, 2026-10-23): Bold, 10 MUSD. Approval signed and confirmed (Stage A), then the deposit signed and confirmed in a separate step (Stage B, block 16,313,941), each with its own tray and link. Positions then showed lending 10.00, cover 20.00, wallet 20.00 MUSD. Matches chain reads. Founder screenshots and explorer. |
| B2 | In the approval prompt, lower the spending cap below the deposit and confirm. | The app says the approved amount is too low and does not continue. | PASS (Rabby, 2026-10-23): Lend 2 MUSD; Rabby let the founder edit the approval to exactly 1 MUSD (tx `0x6e597561…217d`, block 16,315,303); Cosign stopped and did not deposit. Onchain: allowance exactly 1 MUSD, no MUSD or lending change. Founder report; chain reads. |
| B3 | Try to deposit more than the market's room to lend. | A plain message that there is not that much room. No funds move. | NOT RUN |
| B4 | Withdraw part, then all, of your lender balance. | Balance updates. If the Morpho market has too little unborrowed MUSD, a plain "not enough unborrowed MUSD" message appears. | PASS (Rabby, 2026-10-23): partial withdrawal of 4 MUSD (tx `0x7fd6a54d…1e62`, block 16,315,371: MUSD 19.00 → 23.00, lending 11.00 → 7.00), then all remaining (tx `0xb0d38008…751b`, block 16,315,397: MUSD → 30.00, lending 0). Paid by Morpho directly to the wallet. The "not enough unborrowed MUSD" message was not exercised (no borrowing at the time). Signed in Rabby; verified onchain; tray screenshots pending. |
| B5 | Enter a deposit larger than your MUSD balance. | The field is flagged with your wallet balance and the button is disabled. Nothing is sent to the wallet. | NOT RUN |

## C. Cover (junior) and withdrawal notice

| # | Steps | Expected | Result |
|---|---|---|---|
| C1 | Co-sign page, Bold: post 20 MUSD cover. | Approve, then deposit. "Your cover" shows about 20. | PASS (Rabby, 2026-10-21): approval then deposit signed in Rabby, both confirmed (blocks 16,283,159 and 16,283,162); without a manual refresh the Co-sign card then showed "Your cover" 20.00 MUSD, market cover 59.40, Bold open to lenders. Matches chain reads. Founder report and screenshots. (Run with the earlier build, where the deposit prompt followed the approval automatically.) |
| C2 | Before posting, type the amount and read the hint under "Post cover". | It shows the room for new lender deposits after the deposit, from live vault state, rounded down. For 20 MUSD on Bold on 21 October 2026: 128.59 MUSD (now 0.00), and cover can shrink by at most 6.76 MUSD while today's lenders stay. For an amount below the shortfall it says how much is still short. On empty Steady, 20 MUSD shows 180.00. | NOT RUN |
| C3 | Open Co-sign, type an amount in "Withdraw cover" (more than the limit is refused in the form), then click "Request withdrawal of …". | A ready-at time appears. Your cover still shows and still pays losses until then. | PASS (Rabby, 2026-10-23): request for 5 MUSD of cover (tx `0x9ad85812…99fc`, block 16,315,428). Onchain: request holds the exact shares for 5 MUSD, ready 600 s after the block (14:25:24 local); cover stayed 20.00 and still counted. Signed in Rabby; verified onchain; tray and ready-time screenshots pending. |
| C4 | Before the time passes, try to withdraw (use the wallet's contract interaction or reload and look for the button). | The Withdraw button is absent. If reachable, a plain "notice period has not ended" message. | PARTIAL (2026-10-23): the vault refuses an early withdrawal: simulated from the founder's address twice during the notice, `NotReady(1792745724)`, nothing broadcast. The Withdraw button being absent in the Rabby session is not yet reported. |
| C5 | After the time passes, click Withdraw (the amount you requested). | Cover returns to your wallet. If it would drop the market below minimum cover, a plain message says so and nothing moves. | PASS (Rabby, 2026-10-23) for the withdrawal: after the notice, the checker's recheck said OK to sign (5.00 requested, 6.77 may leave); tx `0x8db44c5f…c670`, block 16,315,576: MUSD 30.00 → 35.00, cover 20.00 → 15.00, request cleared, Bold 54.40 cover vs 52.63 minimum. The minimum-cover refusal itself was verified by simulation only (local fork 24/24; read-only checks on the live market), not with a real-wallet attempt. Signed in Rabby; verified onchain; final-state screenshots from the founder. |

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
| E1 | Add 5 MEZO as collateral on a market. | Approve MEZO, then supply. Collateral shows 5. | PASS (Rabby, 2026-10-23): approve 5 MEZO signed first (block 16,314,082), supply signed separately (tx `0x36b96b80…4bab`, block 16,314,582). Collateral 5.00, MEZO 95. Signed by the founder in Rabby; Cosign tray screenshots from the founder; verified onchain by the read-only checker and an independent read. |
| E2 | Borrow a small amount of MUSD. | MUSD arrives. LTV shown is below the market limit. | PASS (Rabby, 2026-10-23): borrow 10 MUSD (tx `0x03d16f34…5113`, block 16,314,589). MUSD 20.00 → 30.00, debt 10.000000, LTV 20.0% against a 77% limit. Signed by the founder in Rabby; Cosign tray screenshots from the founder; verified onchain by the read-only checker and an independent read. |
| E3 | Try to borrow beyond the limit. | The transaction is refused with a readable message. Nothing moves. | NOT RUN |
| E4 | Repay in full. | Debt returns to 0. | PASS (Rabby, 2026-10-23): approve about 10.01 MUSD (tx `0x13185c8c…59d2`) then repay by shares (tx `0x200e44ce…c83c`, block 16,314,603). Debt 0, borrow shares 0. Signed by the founder in Rabby; Cosign tray screenshots from the founder; verified onchain by the read-only checker and an independent read. |
| E5 | Withdraw your collateral. | MEZO returns to the wallet. | PASS (Rabby, 2026-10-23): withdraw 5 MEZO (tx `0x2ae0e4f9…320c`, block 16,314,610). Collateral 0, MEZO back to 100.00. Signed by the founder in Rabby; Cosign tray screenshots from the founder; verified onchain by the read-only checker and an independent read. |

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
