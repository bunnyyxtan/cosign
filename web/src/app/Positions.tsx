import { addrUrl } from "../chain";
import { ArrowNE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { fmt, short } from "./ui";

/** Everything this wallet holds across the deployed markets, from the same reads the action panels use. */
export function Positions({ user, account, connect, markets }: Ctx) {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="eyebrow">Workspace / Positions</span>
          <h1 className="page-title">Your positions</h1>
          <p className="page-lede">Read from Mezo testnet for the connected wallet. Values update after each confirmed transaction and every 15 seconds.</p>
        </div>
        {account && <a className="link" href={addrUrl(account)} target="_blank" rel="noreferrer">{short(account)} in the explorer <ArrowNE size={14} /></a>}
      </header>

      {!account ? (
        <div className="empty card card-white">
          <h2 className="panel-title">No wallet connected</h2>
          <p>Connect a wallet on Mezo testnet to see lending, cover, borrowing and rewards in one place.</p>
          <button className="btn btn-dark" onClick={connect}>Connect wallet</button>
        </div>
      ) : !user ? (
        <p className="empty-line" role="status"><span className="spin" />Reading your positions from Mezo testnet…</p>
      ) : (
        <>
          <dl className="kpis card card-white">
            <div><dt>MUSD</dt><dd className="num">{fmt(user.musd)}</dd></div>
            <div><dt>MEZO</dt><dd className="num">{fmt(user.mezo, 4)}</dd></div>
            <div><dt>BTC (gas)</dt><dd className="num">{fmt(user.btc, 6)}</dd></div>
            <div><dt>veBTC positions</dt><dd className="num">{user.veTokens.length}</dd></div>
          </dl>
          <section className="panel card card-white" aria-label="Positions by market">
            <div className="table-wrap">
              <table className="atable">
                <thead>
                  <tr><th>Market</th><th className="r">Lending</th><th className="r">Cover</th><th className="r">Collateral</th><th className="r">Borrow shares</th><th className="r">Rewards</th><th>Withdrawal notice</th></tr>
                </thead>
                <tbody>
                  {markets.map((m) => {
                    const p = user.perVault[m.vault];
                    const live = p.request.shares > 0n && p.request.round === m.round;
                    const ready = live && BigInt(Math.floor(Date.now() / 1000)) >= p.request.readyAt;
                    return (
                      <tr key={m.vault}>
                        <td><a href={`#/market/${m.vault}`}>{m.name}</a></td>
                        <td className="r num">{fmt(p.senior)}</td>
                        <td className="r num is-cover">{fmt(p.junior)}</td>
                        <td className="r num">{fmt(p.collateral)} <small>MEZO</small></td>
                        <td className="r num">{p.borrowShares > 0n ? p.borrowShares.toString() : "0"}</td>
                        <td className="r num">{fmt(p.rewards, 4)}</td>
                        <td>{!live ? <span className="t-caption">None</span> : ready ? <span className="chip chip-live">Ready</span> : <span className="chip chip-pending">Until {new Date(Number(p.request.readyAt) * 1000).toLocaleTimeString()}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="fine">Lending and cover in MUSD, including interest since the vault's last update. Debt in MUSD is shown on each market's Borrow tab.</p>
          </section>
        </>
      )}
    </>
  );
}
