import { useState } from "react";
import type { Address } from "viem";
import { vaultAbi, type MarketState } from "../chain";
import { ArrowE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { ConnectGate, MarketStatus } from "./Markets";
import { href, keepUrl } from "./routes";
import {
  allowanceOf, Amount, coverForShares, coverFreeAfter, coverShortfall, down2, fmt, fmtCoverShare, minCoverBps, PageHead, pct, roomAfterCover,
  Row, sharesForCover, Stack, toWei, TwoStep, up2,
} from "./ui";

export function Cosign(ctx: Ctx & { vault?: Address }) {
  const { markets, user, vault } = ctx;
  const held = markets.find((m) => (user?.perVault[m.vault]?.juniorShares ?? 0n) > 0n);
  const [sel, setSel] = useState<Address | undefined>(vault);
  const m = markets.find((x) => x.vault.toLowerCase() === (sel ?? held?.vault ?? markets[0].vault).toLowerCase()) ?? markets[0];
  return (
    <>
      <PageHead title="Co-sign" lede="Post MUSD as first-loss cover in front of a market's lenders. You earn a premium on their interest and a share of MEZO rewards. No veBTC needed." />

      <div className="picker" role="radiogroup" aria-label="Market">
        {markets.map((x) => {
          const mine = user?.perVault[x.vault]?.junior ?? 0n;
          return (
            <button key={x.vault} role="radio" aria-checked={x.vault === m.vault} className="pick card" onClick={() => { setSel(x.vault); keepUrl(href.cosign(x.slug)); }}>
              <span className="pick-top"><b>{x.name}</b><MarketStatus m={x} /></span>
              <span className="pick-figs">
                <span><small>Your cover</small><b className="num">{user ? `${fmt(mine)}` : "—"}</b></span>
                <span><small>Market cover</small><b className="num">{fmt(x.junior)}</b></span>
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

/** The withdrawal request, decoded once for both the overview and the form. */
function exitState(m: MarketState, ctx: Ctx) {
  const me = ctx.user?.perVault[m.vault];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const req = me?.request;
  const reqPending = !!req && req.shares > 0n && req.round === m.round;
  const expired = reqPending && now > req!.readyAt + m.withdrawWindow; // the window after the notice has closed
  const reqLive = reqPending && !expired;
  const ready = reqLive && now >= req!.readyAt;
  // Cover that can leave right now: lenders may hold at most maxLeverage x the cover that stays.
  const free = coverFreeAfter(m);
  const held = me?.juniorShares ?? 0n;
  const reqShares = reqLive ? (req!.shares < held ? req!.shares : held) : 0n;
  const reqCover = coverForShares(reqShares, m);
  const blocked = !!ready && reqCover > free; // the vault would refuse it, so the app does not offer to send it
  return { me, req, expired, reqLive, ready, free, held, reqShares, reqCover, blocked };
}

function CoverOverview(ctx: Ctx & { m: MarketState }) {
  const { m, user, account } = ctx;
  const x = exitState(m, ctx);
  const gap = coverShortfall(m);
  const canLeave = x.me ? (x.me.junior < x.free ? x.me.junior : x.free) : 0n;
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
          <Row k="Can leave now">{fmt(down2(canLeave))} MUSD</Row>
          <Row k="Withdrawal">{x.reqLive ? (x.ready ? <span className="is-ok">Ready · {fmt(x.reqCover)} MUSD</span> : <>Notice running until {new Date(Number(x.req!.readyAt) * 1000).toLocaleTimeString()}</>) : x.expired ? "Window closed" : "None requested"}</Row>
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
  const outMax = me ? (me.junior < x.free ? me.junior : x.free) : 0n;
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
            <Row k="Wallet">{user ? `${fmt(user.musd)} MUSD` : "…"}</Row>
          </dl>
          <div className="field">
            <label htmlFor={`cov-${m.vault}`}>Cover to post</label>
            <Amount id={`cov-${m.vault}`} value={dep} onChange={setDep} unit="MUSD" max={user?.musd} invalid={overWallet} />
            {overWallet ? <span className="field-hint is-error">Your wallet has {fmt(user!.musd)} MUSD.</span>
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
          {x.expired && <p className="note">Your last request expired: the {Number(m.withdrawWindow) / 3600}-hour window after the notice closed. Request again.</p>}
          {!x.reqLive && (
            <>
              <div className="field">
                <label htmlFor={`wd-${m.vault}`}>Cover to withdraw</label>
                <Amount id={`wd-${m.vault}`} value={out} onChange={setOut} unit="MUSD" max={outMax} invalid={outBad} />
                {outBad ? <span className="field-hint is-error">Only {fmt(down2(outMax))} MUSD can leave now.</span>
                  : <span className="field-hint">{x.free >= me!.junior
                    ? `All of your cover can leave. Notice: ${Number(m.cooldown) / 60} minutes.`
                    : `${fmt(down2(x.free))} of your ${fmt(me!.junior)} MUSD can leave while today's lenders stay (at most ${m.maxLeverage}× the cover that remains).`}</span>}
              </div>
              <button className="btn btn-dark btn-block" disabled={busy || outWei === 0n || outBad || outShares === 0n}
                onClick={() => send("Request cover withdrawal", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "requestJuniorWithdraw", args: [outShares] })).then((ok) => ok && setOut(""))}>
                {outWei > 0n && !outBad ? `Request withdrawal of ${fmt(outWei >= me!.junior ? me!.junior : outWei)} MUSD` : "Request withdrawal"}
              </button>
              <p className="risk-line">Step 1 of 2. Your cover keeps paying losses during the {Number(m.cooldown) / 60}-minute notice.</p>
            </>
          )}
          {x.reqLive && !x.ready && (
            <div className="status-box is-pending" role="status">
              <span className="chip chip-pending">Notice running</span>
              <p><b className="num">{fmt(x.reqCover)} MUSD</b> can be withdrawn from <b className="num">{new Date(Number(x.req!.readyAt) * 1000).toLocaleTimeString()}</b>. Until then your cover still pays losses.</p>
            </div>
          )}
          {x.reqLive && x.ready && (
            <>
              <div className="status-box is-ok">
                <span className="chip chip-live">Ready</span>
                <p>Withdraw <b className="num">{fmt(x.reqCover)} MUSD</b> before <b className="num">{new Date(Number(x.req!.readyAt + m.withdrawWindow) * 1000).toLocaleString()}</b>.</p>
              </div>
              {x.blocked && <p className="note is-loss" role="alert">Withdrawing {fmt(x.reqCover)} MUSD now would drop this market below its minimum cover, so the vault would refuse it. At most {fmt(down2(x.free))} MUSD can leave while today's lenders stay.</p>}
              <button className="btn btn-dark btn-block" disabled={busy || x.blocked} onClick={() => send("Withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawJunior" }))}>Withdraw {fmt(x.reqCover)} MUSD</button>
            </>
          )}
          {me!.votes > 0n && (x.reqLive ? x.reqShares === x.held : outWei >= me!.junior) && <p className="field-hint">Remove your votes on this market (Rewards) before withdrawing all of your cover.</p>}
        </div>
      )}
    </div>
  );
}
