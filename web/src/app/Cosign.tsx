import { useState } from "react";
import type { Address } from "viem";
import { vaultAbi, type MarketState } from "../chain";
import { ArrowE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { ConnectGate, MarketStatus } from "./Markets";
import type { ExitKind } from "./math";
import { href, keepUrl } from "./routes";
import {
  allowanceOf, Amount, coverExit, coverFreeAfter, coverShortfall, down2, fmt, fmtCoverShare, fmtDown, minCoverBps, PageHead, pct, roomAfterCover,
  Row, sharesForCover, Stack, toWei, TwoStep, up2,
} from "./ui";

export function Cosign(ctx: Ctx & { vault?: Address }) {
  const { markets, user, vault } = ctx;
  const held = markets.find((m) => (user?.perVault[m.vault]?.juniorShares ?? 0n) > 0n);
  const [sel, setSel] = useState<Address | undefined>(vault);
  const m = markets.find((x) => x.vault.toLowerCase() === (sel ?? held?.vault ?? markets[0].vault).toLowerCase()) ?? markets[0];
  return (
    <>
      <PageHead title="Co-sign" lede="Post MUSD as first-loss cover for a market's lenders. Co-signers share in borrower interest when the market earns it, and in MEZO rewards when an epoch is funded and distributed; neither is guaranteed. Posting cover needs no veBTC; voting does." />

      <div className="picker" role="radiogroup" aria-label="Market">
        {markets.map((x) => {
          const mine = user?.perVault[x.vault]?.junior ?? 0n;
          return (
            <button key={x.vault} role="radio" aria-checked={x.vault === m.vault} className="pick card" onClick={() => { setSel(x.vault); keepUrl(href.cosign(x.slug)); }}>
              <span className="pick-top"><span className="pick-name"><i className="pick-dot" aria-hidden="true" /><b>{x.name}</b></span><MarketStatus m={x} /></span>
              <span className="pick-figs">
                <span><small>Your cover</small><b className="num">{user ? fmt(mine) : ctx.account ? "…" : "—"} <em>MUSD</em></b></span>
                <span><small>Market cover</small><b className="num">{fmt(x.junior)} <em>MUSD</em></b></span>
                <span><small>Cover ratio</small><b className="num">{pct(x.coverageBps)}</b></span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="split" key={m.vault}>
        <div className="split-main">
          <CoverOverview {...ctx} m={m} />
          <a className="side-link card" href={href.rewards()}><span><b>Direct MEZO rewards with veBTC</b><small>Votes count only up to the cover you post</small></span><ArrowE /></a>
        </div>
        <aside className="split-side" aria-label="Manage cover">
          <CoverActions {...ctx} m={m} />
        </aside>
      </div>
    </>
  );
}

/** The withdrawal request, decoded once for both the overview and the form (see coverExit in math.ts). */
function exitState(m: MarketState, ctx: Ctx) {
  const me = ctx.user?.perVault[m.vault];
  const e = coverExit(m, me, BigInt(Math.floor(Date.now() / 1000)));
  const reqLive = e.kind === "pending" || e.kind === "ready" || e.kind === "unavailable";
  return {
    me, e, free: coverFreeAfter(m), held: me?.juniorShares ?? 0n, expired: e.kind === "expired", reqLive,
    ready: e.kind === "ready" || e.kind === "unavailable", blocked: e.kind === "unavailable", // the vault would refuse it, so the app doesn't offer it
    reqShares: reqLive ? e.shares : 0n, reqCover: reqLive ? e.amount : 0n,
  };
}

const clock = (t: bigint) => new Date(Number(t) * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const when = (t: bigint) => new Date(Number(t) * 1000).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

/** One label per withdrawal state, the same wherever it appears. */
export function ExitLabel({ kind, amount, readyAt, deadline }: { kind: ExitKind; amount: bigint; readyAt: bigint; deadline: bigint }) {
  if (kind === "pending") return <span className="is-pending">Notice pending · {fmt(amount)} MUSD from {clock(readyAt)}</span>;
  if (kind === "ready") return <span className="is-ok">Ready to withdraw · {fmt(amount)} MUSD until {when(deadline)}</span>;
  if (kind === "unavailable") return <span className="is-loss">Withdrawal unavailable · would breach minimum cover</span>;
  if (kind === "expired") return <span>Window expired · request again</span>;
  return <span>None requested</span>;
}

function CoverOverview(ctx: Ctx & { m: MarketState }) {
  const { m, user, account } = ctx;
  const x = exitState(m, ctx);
  const gap = coverShortfall(m);
  return (
    <section className="panel card card-white" aria-labelledby="cv-h">
      <div className="panel-head">
        <h2 id="cv-h" className="panel-title"><a href={href.market(m.slug)}>{m.name}</a> cover</h2>
        <span className="t-caption">Lenders up to {m.maxLeverage.toString()}× cover</span>
      </div>
      <Stack m={m} />
      <div className="cv-compare">
        <div className="cv-mine">
          <span className="cv-k">Your cover</span>
          <b className="cv-v num">{account ? (user ? fmt(x.me?.junior ?? 0n) : "…") : "—"}<small>MUSD</small></b>
          <span className="cv-s">{account && user ? `${fmtCoverShare(x.me?.juniorShares ?? 0n, m.totalJuniorShares)} of this market's cover` : "Connect a wallet to see yours"}</span>
        </div>
        <div>
          <span className="cv-k">Market cover</span>
          <b className="cv-v num">{fmt(m.junior)}<small>MUSD</small></b>
          <span className="cv-s">{pct(m.coverageBps)} of the vault · minimum {pct(minCoverBps(m), 0)}</span>
        </div>
      </div>
      {gap > 0n && <p className="note is-loss"><b>{fmt(up2(gap))} MUSD</b> more cover reopens lender deposits here.</p>}
      {account && x.me && x.me.juniorShares > 0n && (
        <dl className="rows rows-2">
          <Row k="Available to request">{fmt(down2(x.e.available))} MUSD</Row>
          <Row k="Withdrawal"><ExitLabel {...x.e} /></Row>
          <Row k="Exit timing">{Number(m.cooldown) / 60} min notice · {Number(m.withdrawWindow) / 3600} h window</Row>
        </dl>
      )}
      <p className="risk-line">First-loss: your cover pays for bad debt before any lender and can be lost in full.</p>
      <details className="more">
        <summary>How cover works</summary>
        <ul className="more-list">
          <li>Each MUSD of cover lets lenders deposit up to {m.maxLeverage.toString()} MUSD.</li>
          <li>Leaving takes a {Number(m.cooldown) / 60}-minute notice, then you have {Number(m.withdrawWindow) / 3600} hours to withdraw. Cover keeps paying losses during the notice.</li>
          <li>You can't leave if it would drop the market below its minimum cover while today's lenders stay.</li>
          <li>Co-signers whose notice has ended can leave before a loss is booked, which leaves more of that loss to the cover that stays.</li>
        </ul>
      </details>
    </section>
  );
}

/** What posting `amount` of cover does to this market, from live vault state. Room and free cover round down. */
function coverHint(m: MarketState, amount: bigint) {
  if (amount === 0n) return null;
  const gap = coverShortfall(m);
  if (amount < gap) return `Still ${fmt(up2(gap - amount))} MUSD short: lender deposits stay paused.`;
  return `Room for lenders after this: ${fmt(down2(roomAfterCover(m, amount)))} MUSD (now ${fmt(down2(roomAfterCover(m)))}).`;
}

function CoverActions(ctx: Ctx & { m: MarketState }) {
  const { m, user, account, send, approveIfNeeded, d, busy, connect } = ctx;
  const [tab, setTab] = useState<"add" | "withdraw">("add");
  const [dep, setDep] = useState("");
  const [out, setOut] = useState("");
  const x = exitState(m, ctx);
  const me = x.me;
  const amount = toWei(dep);
  const overWallet = !!user && amount > user.musd;
  const approved = allowanceOf(user, d.musd, m.vault) >= amount;
  const outWei = toWei(out);
  const outMax = x.e.available;
  const outShares = me ? sharesForCover(outWei, me.junior, x.held) : 0n;
  const outBad = outWei > outMax;
  const hasCover = !!me && me.juniorShares > 0n;
  return (
    <div className="panel card card-white action-card">
      <div className="seg-tabs" role="tablist" aria-label="Cover action">
        <button role="tab" aria-selected={tab === "add"} onClick={() => setTab("add")}>Add cover</button>
        <button role="tab" aria-selected={tab === "withdraw"} onClick={() => setTab("withdraw")}>Withdraw</button>
      </div>
      {!account ? <ConnectGate connect={connect} what="co-sign" /> : tab === "add" ? (
        <div className="action">
          <dl className="rows">
            <Row k="Your cover">{user ? `${fmt(me?.junior ?? 0n)} MUSD` : "…"}</Row>
            <Row k="Wallet">{user ? `${fmtDown(user.musd)} MUSD` : "…"}</Row>
          </dl>
          <div className="field">
            <label htmlFor={`cov-${m.vault}`}>Cover to post</label>
            <Amount id={`cov-${m.vault}`} value={dep} onChange={setDep} unit="MUSD" max={user?.musd} invalid={overWallet} />
            {overWallet ? <span className="field-hint is-error">Your wallet has {fmtDown(user!.musd)} MUSD.</span>
              : coverHint(m, amount) && <span className="field-hint">{coverHint(m, amount)}</span>}
          </div>
          {amount > 0n && !overWallet && user && <TwoStep approve="MUSD" action="Post cover" done={approved} />}
          <button className="btn btn-dark btn-block" disabled={busy || amount === 0n || overWallet || !user}
            onClick={async function postCover() {
              if (!(await approveIfNeeded(d.musd, m.vault, amount, "MUSD", { ready: "post cover", label: `Post ${fmt(amount)} MUSD cover`, run: postCover }))) return;
              if (await send("Post cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositJunior", args: [amount] }))) setDep("");
            }}>{amount === 0n ? "Post cover" : approved ? `Post ${fmt(amount)} MUSD cover` : `Approve ${fmt(amount)} MUSD`}</button>
          <p className="risk-line">Cover pays first and can be lost in full. Leaving takes a {Number(m.cooldown) / 60}-minute notice.</p>
        </div>
      ) : !hasCover ? (
        <p className="empty-line">You have no cover on {m.name}.</p>
      ) : (
        <div className="action exit">
          {x.expired && <div className="status-box"><span className="chip">Window expired</span><p>The {Number(m.withdrawWindow) / 3600}-hour window after your notice closed. Request again to withdraw.</p></div>}
          {!x.reqLive && (
            <>
              <div className="field">
                <label htmlFor={`wd-${m.vault}`}>Cover to withdraw</label>
                <Amount id={`wd-${m.vault}`} value={out} onChange={setOut} unit="MUSD" max={outMax} invalid={outBad} />
                {outBad ? <span className="field-hint is-error">Only {fmt(down2(outMax))} MUSD is available to request.</span>
                  : <span className="field-hint">{x.free >= me!.junior
                    ? `Available to request: all ${fmt(me!.junior)} MUSD.`
                    : `Available to request: ${fmt(down2(x.free))} of your ${fmt(me!.junior)} MUSD. The rest must stay to cover today's lenders (up to ${m.maxLeverage}× cover).`}</span>}
              </div>
              <button className="btn btn-dark btn-block" disabled={busy || outWei === 0n || outBad || outShares === 0n}
                onClick={() => send("Request cover withdrawal", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "requestJuniorWithdraw", args: [outShares] })).then((ok) => ok && setOut(""))}>
                {outWei > 0n && !outBad ? `Request withdrawal of ${fmt(outWei >= me!.junior ? me!.junior : outWei)} MUSD` : "Request withdrawal"}
              </button>
              <p className="risk-line">Step 1 of 2: a {Number(m.cooldown) / 60}-minute notice, then {Number(m.withdrawWindow) / 3600} hours to withdraw. Your cover keeps paying losses until it leaves.</p>
            </>
          )}
          {x.reqLive && !x.ready && (
            <div className="status-box is-pending" role="status">
              <span className="chip chip-pending">Notice pending</span>
              <p><b className="num">{fmt(x.reqCover)} MUSD</b> can be withdrawn from <b className="num">{clock(x.e.readyAt)}</b>, if minimum cover allows it then. Until it leaves, your cover still pays losses.</p>
            </div>
          )}
          {x.reqLive && x.ready && (
            <>
              {x.blocked ? (
                <div className="status-box is-loss" role="alert">
                  <span className="chip chip-loss">Withdrawal unavailable</span>
                  <p>Withdrawing {fmt(x.reqCover)} MUSD now would drop this market below its minimum cover, so the vault would refuse it. At most {fmt(down2(x.free))} MUSD may leave while today's lenders stay. The window stays open until <b className="num">{when(x.e.deadline)}</b>.</p>
                </div>
              ) : (
                <div className="status-box is-ok">
                  <span className="chip chip-live">Ready to withdraw</span>
                  <p>Withdraw <b className="num">{fmt(x.reqCover)} MUSD</b> before <b className="num">{when(x.e.deadline)}</b>.</p>
                </div>
              )}
              {!x.blocked && <button className="btn btn-dark btn-block" disabled={busy} onClick={() => send("Withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawJunior" }))}>Withdraw {fmt(x.reqCover)} MUSD</button>}
            </>
          )}
          {me!.votes > 0n && (x.reqLive ? x.reqShares === x.held : outWei >= me!.junior) && <p className="field-hint">Remove your votes on this market (Rewards) before withdrawing all of your cover.</p>}
        </div>
      )}
    </div>
  );
}
