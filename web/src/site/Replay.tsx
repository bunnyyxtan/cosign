import { useEffect, useRef, useState } from "react";
import { ArrowNE } from "../ui/Icon";
import { FORGONE, SCALE, STAGES, tx } from "./recorded";

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const money = (n: number, dp = 2) => n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Tweens a number toward `to`; jumps straight there when motion is reduced. */
function useTween(to: number, ms = 900) {
  const [v, setV] = useState(to);
  const from = useRef(to);
  useEffect(() => {
    if (reduced()) { from.current = to; setV(to); return; }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 4);
      const x = a + (to - a) * e;
      from.current = x;
      setV(x);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

export function Replay() {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const s = STAGES[i];
  const last = STAGES.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (i === last) { setPlaying(false); return; }
    const t = setTimeout(() => setI(i + 1), reduced() ? 1200 : 2600);
    return () => clearTimeout(t);
  }, [playing, i, last]);

  const cover = useTween(s.cover), senior = useTween(s.senior), lost = useTween(s.lost);
  // bad debt realised on Morpho but not yet charged by Cosign (the liquidation frame only)
  const pending = s.key === "liquidation" ? 300.5 : 0;
  const pct = (x: number) => `${(x / SCALE) * 100}%`;

  const play = () => { if (i === last) setI(0); setPlaying(!playing || i === last); };
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!k) return;
    e.preventDefault();
    const n = Math.max(0, Math.min(last, i + k));
    setPlaying(false); setI(n);
    (e.currentTarget.querySelectorAll("button")[n] as HTMLButtonElement)?.focus();
  };

  return (
    <div className="replay card card-white" data-reveal>
      <div className="replay-top">
        <div className="replay-status">
          <span className="chip chip-recorded">Recorded replay</span>
          <span className="t-caption">Mezo testnet · chain 31611 · not live market state</span>
        </div>
        <div className="replay-ctl">
          <button className="btn btn-dark btn-sm" type="button" onClick={play} aria-pressed={playing}>
            {playing ? "Pause" : i === last ? "Replay again" : i === 0 ? "Play the replay" : "Resume"}
          </button>
        </div>
      </div>

      <div className="replay-body">
        <div className="replay-steps" role="tablist" aria-label="Recorded steps" onKeyDown={onKey}>
          {STAGES.map((t, n) => (
            <button key={t.key} type="button" role="tab" id={`rs-${t.key}`} aria-selected={n === i} aria-controls="replay-panel" tabIndex={n === i ? 0 : -1}
              className={`replay-step ${n < i ? "done" : ""}`} onClick={() => { setPlaying(false); setI(n); }}>
              <span className="replay-n num">{String(n + 1).padStart(2, "0")}</span>
              <span className="replay-l">{t.label}{t.oracle && <em>Demo oracle</em>}</span>
              <span className="replay-b num">Block {t.block.toLocaleString("en-US")}</span>
            </button>
          ))}
        </div>

        <div className="replay-stage" id="replay-panel" role="tabpanel" aria-labelledby={`rs-${s.key}`}>
          <div className="replay-copy" key={s.key}>
            <h3 className="t-title" aria-live="polite">{s.title}</h3>
            <p>{s.body}</p>
          </div>

          <dl className="replay-figs">
            <div><dt className="figure-k"><i className="sw sw-cover" />Junior cover</dt><dd className="figure-v num">{money(cover)}<small>MUSD</small></dd></div>
            <div><dt className="figure-k"><i className="sw sw-senior" />Senior booked principal</dt><dd className="figure-v num">{money(senior)}<small>MUSD</small></dd></div>
            <div><dt className="figure-k"><i className="sw sw-lost" />Absorbed by cover</dt><dd className="figure-v num">{money(lost)}<small>MUSD</small></dd></div>
          </dl>

          <div className="stack" role="img" aria-label={`Cover ${money(s.cover)} MUSD, senior ${money(s.senior)} MUSD, ${money(s.lost)} MUSD absorbed by cover, on a ${SCALE.toLocaleString()} MUSD scale`}>
            <div className="stack-track">
              <span className="seg seg-lost" style={{ left: 0, width: pct(lost) }} />
              <span className="seg seg-cover" style={{ left: pct(lost), width: pct(cover) }} />
              <span className="seg seg-senior" style={{ left: pct(lost + cover), width: pct(senior) }} />
              <span className={`seg-pending ${pending ? "on" : ""}`} style={{ width: pct(300.5) }}><b>300.50 MUSD bad debt, not yet charged</b></span>
            </div>
            <div className="stack-axis num"><span>0</span><span>First loss →</span><span>{SCALE.toLocaleString("en-US")} MUSD</span></div>
          </div>

          <div className="replay-foot">
            <a className="link" href={tx(s.hash)} target="_blank" rel="noreferrer">View this transaction <ArrowNE size={14} /></a>
            <span className="t-caption num">{s.hash.slice(0, 10)}…{s.hash.slice(-6)}</span>
          </div>
        </div>
      </div>
      <p className="replay-note t-caption">
        The direct Morpho liquidation forwent {FORGONE} MUSD of lenders' interest that had not been booked yet; booked principal was unchanged.
        Cosign's liquidator books that interest first, as in step 05. Cover is not insurance: a loss larger than the cover reaches lenders.
      </p>
    </div>
  );
}
