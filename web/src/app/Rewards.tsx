import { useEffect, useMemo, useState } from "react";
import { gaugeAbi, vaultAbi } from "../chain";
import type { Ctx } from "./ctx";
import { ConnectGate } from "./Markets";
import { allowanceOf, Amount, fmt, PageHead, pct, toWei, TwoStep } from "./ui";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const left = (s: number) => (s <= 0 ? "ended" : s < 60 ? `${s}s left` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s left`);

export function Rewards(ctx: Ctx) {
  const { user, account, markets, gauge, send, busy, connect } = ctx;
  const now = useNow();
  const claimable = markets.reduce((a, m) => a + (user?.perVault[m.vault]?.rewards ?? 0n), 0n);
  const power = (user?.veTokens ?? []).reduce((a, t) => a + t.power, 0n);
  const split = markets[0] ? markets[0].rewardJuniorBps : 0n;
  const waiting = gauge?.waiting ?? [];
  const ends = gauge ? Number(gauge.epochEnd) - now : 0;
  return (
    <>
      <PageHead title="Rewards" lede={`MEZO rewards are funded by participants through the gauge, split between markets by cover-capped veBTC votes, then streamed ${pct(split, 0)} to cover and ${pct(10_000n - split, 0)} to lenders.`} />

      <dl className="kpis card card-white">
        <div><dt>Claimable now</dt><dd className="num">{account ? (user ? fmt(claimable, 4) : "…") : "—"} <small>MEZO</small></dd></div>
        <div>
          <dt>Epoch {gauge?.epoch.toString() ?? "…"}</dt>
          <dd className="num">{gauge ? (gauge.budget > 0n ? <>{fmt(gauge.budget, 2)} <small>MEZO funded</small></> : <span className="kpi-word">Unfunded</span>) : "…"}</dd>
          <span className="kpi-s num">{gauge ? left(ends) : ""}</span>
        </div>
        <div><dt>Your voting power</dt><dd className="num">{account ? (user ? (user.veTokens.length ? fmt(power, 6) : <span className="kpi-word">No veBTC</span>) : "…") : "—"}</dd></div>
        <div><dt>Wallet</dt><dd className="num">{account && user ? fmt(user.mezo, 4) : "—"} <small>MEZO</small></dd></div>
      </dl>

      <div className="split">
        <div className="split-main">
          <section className="panel card card-white" aria-labelledby="claim-h">
            <div className="panel-head"><h2 id="claim-h" className="panel-title">Claim</h2></div>
            {!account ? <ConnectGate connect={connect} what="see and claim your rewards" /> : (
              <div className="table-wrap">
                <table className="atable">
                  <thead><tr><th>Market</th><th className="r wide-only">Your cover · lending</th><th className="r">Claimable</th><th /></tr></thead>
                  <tbody>
                    {markets.map((m) => {
                      const p = user?.perVault[m.vault];
                      const r = p?.rewards ?? 0n;
                      return (
                        <tr key={m.vault}>
                          <td><a href={`#/market/${m.vault}`}>{m.name}</a></td>
                          <td className="r num wide-only">{p ? `${fmt(p.junior)} · ${fmt(p.senior)}` : "…"}</td>
                          <td className="r num"><b>{user ? fmt(r, 4) : "…"}</b> <small>MEZO</small></td>
                          <td className="r"><button className="btn btn-dark btn-sm" disabled={busy || !user || r === 0n}
                            onClick={() => send(`Claim MEZO · ${m.name}`, (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "claimRewards" }))}>Claim</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {account && user && claimable === 0n && <p className="field-hint">Nothing to claim yet. Rewards appear here while a distributed epoch streams out.</p>}
          </section>

          <VotePanel {...ctx} />
        </div>

        <aside className="split-side" aria-label="Epochs and funding">
          <section className="panel card card-white" aria-labelledby="ep-h">
            <div className="panel-head"><h2 id="ep-h" className="panel-title">Epochs</h2>{gauge && <span className="t-caption num">Now {gauge.epoch.toString()}</span>}</div>
            <div className={`status-box ${gauge && gauge.budget > 0n ? "is-ok" : ""}`}>
              <span className={`chip ${gauge && gauge.budget > 0n ? "chip-live" : ""}`}>{gauge && gauge.budget > 0n ? "Funded" : "Unfunded"}</span>
              <p>{gauge && gauge.budget > 0n
                ? <>This epoch holds <b className="num">{fmt(gauge.budget, 2)} MEZO</b>. Anyone can distribute it once it ends ({left(ends)}).</>
                : <>Nothing is funded for this epoch, so it will pay no rewards unless someone adds MEZO before it ends ({left(ends)}).</>}</p>
            </div>
            {waiting.length > 0 ? (
              <ul className="epochs">
                {waiting.map((w) => (
                  <li key={w.epoch.toString()}>
                    <span><b className="num">Epoch {w.epoch.toString()}</b><small className="num">{fmt(w.budget, 4)} MEZO · ended, not distributed</small></span>
                    <button className="btn btn-dark btn-sm" disabled={busy || !account}
                      onClick={() => send(`Distribute epoch ${w.epoch}`, (wc) => wc.writeContract({ address: ctx.d.gauge, abi: gaugeAbi, functionName: "distribute", args: [w.epoch] }))}>Distribute</button>
                  </li>
                ))}
              </ul>
            ) : <p className="field-hint">No ended epoch is waiting to be distributed.</p>}
            {account && <FundForm {...ctx} />}
          </section>
        </aside>
      </div>
    </>
  );
}

/** Anyone can add MEZO to the current epoch's budget. */
function FundForm({ user, gauge, send, approveIfNeeded, d, busy }: Ctx) {
  const [amt, setAmt] = useState("");
  const wei = toWei(amt);
  const over = !!user && wei > user.mezo;
  const approved = allowanceOf(user, d.mezo, d.gauge) >= wei;
  return (
    <details className="more fund">
      <summary>Fund this epoch</summary>
      <div className="action">
        <div className="field">
          <label htmlFor="fund">MEZO to add to epoch {gauge?.epoch.toString()}</label>
          <Amount id="fund" value={amt} onChange={setAmt} unit="MEZO" max={user?.mezo} invalid={over} />
          {over && <span className="field-hint is-error">Your wallet has {fmt(user!.mezo, 4)} MEZO.</span>}
        </div>
        {wei > 0n && !over && user && <TwoStep approve="MEZO" action="Fund" done={approved} />}
        <button className="btn btn-dark btn-block" disabled={busy || wei === 0n || over || !user}
          onClick={async function fundEpoch() {
            if (!(await approveIfNeeded(d.mezo, d.gauge, wei, "MEZO", { ready: "add it to the budget", label: `Add ${fmt(wei, 4)} MEZO`, run: fundEpoch }))) return;
            if (await send("Fund rewards", (w) => w.writeContract({ address: d.gauge, abi: gaugeAbi, functionName: "fund", args: [wei] }))) setAmt("");
          }}>{wei === 0n ? "Add to the budget" : approved ? `Add ${fmt(wei, 4)} MEZO` : `Approve ${fmt(wei, 4)} MEZO`}</button>
        <p className="risk-line">It leaves your wallet for good. You get back only your share of what's distributed, if any.</p>
      </div>
    </details>
  );
}

function VotePanel({ user, account, markets, send, d, gauge, busy }: Ctx) {
  const tokens = user?.veTokens ?? [];
  const [sel, setSel] = useState<bigint | null>(null);
  const [w, setW] = useState<Record<string, number>>({});
  const token = useMemo(() => tokens.find((t) => t.id === sel) ?? tokens[0], [tokens, sel]);
  const eligible = markets.filter((m) => (user?.perVault[m.vault]?.juniorShares ?? 0n) > 0n);
  const total = eligible.reduce((a, m) => a + (w[m.vault] ?? 0), 0);
  return (
    <section className="panel card card-white" aria-labelledby="vote-h">
      <div className="panel-head">
        <h2 id="vote-h" className="panel-title">Vote with veBTC</h2>
        {gauge && <span className="t-caption num">Epoch {gauge.epoch.toString()}</span>}
      </div>
      {!account ? <p className="empty-line">Connect a wallet to vote.</p>
        : !user ? <p className="empty-line" role="status"><span className="spin" />Loading your positions…</p>
        : tokens.length === 0 ? (
          <p className="empty-line">No veBTC in this wallet. Lock BTC for veBTC on <a href="https://testnet.mezo.org" target="_blank" rel="noreferrer">testnet.mezo.org</a> to vote.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ve">veBTC position</label>
              <select id="ve" className="select" value={token?.id.toString()} onChange={(e) => setSel(BigInt(e.target.value))}>
                {tokens.map((t) => <option key={t.id.toString()} value={t.id.toString()}>#{t.id.toString()} · {fmt(t.power, 6)} voting power</option>)}
              </select>
            </div>
            {eligible.length === 0 ? <p className="note">You can vote only for markets where you hold cover. <a href="#/cosign">Post cover</a> first.</p> : (
              <div className="sliders">
                {eligible.map((m) => (
                  <div key={m.vault} className="slider">
                    <label htmlFor={`w-${m.vault}`}>{m.name}</label>
                    <input id={`w-${m.vault}`} type="range" min={0} max={100} value={w[m.vault] ?? 0} onChange={(e) => setW({ ...w, [m.vault]: Number(e.target.value) })} />
                    <span className="num">{total ? Math.round(((w[m.vault] ?? 0) / total) * 100) : 0}%</span>
                    <small className="num">current votes {fmt(token?.votes[m.vault] ?? 0n, 6)}</small>
                  </div>
                ))}
              </div>
            )}
            {token?.votedThisEpoch && <p className="field-hint">Position #{token.id.toString()} already voted this epoch. It can vote again next epoch.</p>}
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
            <p className="risk-line">A market's votes count only up to what its cover backs. One vote per position per epoch.</p>
          </>
        )}
    </section>
  );
}
