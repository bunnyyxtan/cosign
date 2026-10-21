import { useMemo, useState } from "react";
import { addrUrl, gaugeAbi, vaultAbi, type MarketState } from "../chain";
import { ArrowNE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { MarketStatus } from "./Markets";
import { Amount, coverFreeAfter, coverShortfall, down2, fmt, minCoverBps, pct, roomAfterCover, short, Stack, toWei, up2 } from "./ui";

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
  const me = user?.perVault[m.vault];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const req = me?.request;
  const reqLive = req && req.shares > 0n && req.round === m.round;
  const ready = reqLive && now >= req.readyAt;
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
        <div><span>Market cover</span><b className="num">{fmt(m.junior)} MUSD</b></div>
        <div><span>Share of vault</span><b className="num">{pct(m.coverageBps)}</b></div>
        <div><span>Minimum</span><b className="num">{pct(minCoverBps(m), 0)}</b></div>
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
          {!reqLive && (
            <button className="btn btn-ghost btn-block" disabled={busy} onClick={() => send("Request to withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "requestJuniorWithdraw", args: [me.juniorShares] }))}>
              Request to withdraw all cover
            </button>
          )}
          {reqLive && !ready && <p className="field-hint"><span className="chip chip-pending">Notice running</span> Ready at {new Date(Number(req!.readyAt) * 1000).toLocaleTimeString()}. Your cover still pays losses until then.</p>}
          {reqLive && ready && (
            <button className="btn btn-light btn-block" disabled={busy} onClick={() => send("Withdraw cover", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawJunior" }))}>Withdraw cover</button>
          )}
          {me.votes > 0n && <p className="field-hint">Remove your votes on this market before withdrawing all of your cover.</p>}
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

export function Rewards({ user, account, connect, markets, gauge, send, busy }: Ctx) {
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
