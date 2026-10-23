import { useState } from "react";
import { addrUrl } from "../chain";
import { Replay } from "../site/Replay";
import { EVIDENCE } from "../site/recorded";
import { ArrowNE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { PageHead, short } from "./ui";

export function Evidence({ d, demo }: Ctx) {
  const [all, setAll] = useState(false);
  const checks = demo?.checks ?? [];
  const failed = checks.filter((c) => !c.pass);
  const contracts = [
    ["Bold vault", d.vaultBold], ["Steady vault", d.vaultSteady], ["Gauge", d.gauge], ["CosignLiquidator", d.liquidator],
    ["Morpho Blue", d.morpho], ["Demo oracle", d.oracle], ["MUSD", d.musd], ["MEZO", d.mezo], ["Mezo veBTC", d.veBTC],
  ].filter(([, a]) => a && a !== "0x0000000000000000000000000000000000000000") as [string, string][];
  const steps = demo?.steps ?? [];
  const shown = all ? steps : steps.slice(-12);

  return (
    <>
      <PageHead title="Recorded evidence" lede="What the recorded demo run did on Mezo testnet. Historical, not live market state.">
        <a className="link" href={EVIDENCE} target="_blank" rel="noreferrer">Full evidence document <ArrowNE size={14} /></a>
      </PageHead>

      <Replay />

      <div className="ev-grid">
        <section className="panel card card-white" aria-labelledby="chk-h">
          <div className="panel-head">
            <h2 id="chk-h" className="panel-title">Checks recorded during the run</h2>
            <span className="chip chip-recorded">{checks.filter((c) => c.pass).length} / {checks.length} passed</span>
          </div>
          <p className="t-small">Each check read contract state at the block shown. Failures are kept, with what was wrong.</p>
          {failed.length > 0 && (
            <ul className="checks">
              {failed.map((c, i) => (
                <li key={i}><span className="chip chip-loss chip-plain">Fail</span><span><b>{c.check}</b> {c.detail}{c.note && <em> {c.note}</em>}</span></li>
              ))}
            </ul>
          )}
          <details className="more">
            <summary>Show the {checks.length - failed.length} passing checks</summary>
            <ul className="checks">
              {checks.filter((c) => c.pass).map((c, i) => (
                <li key={i}><span className="chip chip-live chip-plain">Pass</span><span><b>{c.check}</b> {c.detail}</span></li>
              ))}
            </ul>
          </details>
        </section>

        <section className="panel card card-white" aria-labelledby="ct-h">
          <div className="panel-head"><h2 id="ct-h" className="panel-title">Contracts</h2><span className="t-caption">Mezo testnet · 31611</span></div>
          <ul className="contracts">
            {contracts.map(([n, a]) => (
              <li key={n}><span>{n}</span><a className="num" href={addrUrl(a)} target="_blank" rel="noreferrer">{short(a)} <ArrowNE size={12} /></a></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel card card-white" aria-labelledby="st-h">
        <div className="panel-head">
          <h2 id="st-h" className="panel-title">Every transaction in the run</h2>
          <span className="t-caption">{steps.length} transactions</span>
        </div>
        <div className="table-wrap">
          <table className="atable">
            <thead><tr><th>Block</th><th>Step</th><th>By</th><th className="r">Transaction</th></tr></thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.tx}>
                  <td className="num">{s.block}</td>
                  <td>{s.label.startsWith("DEMO ORACLE") ? <><span className="chip chip-pending chip-plain">Demo oracle</span> {s.label.replace("DEMO ORACLE: ", "")}</> : s.label}</td>
                  <td className="t-caption">{s.actor}</td>
                  <td className="r"><a className="num" href={s.url} target="_blank" rel="noreferrer">{s.tx.slice(0, 10)}…</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {steps.length > 12 && <button className="btn btn-ghost btn-sm" onClick={() => setAll(!all)}>{all ? "Show the last 12" : `Show all ${steps.length}`}</button>}
      </section>
    </>
  );
}
