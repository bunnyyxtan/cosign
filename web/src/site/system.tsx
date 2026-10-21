// Component specimen. Served by the dev server only (not a build input): /system.html
import { createRoot } from "react-dom/client";
import { ArrowE, ArrowNE } from "../ui/Icon";
import "../ui/tokens.css";
import "../ui/components.css";
import "./site.css";

const SW = [
  ["paper", "#fcfbfa", "page"], ["porcelain", "#f6f4f8", "quiet band"], ["mist", "#f2eff8", "card"], ["lilac", "#ebe6f5", "accent card, secondary button"],
  ["white", "#ffffff", "data surface"], ["plum", "#262035", "dark band, primary button"], ["ink", "#1f1d29", "headings, figures"], ["copy", "#3d3947", "body"],
  ["muted", "#6b6676", "secondary, labels"], ["iris", "#6a5f92", "accent word"], ["cover", "#9d90dc", "junior cover"], ["senior", "#2b2540", "senior principal"],
  ["loss", "#b42339", "loss, under-covered only"], ["ok", "#357052", "confirmed"], ["pending", "#8a5a12", "pending, never success"],
];
const TYPE = [
  ["t-hero", "Hero", "Inter Tight 600 · 48→112 · 0.96 · −0.05em"], ["t-display", "Display", "Inter Tight 600 · 40→72 · 1.0 · −0.045em"],
  ["t-title", "Title", "Inter Tight 600 · 28→40 · 1.06 · −0.035em"], ["t-heading", "Heading", "Inter Tight 600 · 20 · 1.25 · −0.015em"],
  ["t-lede", "Lede paragraph for section introductions.", "Inter 400 · 17→19 · 1.55"], ["", "Body text for explanations and app copy.", "Inter 400 · 16 · 1.6"],
  ["t-small", "Small text for card bodies and secondary notes.", "Inter 400 · 14 · 1.55"], ["t-caption", "Caption for sources, footnotes and metadata.", "Inter 400 · 12.5 · 1.45"],
];

function System() {
  return (
    <main className="wrap" style={{ paddingBlock: 64, display: "grid", gap: 64 }}>
      <header><span className="eyebrow">Cosign design system<span className="idx">/ Milestone A</span></span><h1 className="t-display" style={{ marginTop: 20 }}>Foundation.</h1></header>

      <section><span className="eyebrow">Type</span>
        <div style={{ display: "grid", gap: 22, marginTop: 24 }}>
          {TYPE.map(([c, t, m]) => (
            <div key={m} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "baseline", borderTop: "1px solid var(--hairline)", paddingTop: 16 }}>
              <div className={c}>{t}</div><code className="t-caption">{m}</code>
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24, borderTop: "1px solid var(--hairline)", paddingTop: 20 }}>
            {[["Junior cover", "39.40", "MUSD"], ["Senior booked principal", "1,000.00", "MUSD"], ["Lender share value", "1.000000053", ""]].map(([k, v, u]) => (
              <div key={k}><div className="figure-k">{k}</div><div className="figure-v">{v}{u && <small>{u}</small>}</div></div>
            ))}
          </div>
          <code className="t-caption">Figures: Inter Tight 600 · 36→60 · −0.04em · tabular, lining numerals. Units in Inter 500 13px.</code>
        </div>
      </section>

      <section><span className="eyebrow">Colour roles</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12, marginTop: 24 }}>
          {SW.map(([n, h, r]) => (
            <div key={n} className="card card-white" style={{ padding: 10 }}>
              <div style={{ height: 64, borderRadius: 12, background: h, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }} />
              <div style={{ padding: "10px 4px 2px" }}><strong className="t-small" style={{ color: "var(--ink)" }}>{n}</strong> <code className="t-caption">{h}</code><div className="t-caption">{r}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section><span className="eyebrow">Buttons</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 24 }}>
          <button className="btn btn-dark btn-lg">Open the app <ArrowNE /></button>
          <button className="btn btn-dark">Deposit</button>
          <button className="btn btn-dark btn-sm">Claim</button>
          <button className="btn btn-light btn-lg">Compare markets <ArrowNE /></button>
          <button className="btn btn-light">Request withdrawal</button>
          <button className="btn btn-white">Replay a real loss</button>
          <button className="btn btn-ghost">Remove votes</button>
          <button className="btn btn-dark" disabled>Deposit</button>
          <a className="link" href="#x">Check onchain <ArrowNE size={14} /></a>
          <a className="circle" href="#x" aria-label="Open"><ArrowNE /></a>
        </div>
        <p className="t-caption" style={{ marginTop: 14 }}>Heights 52 / 44 / 36 (36 grows to 44 on touch). Hover lifts colour and nudges the arrow; press scales to 0.98; disabled 42% with a stated reason nearby.</p>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <div><span className="eyebrow">Status</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 24 }}>
            <span className="chip chip-live">Live · block 16,301,220</span><span className="chip chip-recorded">Recorded replay</span>
            <span className="chip chip-pending">Waiting for Mezo</span><span className="chip chip-loss">Under-covered</span><span className="chip">Mezo testnet</span>
          </div>
          <p className="t-caption" style={{ marginTop: 14 }}>Live is a round dot, recorded a square one: never colour alone.</p>
        </div>
        <div><span className="eyebrow">Fields</span>
          <div style={{ display: "grid", gap: 18, marginTop: 24 }}>
            <div className="field"><label htmlFor="a">Deposit</label><div className="amount"><input id="a" inputMode="decimal" placeholder="0.00" /><span className="amount-unit">MUSD</span><button className="amount-max">Max</button></div><span className="field-hint">Wallet 1,250.00 MUSD · room to lend 0.00 MUSD</span></div>
            <div className="field"><label htmlFor="b">Post cover</label><div className="amount is-error"><input id="b" defaultValue="5,000" /><span className="amount-unit">MUSD</span><button className="amount-max">Max</button></div><span className="field-hint is-error">You have 1,250.00 MUSD in this wallet.</span></div>
          </div>
        </div>
      </section>

      <section><span className="eyebrow">Link row</span>
        <div className="card card-white card-pad" style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div><div className="t-heading">Direct liquidation and sync</div><div className="t-small">Senior booked principal unchanged · block 16,263,365</div></div>
          <div className="figure-v" style={{ marginTop: 0, fontSize: 28 }}>300.50<small>MUSD</small></div>
          <a className="circle" href="#x" aria-label="Open transaction"><ArrowE /></a>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<System />);
