import { useEffect, useState } from "react";
import type { Address } from "viem";
import { addrUrl, client, morphoAbi, txUrl, vaultAbi, type LossEvent, type MarketState } from "../chain";
import { ArrowE, ArrowNE } from "../ui/Icon";
import { Art } from "../ui/Art";
import type { Ctx } from "./ctx";
import { href, keepUrl } from "./routes";
import {
  allowanceOf, Amount, aprs, apr, collateralOut, collateralValue, coverShortfall, debtOf, Figure, fmt, fmtDown, ltvBps, marketKey, marketStatus, minCoverBps, PageHead, pct, pctTrim,
  Row, Stack, toWei, TwoStep, up2, WAD,
} from "./ui";

/** Lender-deposit status in the vault's own terms. Borrowing on Morpho is separate. */
export function MarketStatus({ m }: { m: MarketState }) {
  const k = marketStatus(m);
  if (k === "needs-cover") return <span className="chip chip-loss">More cover needed</span>;
  if (k === "full") return <span className="chip">At capacity</span>;
  if (k === "empty") return <span className="chip">Empty market</span>;
  return <span className="chip chip-live">Open to lenders</span>;
}

/** Why new lender deposits are closed, and what reopens them. Null while the market is open. */
export function closedReason(m: MarketState) {
  const k = marketStatus(m);
  if (k === "empty") return "No cover has been posted yet. Lending opens once co-signers post cover.";
  if (k === "needs-cover") return `${fmt(up2(coverShortfall(m)))} MUSD more cover is needed before new lender deposits reopen.`;
  if (k === "full") return "Lending room is used up. More cover opens more room.";
  return null;
}

const aprSub = (m: MarketState) => (aprs(m).util === 0 ? "nothing borrowed yet" : "variable");

const lltvText = (m: MarketState) => pctTrim((m.lltv * 10_000n) / WAD);
const borrowedText = (m: MarketState) => `${(aprs(m).util * 100).toFixed(0)}% of supply`;

// ================================================================ overview

export function Markets({ markets, gauge, losses, lossesFailed, user }: Ctx) {
  return (
    <>
      <PageHead title="Markets" lede="Cover pays first. Lenders lose money only when a loss is larger than the cover in front of them.">
        <ul className="legend-row" aria-label="Legend">
          <li><i className="sw sw-cover" />Cover</li>
          <li><i className="sw sw-senior" />Lenders</li>
          <li><i className="sw sw-room" />Available to lend</li>
          <li><i className="sw-min" />Minimum cover</li>
        </ul>
      </PageHead>

      <div className="mk-grid">
        {markets.map((m) => {
          const a = aprs(m);
          const share = gauge && gauge.totalWeight > 0n ? Number((m.weight * 10_000n) / gauge.totalWeight) : 0;
          const loss = losses?.find((l) => l.vault.toLowerCase() === m.vault.toLowerCase()); // newest first
          const me = user?.perVault[m.vault];
          const debt = me ? debtOf(me.borrowShares, m) : 0n;
          const has = !!me && (me.senior > 0n || me.junior > 0n || me.collateral > 0n || debt > 0n);
          return (
            <article className="mk card card-white" key={m.vault}>
              <div className="mk-head">
                <div className="mk-art"><Art slot={marketKey(m)} /></div>
                <div className="mk-title">
                  <h2><a href={href.market(m.slug)}>{m.name}</a></h2>
                  <p>Liquidation at {lltvText(m)} LTV · lenders up to {m.maxLeverage.toString()}× cover</p>
                </div>
                <MarketStatus m={m} />
              </div>

              <Stack m={m} compact />

              <dl className="figs figs-3">
                <Figure k="Market cover" v={fmt(m.junior)} unit="MUSD" sub={`${pct(m.coverageBps)} · minimum ${pct(minCoverBps(m), 0)}`} tone="cover" />
                <Figure k="Lender deposits" v={fmt(m.senior)} unit="MUSD" />
                <Figure k="Available to lend" v={fmtDown(m.capacity)} unit="MUSD" />
                <Figure k="Borrowed" v={fmt(m.totalBorrow)} unit="MUSD" sub={borrowedText(m)} />
                <Figure k="Lender APR" v={apr(a.senior)} sub={aprSub(m)} />
                <Figure k="Co-signer APR" v={apr(a.junior)} sub="from interest, excl. MEZO" />
              </dl>

              {has && (
                <p className="mk-mine"><b>You</b>
                  {me!.senior > 0n && <span>Lending {fmt(me!.senior)}</span>}
                  {me!.junior > 0n && <span>Cover {fmt(me!.junior)}</span>}
                  {me!.collateral > 0n && <span>Collateral {fmt(me!.collateral)} MEZO</span>}
                  {debt > 0n && <span>Debt {fmt(debt)}</span>}
                </p>
              )}
              {closedReason(m) && <p className={`note ${m.undercovered ? "is-loss" : ""}`}>{closedReason(m)}</p>}
              {!losses && lossesFailed && <p className="note is-loss" role="alert">Loss history unavailable right now.</p>}
              {loss && <p className="mk-loss">Last loss {fmt(loss.loss)} MUSD · cover paid {fmt(loss.byJunior)}, lenders {fmt(loss.bySenior)} · <a href={txUrl(loss.tx)} target="_blank" rel="noreferrer">tx</a></p>}

              <div className="mk-foot">
                {marketStatus(m) === "open" ? (
                  <>
                    <a className="btn btn-dark btn-sm" href={href.market(m.slug)}>Lend</a>
                    <a className="btn btn-light btn-sm" href={href.market(m.slug, "borrow")}>Borrow</a>
                    <a className="btn btn-ghost btn-sm" href={href.cosign(m.slug)}>Co-sign</a>
                  </>
                ) : (
                  <>
                    <a className="btn btn-dark btn-sm" href={href.cosign(m.slug)}>Post cover</a>
                    <a className="btn btn-light btn-sm" href={href.market(m.slug, "borrow")}>Borrow</a>
                    <a className="btn btn-ghost btn-sm" href={href.market(m.slug)}>Details</a>
                  </>
                )}
                <span className="mk-weight" title="Share of each epoch's MEZO rewards, by cover-capped veBTC votes">
                  Reward weight {(share / 100).toFixed(1)}%{gauge && gauge.budget === 0n ? " · this epoch unfunded" : ""}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

// ================================================================ detail

export function MarketDetail(ctx: Ctx & { vault: Address; tab: "lend" | "borrow" }) {
  const { markets, vault, losses, d, price } = ctx;
  const m = markets.find((x) => x.vault.toLowerCase() === vault.toLowerCase());
  const mine = losses?.filter((l) => l.vault.toLowerCase() === vault.toLowerCase());
  const [replay, setReplay] = useState<LossEvent | null>(null);
  const [tab, setTab] = useState(ctx.tab);
  if (!m) return <div className="empty card card-white"><h1 className="page-title">Unknown market</h1><p>That address is not a Cosign vault in this deployment.</p><a className="btn btn-dark" href={href.markets()}>Back to markets</a></div>;
  const a = aprs(m);

  return (
    <>
      <PageHead title={<span className="title-chip">{m.name}<MarketStatus m={m} /></span>}
        lede={`Lent on Morpho Blue against MEZO · liquidation at ${lltvText(m)} loan-to-value · lenders up to ${m.maxLeverage}× cover`}>
        <a className="link" href={addrUrl(m.vault)} target="_blank" rel="noreferrer">Vault <ArrowNE size={14} /></a>
      </PageHead>

      <div className="split">
        <div className="split-main">
          <section className="panel card card-white" aria-labelledby="books">
            <div className="panel-head">
              <h2 id="books" className="panel-title">{replay ? "Recorded loss" : "Capital stack"}</h2>
              {replay ? <span className="chip chip-recorded">Recorded · block {replay.block.toString()}</span> : <span className="chip chip-live">Live</span>}
            </div>
            {replay ? <LossReplay m={m} ev={replay} onDone={() => setReplay(null)} /> : <Stack m={m} />}
            <dl className="figs figs-auto">
              <Figure k="Market cover" v={fmt(m.junior)} unit="MUSD" sub={`${pct(m.coverageBps)} of the vault`} tone="cover" />
              <Figure k="Lender deposits" v={fmt(m.senior)} unit="MUSD" />
              <Figure k="Available to lend" v={fmtDown(m.capacity)} unit="MUSD" />
              <Figure k="Borrowed" v={fmt(m.totalBorrow)} unit="MUSD" sub={borrowedText(m)} />
              <Figure k="Lender APR" v={apr(a.senior)} sub={aprSub(m)} />
              <Figure k="Co-signer APR" v={apr(a.junior)} sub="from interest, excl. MEZO" />
            </dl>
            {m.undercovered && (
              <p className="note is-loss">More cover needed: <b>{fmt(up2(coverShortfall(m)))} MUSD</b> reopens deposits. Until then, new deposits and cover withdrawals are paused; borrowing is not.</p>
            )}
            {m.round > 0n && <p className="note">Cover was wiped out {m.round.toString()} time(s) and then recapitalised.</p>}
          </section>

          <section className="panel card card-white" aria-labelledby="loss-h">
            <div className="panel-head">
              <h2 id="loss-h" className="panel-title">Losses</h2>
              <a className="link" href={href.evidence()}>Recorded evidence</a>
            </div>
            {ctx.lossesFailed && !mine ? (
              <p className="empty-line is-loss" role="alert">Couldn't read loss history from Mezo testnet. Reload to try again.</p>
            ) : !mine ? (
              <p className="empty-line" role="status"><span className="spin" />Reading loss history…</p>
            ) : mine.length === 0 ? (
              <p className="empty-line">No losses on this market.</p>
            ) : (
              <div className="table-wrap">
                <table className="atable">
                  <thead><tr><th>Block</th><th className="r">Loss</th><th className="r">Cover paid</th><th className="r">Lenders paid</th><th /></tr></thead>
                  <tbody>
                    {mine.map((l) => (
                      <tr key={l.tx}>
                        <td><a href={txUrl(l.tx)} target="_blank" rel="noreferrer" className="num">{l.block.toString()}</a></td>
                        <td className="r num">{fmt(l.loss)}</td>
                        <td className="r num is-cover">{fmt(l.byJunior)}</td>
                        <td className="r num">{fmt(l.bySenior)}</td>
                        <td className="r"><button className="btn btn-light btn-sm" onClick={() => setReplay(l)} aria-pressed={replay?.tx === l.tx}>Replay</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <details className="panel card card-white more-panel">
            <summary className="panel-title">Parameters and contracts</summary>
            <dl className="rows rows-2">
              <Row k="Liquidation loan-to-value">{lltvText(m)}</Row>
              <Row k="Lenders per MUSD of cover">up to {m.maxLeverage.toString()}×</Row>
              <Row k="Minimum cover">{pct(minCoverBps(m), 0)} of the vault</Row>
              <Row k="Borrow rate">{apr(a.borrow)} fixed</Row>
              <Row k="Co-signer premium">{pct(m.premiumBps, 0)} of lender interest</Row>
              <Row k="Cover withdrawal notice">{Number(m.cooldown) / 60} minutes, then {Number(m.withdrawWindow) / 3600} h to withdraw</Row>
              <Row k="Reward split">{pct(m.rewardJuniorBps, 0)} cover · {pct(10_000n - m.rewardJuniorBps, 0)} lenders</Row>
              <Row k="MEZO price">{fmt(price / WAD, 2)} MUSD · demo oracle (team-controlled)</Row>
              <Row k="Vault"><a href={addrUrl(m.vault)} target="_blank" rel="noreferrer">{m.vault.slice(0, 10)}… <ArrowNE size={12} /></a></Row>
              <Row k="Morpho Blue"><a href={addrUrl(d.morpho)} target="_blank" rel="noreferrer">{d.morpho.slice(0, 10)}… <ArrowNE size={12} /></a></Row>
            </dl>
          </details>

          <details className="panel card card-white more-panel">
            <summary className="panel-title">What cover does and doesn't guarantee</summary>
            <div className="g-cols">
              <div>
                <h3>Enforced by the contracts</h3>
                <ul>
                  <li>A loss is taken from cover first. Lenders pay only the part larger than the cover in front of them.</li>
                  <li>Every recognised loss is split between cover and lenders, with nothing created or lost.</li>
                </ul>
              </div>
              <div>
                <h3>Not guaranteed</h3>
                <ul>
                  <li>Interest since the vault's last update, if a liquidation skips Cosign's liquidator.</li>
                  <li>Protection beyond the cover: a larger loss is shared by lenders still in the vault.</li>
                  <li>That cover stays: a co-signer whose notice has ended can leave before a loss is booked.</li>
                  <li>A borrowing limit: Cosign caps deposits into this vault, not borrowing on Morpho.</li>
                </ul>
              </div>
            </div>
          </details>
        </div>

        <aside className="split-side" aria-label="Lend or borrow">
          <div className="panel card card-white action-card">
            <div className="seg-tabs" role="tablist" aria-label="Action">
              <button role="tab" aria-selected={tab === "lend"} onClick={() => { setTab("lend"); keepUrl(href.market(m.slug)); }}>Lend</button>
              <button role="tab" aria-selected={tab === "borrow"} onClick={() => { setTab("borrow"); keepUrl(href.market(m.slug, "borrow")); }}>Borrow</button>
            </div>
            {tab === "lend" ? <LendPanel {...ctx} m={m} /> : <BorrowPanel {...ctx} m={m} />}
          </div>
          <a className="side-link card" href={href.cosign(m.slug)}><span><b>Co-sign this market</b><small>Post first-loss cover; share in borrower interest</small></span><ArrowE /></a>
        </aside>
      </div>
    </>
  );
}

/** Before/after of one recorded loss, read from its LossAbsorbed event. */
function LossReplay({ m, ev, onDone }: { m: MarketState; ev: LossEvent; onDone: () => void }) {
  const [after, setAfter] = useState<{ s: bigint; j: bigint } | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<"before" | "after">("before");
  useEffect(() => {
    client
      .getContractEvents({ address: ev.vault, abi: vaultAbi, eventName: "LossAbsorbed", fromBlock: ev.block, toBlock: ev.block })
      .then((logs) => {
        const l = logs.find((x) => x.transactionHash === ev.tx);
        const a = l?.args as { seniorAssetsAfter: bigint; juniorAssetsAfter: bigint } | undefined;
        if (a) setAfter({ s: a.seniorAssetsAfter, j: a.juniorAssetsAfter }); else setFailed(true);
      })
      .catch(() => setFailed(true));
  }, [ev]);
  useEffect(() => {
    if (!after) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("after"), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [after]);
  if (failed) return <p className="empty-line is-loss" role="alert">Couldn't read this loss from Mezo testnet. <button className="link" onClick={onDone}>Back to live view</button></p>;
  if (!after) return <p className="empty-line" role="status"><span className="spin" />Reading the loss…</p>;
  const before = { s: after.s + ev.bySenior, j: after.j + ev.byJunior };
  const cur = phase === "before" ? before : after;
  return (
    <div className="lreplay">
      <Stack m={m} senior={cur.s} junior={cur.j} scale={before.s + before.j} lost={phase === "after" ? ev.byJunior : 0n} lostSenior={phase === "after" ? ev.bySenior : 0n} />
      <div className="lreplay-note">
        <p aria-live="polite">
          {phase === "before" ? "Before the liquidation." : (
            <>Loss of <b>{fmt(ev.loss)} MUSD</b>: cover paid <b className="is-cover">{fmt(ev.byJunior)}</b>, lenders paid <b>{fmt(ev.bySenior)}</b>. <a href={txUrl(ev.tx)} target="_blank" rel="noreferrer">Transaction</a></>
          )}
        </p>
        <button className="link" onClick={onDone}>Back to live view</button>
      </div>
    </div>
  );
}

// ================================================================ actions

export function ConnectGate({ connect, what }: { connect: () => void; what: string }) {
  return (
    <div className="connect-gate">
      <p>Connect a wallet on Mezo Testnet to {what}.</p>
      <button className="btn btn-dark btn-block" onClick={connect}>Connect wallet</button>
    </div>
  );
}

function LendPanel({ m, user, account, send, approveIfNeeded, connect, d, busy }: Ctx & { m: MarketState }) {
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const closed = closedReason(m);
  if (!account && !closed) return <ConnectGate connect={connect} what="lend" />;
  const me = user?.perVault[m.vault];
  const depWei = toWei(dep);
  const tooMuch = depWei > m.capacity;
  const overWallet = !!user && depWei > user.musd;
  const approved = allowanceOf(user, d.musd, m.vault) >= depWei;
  const wdWei = toWei(wd);
  const wdOver = !!me && wdWei > me.senior;
  return (
    <div className="action">
      <dl className="rows">
        {account && <Row k="Your deposits">{user ? `${fmt(me?.senior ?? 0n)} MUSD` : "…"}</Row>}
        {account && <Row k="Wallet">{user ? `${fmtDown(user.musd)} MUSD` : "…"}</Row>}
        <Row k="Available to lend">{fmtDown(m.capacity)} MUSD</Row>
      </dl>
      {closed ? (
        <div className="status-box">
          <MarketStatus m={m} />
          <p>{closed}</p>
          <a className="btn btn-light btn-sm" href={href.cosign(m.slug)}>Post cover</a>
        </div>
      ) : <>
      <div className="field">
        <label htmlFor="lend">Deposit</label>
        <Amount id="lend" value={dep} onChange={setDep} unit="MUSD" max={user && user.musd < m.capacity ? user.musd : m.capacity} invalid={tooMuch || overWallet} />
        {tooMuch ? <span className="field-hint is-error">Only {fmtDown(m.capacity)} MUSD available to lend. More cover opens more room.</span>
          : overWallet ? <span className="field-hint is-error">Your wallet has {fmtDown(user!.musd)} MUSD.</span> : null}
      </div>
      {depWei > 0n && !tooMuch && !overWallet && user && <TwoStep approve="MUSD" action="Deposit" done={approved} />}
      <button className="btn btn-dark btn-block" disabled={busy || depWei === 0n || tooMuch || overWallet || !user}
        onClick={async function deposit() {
          if (!(await approveIfNeeded(d.musd, m.vault, depWei, "MUSD", { ready: "deposit", label: `Deposit ${fmt(depWei)} MUSD`, run: deposit }))) return;
          if (await send("Deposit MUSD", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositSenior", args: [depWei] }))) setDep("");
        }}>{depWei === 0n ? "Deposit" : approved ? `Deposit ${fmt(depWei)} MUSD` : `Approve ${fmt(depWei)} MUSD`}</button>
      <p className="risk-line">You lose money only if a loss exceeds the {fmt(m.junior)} MUSD of cover in front of lenders.</p>
      </>}
      {me && me.seniorShares > 0n && (
        <div className="action-sub">
          <div className="field">
            <label htmlFor="wd">Withdraw</label>
            <Amount id="wd" value={wd} onChange={setWd} unit="MUSD" max={me.senior} invalid={wdOver} />
            {wdOver && <span className="field-hint is-error">You have {fmt(me.senior)} MUSD deposited.</span>}
          </div>
          <button className="btn btn-light btn-block" disabled={busy || wdWei === 0n || wdOver}
            onClick={async () => {
              const shares = wdWei >= me.senior ? me.seniorShares : (me.seniorShares * wdWei) / me.senior;
              if (await send("Withdraw MUSD", (wc) => wc.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawSenior", args: [shares] }))) setWd("");
            }}>{wdWei > 0n && !wdOver ? `Withdraw ${fmt(wdWei >= me.senior ? me.senior : wdWei)} MUSD` : "Withdraw"}</button>
        </div>
      )}
    </div>
  );
}

type BorrowTab = "collateral" | "borrow" | "repay" | "withdraw";

function BorrowPanel({ m, user, account, send, approveIfNeeded, connect, d, price, busy }: Ctx & { m: MarketState }) {
  const [sub, setSub] = useState<BorrowTab>("collateral");
  const [v, setV] = useState<Record<BorrowTab, string>>({ collateral: "", borrow: "", repay: "", withdraw: "" });
  if (!account) return <ConnectGate connect={connect} what="borrow" />;
  const me = user?.perVault[m.vault];
  const debt = me ? debtOf(me.borrowShares, m) : 0n;
  const value = me ? collateralValue(me.collateral, price) : 0n;
  const limit = (value * m.lltv) / WAD;
  const room = limit > debt ? limit - debt : 0n;
  const liquidity = m.totalSupply > m.totalBorrow ? m.totalSupply - m.totalBorrow : 0n;
  const ltv = ltvBps(debt, value);
  const lltv = (m.lltv * 10_000n) / WAD;
  const amt = toWei(v[sub]);
  // The most collateral the contract lets leave (loan exactly at its limit, an hour of interest reserved, rounded
  // down), and what Max fills: the amount that keeps loan-to-value at 85% of the limit, so a small price move
  // doesn't make the loan liquidatable at once.
  const out = me ? collateralOut(me.collateral, debt, price, m.lltv, m.borrowApr) : { known: true, max: 0n };
  const margin = me ? collateralOut(me.collateral, debt, price, (m.lltv * 85n) / 100n, m.borrowApr) : { known: true, max: 0n };
  const after = me && amt <= me.collateral ? me.collateral - amt : 0n;
  const ltvAfter = ltvBps(debt, collateralValue(after, price));
  const set = (x: string) => setV({ ...v, [sub]: x });
  const clear = () => setV({ ...v, [sub]: "" });
  const tabs: [BorrowTab, string, boolean][] = [["collateral", "Add MEZO", true], ["borrow", "Borrow", true], ["repay", "Repay", debt > 0n], ["withdraw", "Withdraw", (me?.collateral ?? 0n) > 0n]];
  const err =
    sub === "collateral" && user && amt > user.mezo ? `Your wallet has ${fmtDown(user.mezo, 4)} MEZO.`
    : sub === "borrow" && amt > room ? (value === 0n ? "Add collateral first." : `Above your borrow limit: up to ${fmt(room)} MUSD more.`)
    : sub === "borrow" && amt > liquidity ? `Only ${fmt(liquidity)} MUSD is unborrowed in this market.`
    : sub === "repay" && amt > debt + debt / 1000n + 1n ? `Your debt is ${fmt(debt)} MUSD.`
    : sub === "repay" && user && amt > user.musd ? `Your wallet has ${fmtDown(user.musd)} MUSD.`
    : sub === "withdraw" && me && amt > me.collateral ? `You have ${fmt(me.collateral, 4)} MEZO posted.`
    : sub === "withdraw" && debt > 0n && !out.known && amt > 0n ? "The MEZO price isn't available right now, so this withdrawal's safety can't be checked. Try again shortly."
    : sub === "withdraw" && debt > 0n && amt > out.max ? (out.max === 0n ? "Your loan needs all of this collateral. Repay some debt first." : `Above the most you can withdraw (${fmt(out.max, 4)} MEZO) while your debt stays.`)
    : "";
  const token = sub === "collateral" ? d.mezo : d.musd;
  const needApproval = sub === "collateral" || sub === "repay";
  const full = sub === "repay" && amt >= debt;
  const approveAmt = full ? debt + debt / 1000n + 1n : amt;
  const approved = allowanceOf(user, token, d.morpho) >= approveAmt;

  const run = async function act(): Promise<void> {
    if (sub === "collateral") {
      if (!(await approveIfNeeded(d.mezo, d.morpho, amt, "MEZO", { ready: "add collateral", label: `Add ${fmt(amt, 4)} MEZO collateral`, run: act }))) return;
      if (await send("Add collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "supplyCollateral", args: [m.params, amt, account, "0x"] }))) clear();
    } else if (sub === "borrow") {
      if (await send("Borrow MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "borrow", args: [m.params, amt, 0n, account, account] }))) clear();
    } else if (sub === "repay") {
      if (!(await approveIfNeeded(d.musd, d.morpho, approveAmt, "MUSD", { ready: "repay", label: `Repay ${fmt(amt)} MUSD`, run: act }))) return;
      const args = full ? ([m.params, 0n, me!.borrowShares, account, "0x"] as const) : ([m.params, amt, 0n, account, "0x"] as const);
      if (await send("Repay MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "repay", args }))) clear();
    } else {
      if (await send("Withdraw collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "withdrawCollateral", args: [m.params, amt, account, account] }))) clear();
    }
  };
  const verb = { collateral: "Add", borrow: "Borrow", repay: "Repay", withdraw: "Withdraw" }[sub];
  const unit = sub === "collateral" || sub === "withdraw" ? "MEZO" : "MUSD";
  const dp = unit === "MEZO" ? 4 : 2;
  const max = sub === "collateral" ? user?.mezo : sub === "repay" ? (user && user.musd < debt ? user.musd : debt) : sub === "withdraw" ? (debt === 0n ? me?.collateral : margin.known ? margin.max : undefined) : undefined;
  const near = ltv !== null && ltv * 10n >= lltv * 9n;

  return (
    <div className="action">
      <dl className="rows">
        <Row k="Collateral">{user ? `${fmt(me?.collateral ?? 0n, 4)} MEZO` : "…"}{value > 0n && <small> ≈ {fmt(value)} MUSD</small>}</Row>
        <Row k="Debt">{user ? `${fmt(debt)} MUSD` : "…"}</Row>
        <Row k="Borrow limit">{fmt(limit)} MUSD</Row>
      </dl>
      <div className={`ltv ${near ? "is-near" : ""}`}>
        <div className="ltv-head"><span>Loan-to-value</span><b className="num">{ltv === null ? "—" : pct(ltv)} <small>/ liquidation {lltvText(m)}</small></b></div>
        <div className="ltv-bar" aria-hidden="true"><span style={{ width: `${ltv === null ? 0 : Math.min(100, Number((ltv * 100n) / lltv))}%` }} /></div>
      </div>
      <div className="mini-tabs" role="tablist" aria-label="Borrow action">
        {tabs.map(([k, label, on]) => (
          <button key={k} role="tab" aria-selected={sub === k} disabled={!on} onClick={() => setSub(k)}>{label}</button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={`b-${sub}`}>{{ collateral: "MEZO to add as collateral", borrow: "MUSD to borrow", repay: "MUSD to repay", withdraw: "MEZO to withdraw" }[sub]}</label>
        <Amount id={`b-${sub}`} value={v[sub]} onChange={set} unit={unit} max={max} invalid={!!err} />
        {err ? <span className="field-hint is-error">{err}</span>
          : sub === "borrow" ? <span className="field-hint">{liquidity === 0n ? "No unborrowed MUSD in this market right now." : `Fixed ${apr(Number(m.borrowApr) / 1e18)} APR · up to ${fmt(room < liquidity ? room : liquidity)} MUSD more`}</span>
          : sub === "withdraw" && debt > 0n ? <span className="field-hint">Max keeps loan-to-value at 85% of the {lltvText(m)} limit. Withdrawing more moves the loan closer to liquidation.</span>
          : sub === "collateral" && user ? <span className="field-hint">Wallet {fmtDown(user.mezo, 4)} MEZO</span> : null}
      </div>
      {sub === "withdraw" && debt > 0n && out.known && (
        <dl className="rows">
          <Row k="Most you can withdraw">{fmt(out.max, 4)} MEZO</Row>
          {amt > 0n && !err && <Row k="Collateral after">{fmt(after, 4)} MEZO</Row>}
          {amt > 0n && !err && <Row k="Loan-to-value after" tone={ltvAfter !== null && ltvAfter * 10n >= lltv * 9n ? "loss" : undefined}>{ltvAfter === null ? "—" : pct(ltvAfter)} <small>/ liquidation {lltvText(m)}{ltvAfter !== null && ltvAfter * 10n >= lltv * 9n ? " · close" : ""}</small></Row>}
        </dl>
      )}
      {needApproval && amt > 0n && !err && user && <TwoStep approve={sub === "collateral" ? "MEZO" : "MUSD"} action={sub === "collateral" ? "Add collateral" : "Repay"} done={approved} />}
      <button className="btn btn-dark btn-block" disabled={busy || amt === 0n || !!err || !user} onClick={run}>
        {amt === 0n ? verb : needApproval && !approved ? `Approve ${fmt(approveAmt, dp)} ${unit}` : `${verb} ${fmt(full ? debt : amt, dp)} ${unit}`}
      </button>
      <p className="risk-line">At {lltvText(m)} loan-to-value your collateral can be liquidated. The MEZO price comes from a team-controlled demo oracle.</p>
    </div>
  );
}
