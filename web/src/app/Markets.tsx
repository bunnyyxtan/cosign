import { useEffect, useState } from "react";
import type { Address } from "viem";
import { addrUrl, client, morphoAbi, txUrl, vaultAbi, type LossEvent, type MarketState } from "../chain";
import { ArrowE, ArrowNE } from "../ui/Icon";
import { Art } from "../ui/Art";
import type { Ctx } from "./ctx";
import { Amount, aprs, apr, coverShortfall, Figure, fmt, marketKey, minCoverBps, pct, pctTrim, Stack, toWei, up2, WAD } from "./ui";


export function MarketStatus({ m }: { m: MarketState }) {
  if (m.undercovered) return <span className="chip chip-loss">Under-covered</span>;
  if (m.senior + m.junior === 0n) return <span className="chip">No deposits yet</span>;
  return <span className="chip chip-live">Open to lenders</span>;
}

// ================================================================ overview

export function Markets({ markets, gauge, price, losses }: Ctx) {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Workspace / Markets</span>
          <h1 className="page-title">Markets</h1>
          <p className="page-lede">Each market is a Cosign vault in front of a Morpho Blue market. Cover pays first; lenders pay only for a loss larger than the cover.</p>
        </div>
        <ul className="legend-row" aria-label="Legend">
          <li><i className="sw sw-cover" />Cover, pays first</li>
          <li><i className="sw sw-senior" />Lender deposits</li>
          <li><i className="sw sw-room" />Room to lend</li>
          <li><i className="sw-min" />Minimum cover</li>
        </ul>
      </header>

      <div className="mk-grid">
        {markets.map((m) => {
          const a = aprs(m);
          const share = gauge && gauge.totalWeight > 0n ? Number((m.weight * 10_000n) / gauge.totalWeight) : 0;
          // losses arrive newest first
          const loss = losses?.find((l) => l.vault.toLowerCase() === m.vault.toLowerCase());
          const short = coverShortfall(m);
          return (
            <article className="mk card card-white" key={m.vault}>
              <div className="mk-head">
                <div className="mk-art"><Art slot={marketKey(m)} /></div>
                <div className="mk-title">
                  <h2><a href={`#/market/${m.vault}`}>{m.name}</a></h2>
                  <p>Up to {pctTrim((m.lltv * 10_000n) / WAD)} loan-to-value · lenders up to {m.maxLeverage.toString()}× cover</p>
                </div>
                <MarketStatus m={m} />
              </div>

              <Stack m={m} />

              <dl className="mk-figs">
                <Figure k="Cover" v={fmt(m.junior)} unit="MUSD" sub={`${pct(m.coverageBps)} of the vault · minimum ${pct(minCoverBps(m), 0)}`} tone="cover" />
                <Figure k="Lender deposits" v={fmt(m.senior)} unit="MUSD" />
                <Figure k="Room to lend" v={fmt(m.capacity)} unit="MUSD" />
                <Figure k="Lender APR" v={apr(a.senior)} sub={`${(a.util * 100).toFixed(0)}% borrowed`} />
                <Figure k="Co-signer APR" v={apr(a.junior)} sub="before MEZO rewards" />
                <Figure k="Reward weight" v={`${(share / 100).toFixed(1)}%`} sub={gauge ? (gauge.budget > 0n ? `of ${fmt(gauge.budget, 0)} MEZO this epoch` : "no reward budget this epoch") : undefined} />
              </dl>

              {m.undercovered && (
                <p className="note is-loss">
                  <b>{fmt(up2(short))} MUSD</b> more cover reopens lender deposits. Until then, deposits and cover withdrawals are paused; borrowing on Morpho is not.
                </p>
              )}
              {loss && <p className="note">Last loss {fmt(loss.loss)} MUSD: cover paid {fmt(loss.byJunior)}, lenders paid {fmt(loss.bySenior)}. <a href={txUrl(loss.tx)} target="_blank" rel="noreferrer">Transaction</a></p>}

              <div className="mk-foot">
                <a className="btn btn-dark" href={`#/market/${m.vault}`}>Open market <ArrowE /></a>
                <a className="btn btn-ghost" href="#/cosign">Co-sign</a>
              </div>
            </article>
          );
        })}
      </div>

      <p className="fine">MEZO price {fmt(price / WAD, 4)} MUSD from the demo oracle the Cosign team controls; not a market price. Room to lend caps deposits into a Cosign vault, not borrowing on Morpho.</p>
    </>
  );
}

// ================================================================ detail

export function MarketDetail(ctx: Ctx & { vault: Address }) {
  const { markets, vault, losses, d } = ctx;
  const m = markets.find((x) => x.vault.toLowerCase() === vault.toLowerCase());
  const mine = losses?.filter((l) => l.vault.toLowerCase() === vault.toLowerCase());
  const [replay, setReplay] = useState<LossEvent | null>(null);
  const [tab, setTab] = useState<"lend" | "borrow">("lend");
  if (!m) return <div className="empty"><h1 className="page-title">Unknown market</h1><p>That address is not a Cosign vault in this deployment.</p><a className="btn btn-dark" href="#/markets">Back to markets</a></div>;
  const a = aprs(m);
  const short = coverShortfall(m);

  return (
    <>
      <nav className="crumb" aria-label="Breadcrumb"><a href="#/markets">Markets</a><span>/</span><span aria-current="page">{m.name}</span></nav>
      <header className="page-head detail-head">
        <div>
          <div className="detail-title"><h1 className="page-title">{m.name}</h1><MarketStatus m={m} /></div>
          <p className="page-lede">
            Lenders' MUSD is lent on <a href={addrUrl(d.morpho)} target="_blank" rel="noreferrer">Morpho Blue</a> against MEZO up to {pctTrim((m.lltv * 10_000n) / WAD)} loan-to-value.
            Cover from co-signers sits in front of it.
          </p>
        </div>
        <a className="link" href={addrUrl(m.vault)} target="_blank" rel="noreferrer">Vault contract <ArrowNE size={14} /></a>
      </header>

      <div className="detail-grid">
        <div className="detail-main">
          <section className="panel card card-white" aria-labelledby="books">
            <div className="panel-head">
              <h2 id="books" className="panel-title">{replay ? "Replay of a recorded loss" : "Capital stack"}</h2>
              {replay ? <span className="chip chip-recorded">Recorded · block {replay.block.toString()}</span> : <span className="chip chip-live">Live</span>}
            </div>
            {replay ? <LossReplay m={m} ev={replay} onDone={() => setReplay(null)} /> : <Stack m={m} />}
            <dl className="detail-figs">
              <Figure k="Cover absorbs the first" v={fmt(m.junior)} unit="MUSD" sub={`${pct(m.coverageBps)} of the vault`} tone="cover" />
              <Figure k="Lender deposits" v={fmt(m.senior)} unit="MUSD" />
              <Figure k="Lender share value" v={fmt(m.seniorPrice, 9)} sub="MUSD per starting MUSD" />
              <Figure k="Room to lend" v={fmt(m.capacity)} unit="MUSD" />
              <Figure k="Lender APR" v={apr(a.senior)} sub={`${(a.util * 100).toFixed(0)}% of the market borrowed`} />
              <Figure k="Co-signer APR" v={apr(a.junior)} sub={`${pct(m.premiumBps, 0)} of lender interest`} />
            </dl>
            {m.undercovered && (
              <p className="note is-loss">
                Under-covered after a loss. <b>{fmt(up2(short))} MUSD</b> more cover reopens lender deposits. New deposits and cover withdrawals are paused until then; borrowing on Morpho is not.
              </p>
            )}
            {m.round > 0n && <p className="note">Cover was wiped {m.round.toString()} time(s) and then recapitalised. Old cover shares were retired.</p>}
          </section>

          <section className="panel card card-white" aria-labelledby="loss-h">
            <div className="panel-head"><h2 id="loss-h" className="panel-title">Losses on this market</h2><span className="t-caption">From LossAbsorbed events</span></div>
            {ctx.lossesFailed && !mine ? (
              <p className="empty-line is-loss" role="alert">Could not read loss events from Mezo testnet. Reload the page to try again.</p>
            ) : !mine ? (
              <p className="empty-line" role="status"><span className="spin" />Reading loss events from Mezo testnet…</p>
            ) : mine.length === 0 ? (
              <p className="empty-line">No losses yet. When a Morpho liquidation leaves bad debt, it appears here with the transaction that charged it.</p>
            ) : (
              <div className="table-wrap">
                <table className="atable">
                  <thead><tr><th>Block</th><th className="r">Loss</th><th className="r">Paid by cover</th><th className="r">Paid by lenders</th><th /></tr></thead>
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

          <section className="panel card card-white guarantee" aria-labelledby="g-title">
            <h2 id="g-title" className="panel-title">What cover does and does not guarantee</h2>
            <div className="g-cols">
              <div>
                <h3>The contracts enforce</h3>
                <ul>
                  <li>A loss is taken from cover first. Lenders are charged only for the part of a loss larger than the cover in front of them.</li>
                  <li>A lender's balance as of the vault's last update is not reduced until losses since then exceed that cover.</li>
                  <li>Every recognised loss is split between cover and lenders with nothing created or lost.</li>
                </ul>
              </div>
              <div>
                <h3>They do not guarantee</h3>
                <ul>
                  <li>Interest earned since the vault's last update. If a liquidation skips Cosign's liquidator, that interest can absorb part of the loss first; it moves to co-signers.</li>
                  <li>Protection beyond the cover. A larger loss is shared by lenders still in the vault.</li>
                  <li>That cover stays. A co-signer whose withdrawal notice has ended can leave before a loss is booked.</li>
                  <li>A borrowing limit. Cosign caps deposits into this vault, not borrowing in the Morpho market. The MEZO price comes from a demo oracle.</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <aside className="detail-side">
          <div className="panel card card-white action-card">
            <div className="seg-tabs" role="tablist" aria-label="Action">
              <button role="tab" aria-selected={tab === "lend"} onClick={() => setTab("lend")}>Lend</button>
              <button role="tab" aria-selected={tab === "borrow"} onClick={() => setTab("borrow")}>Borrow</button>
            </div>
            {tab === "lend" ? <LendPanel {...ctx} m={m} /> : <BorrowPanel {...ctx} m={m} />}
          </div>
          <a className="side-link card" href="#/cosign"><span><b>Co-sign this market</b><small>Post cover, vote with veBTC</small></span><ArrowE /></a>
          <a className="side-link card" href="#/evidence"><span><b>Recorded evidence</b><small>Replay and checks from the demo run</small></span><ArrowE /></a>
        </aside>
      </div>
    </>
  );
}

/** Before/after of one recorded loss, read from its LossAbsorbed event. */
function LossReplay({ m, ev, onDone }: { m: MarketState; ev: LossEvent; onDone: () => void }) {
  const [after, setAfter] = useState<{ s: bigint; j: bigint } | null>(null);
  const [phase, setPhase] = useState<"before" | "after">("before");
  useEffect(() => {
    client
      .getContractEvents({ address: ev.vault, abi: vaultAbi, eventName: "LossAbsorbed", fromBlock: ev.block, toBlock: ev.block })
      .then((logs) => {
        const l = logs.find((x) => x.transactionHash === ev.tx);
        const a = l?.args as { seniorAssetsAfter: bigint; juniorAssetsAfter: bigint } | undefined;
        if (a) setAfter({ s: a.seniorAssetsAfter, j: a.juniorAssetsAfter });
      });
  }, [ev]);
  useEffect(() => {
    if (!after) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setPhase("after"), reduce ? 0 : 900);
    return () => clearTimeout(t);
  }, [after]);
  if (!after) return <p className="empty-line" role="status"><span className="spin" />Reading the loss from Mezo testnet…</p>;
  const before = { s: after.s + ev.bySenior, j: after.j + ev.byJunior };
  const cur = phase === "before" ? before : after;
  return (
    <div className="lreplay">
      <Stack m={m} senior={cur.s} junior={cur.j} scale={before.s + before.j} lost={phase === "after" ? ev.byJunior : 0n} lostSenior={phase === "after" ? ev.bySenior : 0n} />
      <div className="lreplay-note">
        <p aria-live="polite">
          {phase === "before" ? "Before the liquidation." : (
            <>Loss of <b>{fmt(ev.loss)} MUSD</b>: cover paid <b className="is-cover">{fmt(ev.byJunior)}</b>, lenders paid <b>{fmt(ev.bySenior)}</b>. <a href={txUrl(ev.tx)} target="_blank" rel="noreferrer">See the transaction</a>.</>
          )}
        </p>
        <button className="link" onClick={onDone}>Back to live view</button>
      </div>
    </div>
  );
}

// ================================================================ actions

function Connect({ connect, what }: { connect: () => void; what: string }) {
  return (
    <div className="connect-gate">
      <p>Connect a wallet on Mezo testnet to {what}. Testnet tokens have no value.</p>
      <button className="btn btn-dark" onClick={connect}>Connect wallet</button>
    </div>
  );
}

function LendPanel({ m, user, account, send, approveIfNeeded, connect, d, busy }: Ctx & { m: MarketState }) {
  const [dep, setDep] = useState("");
  const [wd, setWd] = useState("");
  const me = user?.perVault[m.vault];
  const depWei = toWei(dep);
  const tooMuch = depWei > m.capacity;
  const overWallet = !!user && depWei > user.musd;
  return (
    <div className="action">
      <p className="action-lede">{fmt(m.junior)} MUSD of cover sits in front of lenders. Lenders lose money only when a loss is larger than the cover.</p>
      {!account ? <Connect connect={connect} what="lend" /> : (
        <>
          <div className="field">
            <label htmlFor="lend">Deposit</label>
            <Amount id="lend" value={dep} onChange={setDep} unit="MUSD" max={user && user.musd < m.capacity ? user.musd : m.capacity} invalid={tooMuch || overWallet} />
            {tooMuch ? <span className="field-hint is-error">Only {fmt(m.capacity)} MUSD of room right now. More cover opens more room.</span>
              : overWallet ? <span className="field-hint is-error">You have {fmt(user!.musd)} MUSD in this wallet.</span>
              : <span className="field-hint">Room to lend {fmt(m.capacity)} MUSD · wallet {user ? fmt(user.musd) : "…"} MUSD</span>}
          </div>
          <button className="btn btn-dark btn-block" disabled={busy || depWei === 0n || tooMuch || overWallet}
            onClick={async () => {
              if (!(await approveIfNeeded(d.musd, m.vault, depWei, "MUSD"))) return;
              if (await send("Deposit MUSD", (w) => w.writeContract({ address: m.vault, abi: vaultAbi, functionName: "depositSenior", args: [depWei] }))) setDep("");
            }}>Deposit</button>
          {m.capacity === 0n && <p className="field-hint">Deposits are closed: {m.undercovered ? "the market is under-covered" : "there is no cover yet"}.</p>}
          <div className="held"><span>Your deposit</span><b className="num">{user ? `${fmt(me?.senior ?? 0n)} MUSD` : "…"}</b></div>
          {me && me.seniorShares > 0n && (
            <>
              <div className="field">
                <label htmlFor="wd">Withdraw</label>
                <Amount id="wd" value={wd} onChange={setWd} unit="MUSD" max={me.senior} />
                <span className="field-hint">Lenders can leave any time the market has unborrowed MUSD.</span>
              </div>
              <button className="btn btn-light btn-block" disabled={busy || toWei(wd) === 0n}
                onClick={async () => {
                  const w = toWei(wd);
                  const shares = w >= me.senior ? me.seniorShares : (me.seniorShares * w) / me.senior;
                  if (await send("Withdraw MUSD", (wc) => wc.writeContract({ address: m.vault, abi: vaultAbi, functionName: "withdrawSenior", args: [shares] }))) setWd("");
                }}>Withdraw</button>
            </>
          )}
        </>
      )}
    </div>
  );
}

function estimateDebt(borrowShares: bigint, m: MarketState) {
  // Morpho borrow shares -> assets, rounding up (virtual shares 1e6, virtual assets 1).
  return borrowShares === 0n ? 0n : (borrowShares * (m.totalBorrow + 1n)) / (m.totalBorrowShares + 1_000_000n) + 1n;
}

function BorrowPanel({ m, user, account, send, approveIfNeeded, connect, d, price, busy }: Ctx & { m: MarketState }) {
  const [coll, setColl] = useState("");
  const [amt, setAmt] = useState("");
  const [rep, setRep] = useState("");
  const [out, setOut] = useState("");
  const me = user?.perVault[m.vault];
  const debt = me && m.totalBorrow > 0n ? estimateDebt(me.borrowShares, m) : 0n;
  const collValue = me ? (me.collateral * price) / 10n ** 36n : 0n;
  const maxBorrow = (collValue * m.lltv) / WAD;
  const ltv = collValue > 0n ? Number((debt * 10_000n) / collValue) / 100 : 0;
  const lltvPct = Number((m.lltv * 10_000n) / WAD) / 100;
  return (
    <div className="action">
      <p className="action-lede">Post MEZO, borrow MUSD at a fixed {apr(Number(m.borrowApr) / 1e18)}. Above {lltvPct}% loan-to-value the position can be liquidated.</p>
      {!account ? <Connect connect={connect} what="borrow" /> : (
        <>
          <div className="held held-grid">
            <div><span>Collateral</span><b className="num">{fmt(me?.collateral ?? 0n)} MEZO</b></div>
            <div><span>Debt</span><b className="num">{fmt(debt)} MUSD</b></div>
            <div><span>Loan-to-value</span><b className={`num ${ltv > lltvPct * 0.9 ? "is-loss" : ""}`}>{collValue > 0n ? `${ltv.toFixed(1)}%` : "—"}</b></div>
            <div><span>Borrow up to</span><b className="num">{fmt(maxBorrow)} MUSD</b></div>
          </div>
          <div className="field">
            <label htmlFor="coll">Add MEZO collateral</label>
            <Amount id="coll" value={coll} onChange={setColl} unit="MEZO" max={user?.mezo} />
          </div>
          <button className="btn btn-light btn-block" disabled={busy || toWei(coll) === 0n}
            onClick={async () => {
              const c = toWei(coll);
              if (!(await approveIfNeeded(d.mezo, d.morpho, c, "MEZO"))) return;
              if (await send("Add collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "supplyCollateral", args: [m.params, c, account, "0x"] }))) setColl("");
            }}>Add collateral</button>
          <div className="field">
            <label htmlFor="borrow">Borrow</label>
            <Amount id="borrow" value={amt} onChange={setAmt} unit="MUSD" />
          </div>
          <button className="btn btn-dark btn-block" disabled={busy || toWei(amt) === 0n}
            onClick={async () => {
              if (await send("Borrow MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "borrow", args: [m.params, toWei(amt), 0n, account, account] }))) setAmt("");
            }}>Borrow</button>
          {debt > 0n && (
            <>
              <div className="field">
                <label htmlFor="repay">Repay</label>
                <Amount id="repay" value={rep} onChange={setRep} unit="MUSD" max={debt} />
              </div>
              <button className="btn btn-light btn-block" disabled={busy || toWei(rep) === 0n}
                onClick={async () => {
                  const r = toWei(rep);
                  const full = r >= debt;
                  if (!(await approveIfNeeded(d.musd, d.morpho, full ? debt + debt / 1000n + 1n : r, "MUSD"))) return;
                  const args = full ? ([m.params, 0n, me!.borrowShares, account, "0x"] as const) : ([m.params, r, 0n, account, "0x"] as const);
                  if (await send("Repay MUSD", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "repay", args }))) setRep("");
                }}>Repay</button>
            </>
          )}
          {me && me.collateral > 0n && (
            <>
              <div className="field">
                <label htmlFor="wcoll">Withdraw collateral</label>
                <Amount id="wcoll" value={out} onChange={setOut} unit="MEZO" max={debt === 0n ? me.collateral : undefined} />
                {debt > 0n && <span className="field-hint">While you have debt, you can only take out collateral that is not backing it.</span>}
              </div>
              <button className="btn btn-light btn-block" disabled={busy || toWei(out) === 0n}
                onClick={async () => {
                  if (await send("Withdraw collateral", (w) => w.writeContract({ address: d.morpho, abi: morphoAbi, functionName: "withdrawCollateral", args: [m.params, toWei(out), account, account] }))) setOut("");
                }}>Withdraw collateral</button>
            </>
          )}
        </>
      )}
    </div>
  );
}
