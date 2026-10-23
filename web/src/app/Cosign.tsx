import { useMemo, useState } from "react";
import { addrUrl, gaugeAbi, vaultAbi, type MarketState } from "../chain";
import { ArrowNE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { MarketStatus } from "./Markets";
import { Amount, coverForShares, coverFreeAfter, coverShortfall, down2, fmt, fmtCoverShare, minCoverBps, pct, roomAfterCover, sharesForCover, short, Stack, toWei, up2 } from "./ui";

export function Cosign(ctx: Ctx) {
  const { account, connect, markets } = ctx;
  const notice = markets[0] ? Number(markets[0].cooldown) / 60 : 0;
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Workspace / Co-sign</span>
          <h1 className="page-title">Co-sign a market</h1>
          <p className="page-lede">Post MUSD cover in front of lenders and vote MEZO rewards toward it with veBTC. Cover opens room for lenders and earns a premium on their interest.</p>
        </div>
      </header>

      <section className="risk card" aria-labelledby="risk-h">
        <span className="chip chip-loss chip-plain">First-loss</span>
        <div>
          <h2 id="risk-h" className="panel-title">What you are signing up for</h2>
          <p>
            Your cover pays first. If a liquidation leaves bad debt, it is taken from cover before any lender loses money, and you can lose all of it.
            Leaving takes a {notice}-minute notice, and you cannot leave if that would drop the market below its minimum cover. Co-signers whose notice
            has ended can leave before a loss is booked, which leaves more of that loss to the cover that stays.
          </p>
        </div>
      </section>

      {!account ? (
        <div className="empty card card-white">
          <h2 className="panel-title">Connect a wallet to co-sign</h2>
          <p>You need a wallet on Mezo testnet with some MUSD, and a veBTC lock to vote. Nothing here has value.</p>
          <div className="empty-actions">
            <button className="btn btn-dark" onClick={connect}>Connect wallet</button>
            <a className="btn btn-ghost" href="#/evidence">See the recorded run without a wallet</a>
          </div>
        </div>
      ) : (
        <>
          <div className="cover-grid">{markets.map((m) => <CoverPanel key={m.vault} {...ctx} m={m} />)}</div>
          <VotePanel {...ctx} />
        </>
      )}
    </>
  );
}

/** What posting `amount` of cover does to this market, from live vault state. Room and free cover round down. */
function coverHint(m: MarketState, amount: bigint) {
  if (amount === 0n) return `Each MUSD of cover allows up to ${m.maxLeverage} MUSD from lenders, once today's lenders are covered.`;
  const gap = coverShortfall(m);
  if (amount < gap) return `Still ${fmt(up2(gap - amount))} MUSD short: lender deposits stay paused.`;
  const room = `Room for new lender deposits after this: ${fmt(down2(roomAfterCover(m, amount)))} MUSD (now ${fmt(down2(roomAfterCover(m)))}).`;
  return m.senior > 0n ? `${room} While today's lenders stay, cover can shrink by at most ${fmt(down2(coverFreeAfter(m, amount)))} MUSD.` : room;
}

function CoverPanel({ m, user, send, approveIfNeeded, d, busy }: Ctx & { m: MarketState }) {
  const [dep, setDep] = useState("");
  const [out, setOut] = useState("");
  const me = user?.perVault[m.vault];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const req = me?.request;
  const reqPending = !!req && req.shares > 0n && req.round === m.round;
  const expired = reqPending && now > req!.readyAt + m.withdrawWindow;   // the window after the notice has closed
  const reqLive = reqPending && !expired;
  const ready = reqLive && now >= req!.readyAt;
  // Cover that can leave right now: lenders may hold at most maxLeverage x the cover that stays.
  const free = coverFreeAfter(m);
  const held = me?.juniorShares ?? 0n;
  const reqShares = reqLive ? (req!.shares < held ? req!.shares : held) : 0n;
  const reqCover = coverForShares(reqShares, m);
  const blocked = !!ready && reqCover > free;   // the vault would refuse it, so the app does not offer to send it
  const outWei = toWei(out);
  const outMax = me ? (me.junior < free ? me.junior : free) : 0n;
  const outShares = me ? sharesForCover(outWei, me.junior, held) : 0n;
  const outBad = outWei > outMax;
  const amount = toWei(dep);
  const overWallet = !!user && amount > user.musd;
  const gap = coverShortfall(m);
  return (
    <section className="panel card card-white" aria-labelledby={`cv-${m.vault}`}>
      <div className="panel-head">
        <h2 id={`cv-${m.vault}`} className="panel-title"><a href={`#/market/${m.vault}`}>{m.name}</a></h2>
        <MarketStatus m={m} />
      </div>
      <Stack m={m} compact />
      <div className="held held-grid">
        <div><span>Your cover</span><b className="num">{user ? `${fmt(me?.junior ?? 0n)} MUSD` : "…"}</b></div>
        <div><span>Your share of cover</span><b className="num">{user ? fmtCoverShare(me?.juniorShares ?? 0n, m.totalJuniorShares) : "…"}</b></div>
        <div><span>Market cover</span><b className="num">{fmt(m.junior)} MUSD</b></div>
        <div><span>Market cover ratio</span><b className="num">{pct(m.coverageBps)} <small className="held-sub">minimum {pct(minCoverBps(m), 0)}</small></b></div>
      </div>
      {gap > 0n && <p className="note is-loss"><b>{fmt(up2(gap))} MUSD</b> more cover reopens lender deposits here.</p>}
      <div className="field">
        <label htmlFor={`cov-${m.vault}`}>Post cover</label>
        <Amount id={`cov-${m.vault}`} value={dep} onChange={setDep} unit="MUSD" max={user?.musd} invalid={overWallet} />
        {overWallet ? <span className="field-hint is-error">You have {fmt(user!.musd)} MUSD in this wallet.</span>
          : <span className="field-hint">{coverHint(m, amount)}</span>}
      </div>
      <button className="btn btn-dark btn-block" disabled={busy || amount === 0n || overWallet}
        onClick={async function postCover() {
          if (!(await approveIfNeeded(d.musd, m.vault, amount, "MUSD", { ready: "deposit", label: `Post ${fmt(amount)} MUSD cover`, run: postCover }))) return;
          if (await send("Post cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositJunior", args: [amount] }))) setDep("");
        }}>Post cover</button>
      {me && me.juniorShares > 0n && (
        <div className="exit">
          {expired && <p className="note">Your last withdrawal request ran out: the {Number(m.withdrawWindow) / 3600}-hour window after the notice has closed. Request again.</p>}
          {!reqLive && (
            <>
              <div className="field">
                <label htmlFor={`wd-${m.vault}`}>Withdraw cover</label>
                <Amount id={`wd-${m.vault}`} value={out} onChange={setOut} unit="MUSD" max={outMax} invalid={outBad} />
                {outBad ? <span className="field-hint is-error">Only {fmt(down2(outMax))} MUSD can leave now.</span>
                  : <span className="field-hint">{free >= me.junior
                    ? `All of your cover can leave now. Notice: ${Number(m.cooldown) / 60} minutes, then ${Number(m.withdrawWindow) / 3600} hours to withdraw.`
                    : `${fmt(down2(free))} MUSD of your ${fmt(me.junior)} can leave while today's lenders stay: lenders may hold at most ${m.maxLeverage}× the cover that remains. Notice: ${Number(m.cooldown) / 60} minutes.`}</span>}
              </div>
              <button className="btn btn-ghost btn-block" disabled={busy || outWei === 0n || outBad || outShares === 0n}
                onClick={() => send("Request to withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "requestJuniorWithdraw", args: [outShares] })).then((ok) => ok && setOut(""))}>
                {outWei > 0n && !outBad ? `Request withdrawal of ${fmt(outWei >= me.junior ? me.junior : outWei)} MUSD` : "Request withdrawal"}
              </button>
            </>
          )}
          {reqLive && !ready && <p className="field-hint"><span className="chip chip-pending">Notice running</span> {fmt(reqCover)} MUSD can be withdrawn from {new Date(Number(req!.readyAt) * 1000).toLocaleTimeString()}. Your cover still pays losses until then.</p>}
          {reqLive && ready && (
            <>
              <p className="field-hint"><span className="chip chip-live">Ready</span> Withdraw {fmt(reqCover)} MUSD before {new Date(Number(req!.readyAt + m.withdrawWindow) * 1000).toLocaleString()}.</p>
              {blocked && <p className="note is-loss" role="alert">Withdrawing {fmt(reqCover)} MUSD now would drop this market below its minimum cover, so the vault would refuse it. At most {fmt(down2(free))} MUSD can leave while today's lenders stay.</p>}
              <button className="btn btn-light btn-block" disabled={busy || blocked} onClick={() => send("Withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawJunior" }))}>Withdraw {fmt(reqCover)} MUSD</button>
            </>
          )}
          {me.votes > 0n && (reqLive ? reqShares === held : outWei >= me.junior) && <p className="field-hint">Remove your votes on this market before withdrawing all of your cover.</p>}
        </div>
      )}
    </section>
  );
}

function VotePanel({ user, markets, send, d, gauge, busy }: Ctx) {
  const tokens = user?.veTokens ?? [];
  const [sel, setSel] = useState<bigint | null>(null);
  const [w, setW] = useState<Record<string, number>>({});
  const token = useMemo(() => tokens.find((t) => t.id === sel) ?? tokens[0], [tokens, sel]);
  const eligible = markets.filter((m) => (user?.perVault[m.vault]?.juniorShares ?? 0n) > 0n);
  const total = eligible.reduce((a, m) => a + (w[m.vault] ?? 0), 0);
  return (
    <section className="panel card card-white" aria-labelledby="vote-h">
      <div className="panel-head">
        <h2 id="vote-h" className="panel-title">Vote MEZO rewards with veBTC</h2>
        {gauge && <span className="t-caption num">Epoch {gauge.epoch.toString()}</span>}
      </div>
      <p className="action-lede">You can vote only for markets where you hold cover, and a market's votes count only up to what its cover backs. Lock BTC for veBTC on <a href="https://testnet.mezo.org" target="_blank" rel="noreferrer">testnet.mezo.org</a>.</p>
      {!user ? <p className="empty-line" role="status"><span className="spin" />Loading your positions…</p> : tokens.length === 0 ? <p className="empty-line">No veBTC in this wallet.</p> : (
        <>
          <div className="field">
            <label htmlFor="ve">veBTC position</label>
            <select id="ve" className="select" value={token?.id.toString()} onChange={(e) => setSel(BigInt(e.target.value))}>
              {tokens.map((t) => <option key={t.id.toString()} value={t.id.toString()}>#{t.id.toString()}: {fmt(t.power, 6)} voting power</option>)}
            </select>
          </div>
          {eligible.length === 0 ? <p className="note">Post cover on a market first.</p> : (
            <div className="sliders">
              {eligible.map((m) => (
                <div key={m.vault} className="slider">
                  <label htmlFor={`w-${m.vault}`}>{m.name}</label>
                  <input id={`w-${m.vault}`} type="range" min={0} max={100} value={w[m.vault] ?? 0} onChange={(e) => setW({ ...w, [m.vault]: Number(e.target.value) })} />
                  <span className="num">{total ? Math.round(((w[m.vault] ?? 0) / total) * 100) : 0}%</span>
                  <small className="num">now {fmt(token?.votes[m.vault] ?? 0n, 6)}</small>
                </div>
              ))}
            </div>
          )}
          {token?.votedThisEpoch && <p className="field-hint">This position already voted in epoch {gauge?.epoch.toString()}. You can vote again next epoch.</p>}
          <div className="btn-row">
            <button className="btn btn-dark" disabled={busy || !token || total === 0 || token.votedThisEpoch}
              onClick={() => {
                const ms = eligible.filter((m) => (w[m.vault] ?? 0) > 0);
                send("Vote", (wc) => wc.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "vote", args: [token!.id, ms.map((m) => m.vault), ms.map((m) => BigInt(w[m.vault]))] }));
              }}>Vote</button>
            {token && Object.values(token.votes).some((v) => v > 0n) && (
              <button className="btn btn-ghost" disabled={busy} onClick={() => send("Remove votes", (wc) => wc.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "reset", args: [token.id] }))}>Remove votes</button>
            )}
          </div>
        </>
      )}
      <p className="fine">Gauge <a href={addrUrl(d.gauge)} target="_blank" rel="noreferrer">{short(d.gauge)} <ArrowNE size={12} /></a></p>
    </section>
  );
}

/** Anyone can add MEZO to the current epoch's budget and, once an epoch is over, distribute it. */
function FundPanel({ user, gauge, send, approveIfNeeded, d, busy }: Ctx) {
  const [amt, setAmt] = useState("");
  const wei = toWei(amt);
  const over = !!user && wei > user.mezo;
  return (
    <section className="panel card card-white" aria-labelledby="fund-h">
      <div className="panel-head">
        <h2 id="fund-h" className="panel-title">Fund and distribute</h2>
        {gauge && <span className="t-caption num">Epoch {gauge.epoch.toString()}</span>}
      </div>
      <p className="action-lede">Anyone can add MEZO to the current epoch's budget. Once the epoch is over, anyone can distribute it: it is split between markets by vote weight, then each market's cover holders and lenders claim their share as it streams out.</p>
      <div className="field">
        <label htmlFor="fund">Add MEZO to this epoch</label>
        <Amount id="fund" value={amt} onChange={setAmt} unit="MEZO" max={user?.mezo} invalid={over} />
        {over ? <span className="field-hint is-error">You have {fmt(user!.mezo, 4)} MEZO in this wallet.</span>
          : <span className="field-hint">Testnet MEZO. It leaves your wallet for good; you get back only your own share of what is distributed.</span>}
      </div>
      <button className="btn btn-dark btn-block" disabled={busy || wei === 0n || over}
        onClick={async function fundEpoch() {
          if (!(await approveIfNeeded(d.mezo, d.gauge, wei, "MEZO", { ready: "add it to the budget", label: `Add ${fmt(wei, 4)} MEZO`, run: fundEpoch }))) return;
          if (await send("Fund rewards", (w) => w.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "fund", args: [wei] }))) setAmt("");
        }}>Add to the budget</button>
      {gauge && gauge.waiting.length > 0 ? (
        <div className="table-wrap">
          <table className="atable">
            <thead><tr><th>Finished epoch</th><th className="r">Budget</th><th /></tr></thead>
            <tbody>
              {gauge.waiting.map((w) => (
                <tr key={w.epoch.toString()}>
                  <td className="num">Epoch {w.epoch.toString()}</td>
                  <td className="r num">{fmt(w.budget, 4)} MEZO</td>
                  <td className="r"><button className="btn btn-light btn-sm" disabled={busy}
                    onClick={() => send(`Distribute epoch ${w.epoch}`, (wc) => wc.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "distribute", args: [w.epoch] }))}>Distribute</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="field-hint">Nothing is waiting to be distributed.</p>}
    </section>
  );
}

export function Rewards(ctx: Ctx) {
  const { user, account, connect, markets, gauge, send, busy } = ctx;
  const split = markets[0] ? Number(markets[0].rewardJuniorBps) / 100 : 0;
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Workspace / Rewards</span>
          <h1 className="page-title">MEZO rewards</h1>
          <p className="page-lede">Rewards are funded by the Cosign team, not by Mezo protocol emissions. They stream over each epoch after the gauge distributes them. Cover holders get {split}% of a market's rewards; lenders get the rest.</p>
        </div>
      </header>
      {gauge && (
        <dl className="kpis card card-white">
          <div><dt>Epoch</dt><dd className="num">{gauge.epoch.toString()}</dd></div>
          <div><dt>Ends</dt><dd className="num">{new Date(Number(gauge.epochEnd) * 1000).toLocaleTimeString()}</dd></div>
          <div><dt>Budget</dt><dd className="num">{fmt(gauge.budget, 0)} <small>MEZO</small></dd></div>
          <div><dt>Wallet MEZO</dt><dd className="num">{user ? fmt(user.mezo, 4) : "—"}</dd></div>
        </dl>
      )}
      {account && <FundPanel {...ctx} />}
      {!account ? (
        <div className="empty card card-white"><h2 className="panel-title">Connect a wallet to see your rewards</h2><button className="btn btn-dark" onClick={connect}>Connect wallet</button></div>
      ) : (
        <section className="panel card card-white" aria-label="Claimable rewards">
          <div className="table-wrap">
            <table className="atable">
              <thead><tr><th>Market</th><th className="r">Ready to claim</th><th /></tr></thead>
              <tbody>
                {markets.map((m) => {
                  const r = user?.perVault[m.vault]?.rewards ?? 0n;
                  return (
                    <tr key={m.vault}>
                      <td><a href={`#/market/${m.vault}`}>{m.name}</a></td>
                      <td className="r num">{user ? `${fmt(r, 4)} MEZO` : "…"}</td>
                      <td className="r"><button className="btn btn-dark btn-sm" disabled={busy || !user || r === 0n}
                        onClick={() => send("Claim MEZO", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "claimRewards" }))}>Claim</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
