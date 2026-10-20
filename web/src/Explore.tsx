import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { Waterfall } from "./Waterfall";
import { addrUrl, txUrl, type Deployment, type DemoRun, type MarketState } from "./chain";

const REPO = "https://github.com/bunnyyxtan/cosign";
const wei = (v: string | number | bigint | undefined) => BigInt(v ?? 0);
const mu = (v: bigint, dp = 2) =>
  Number(formatUnits(v, 18)).toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

// Parameters of the two deployed markets. They are the values checked against the chain by contracts/script/verify_deploy.py.
const SPEC = [
  { key: "bold", name: "Bold MEZO", lltv: "77%", lev: 19, minCover: "5%", apr: "12%", premium: "25%", note: "Recorded run: cover, lending, borrowing, two losses." },
  { key: "steady", name: "Steady MEZO", lltv: "62.5%", lev: 9, minCover: "10%", apr: "8%", premium: "20%", note: "Deployed and verified. Not used in the recorded run." },
] as const;

type Stage = {
  title: string;
  body: string;
  tx?: string;
  cover: bigint;
  lenders: bigint;
  lostCover: bigint;
  note?: string;
};

function buildStages(demo: DemoRun): Stage[] | null {
  const { before, after, loss, loss2 } = demo;
  if (!before || !after || !loss) return null;
  const step = (prefix: string, nth = 0) => demo.steps.filter((s) => s.label.startsWith(prefix))[nth]?.tx;
  const lenders = wei(after.senior);
  const coverBefore = wei(after.junior) + wei(loss.byJunior);
  const afterCover = wei(after.junior);
  const forgone = wei(demo.forgoneSeniorInterest);
  const out: Stage[] = [
    {
      title: "Cover and lenders in place",
      body: "A co-signer posted MUSD cover. Lenders then deposited, which the cover allows up to 19 times its size.",
      tx: step("Lender deposits"),
      cover: coverBefore, lenders, lostCover: 0n,
    },
    {
      title: "The price crashes",
      body: "The team's demo oracle sets MEZO from 10 to 3 MUSD. A borrower with 500 MUSD of debt is now far under water.",
      tx: step("DEMO ORACLE: MEZO", 0),
      cover: coverBefore, lenders, lostCover: 0n,
    },
    {
      title: "Morpho liquidates",
      body: `Morpho seizes the collateral and writes the rest off as bad debt (${mu(wei(loss.recognized), 1)} MUSD). The vault has not recorded it yet.`,
      tx: step("Liquidator seizes"),
      cover: coverBefore, lenders, lostCover: 0n,
    },
    {
      title: "Cosign charges the loss to cover",
      body: `The vault syncs. Cover pays ${mu(wei(loss.byJunior), 1)} MUSD. Lenders pay ${mu(wei(loss.bySenior), 1)}.`,
      tx: step("Cosign sync"),
      cover: afterCover, lenders, lostCover: wei(loss.byJunior),
      note: forgone > 0n
        ? `Booked principal did not move. This liquidation went straight to Morpho, so ${mu(forgone, 6)} MUSD of interest earned since the last update was netted against the loss and went to cover instead. That is a known limit.`
        : undefined,
    },
  ];
  if (loss2) {
    out.push({
      title: "A second loss, through Cosign's liquidator",
      body: `The liquidator syncs first, so lenders' interest (${mu(wei(loss2.seniorInterestBooked), 6)} MUSD) is booked before the loss lands. Cover pays ${mu(wei(loss2.byJunior), 1)} MUSD. Lenders pay ${mu(wei(loss2.bySenior), 1)}.`,
      tx: step("CosignLiquidator: sync"),
      cover: afterCover - wei(loss2.byJunior), lenders: lenders + wei(loss2.seniorInterestBooked), lostCover: wei(loss2.byJunior),
      note: "Cover is now below its 5% minimum, so the vault stops taking new lender deposits and cover withdrawals until cover is added.",
    });
  }
  return out;
}

export function Explore({ d, demo, markets }: { d: Deployment; demo: DemoRun | null; markets: MarketState[] }) {
  const stages = useMemo(() => (demo ? buildStages(demo) : null), [demo]);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || !stages) return;
    if (i >= stages.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setI((x) => x + 1), 3400);
    return () => clearTimeout(t);
  }, [playing, i, stages]);

  const live = (key: string) => markets.find((m) => m.name.toLowerCase().startsWith(key));
  const st = stages?.[i];
  const scale = stages ? stages[0].cover + stages[0].lenders : 1n;
  const coverStart = stages?.[0].cover ?? 0n;

  return (
    <>
      <section className="hero explore-hero">
        <p className="kicker">Credit ratings with skin in the game</p>
        <h1>Bitcoin holders vouch for a lending market with their own money.</h1>
        <p className="lede">
          They put MUSD in front of lenders. If a loan goes bad, that money is lost first. Lenders are hit only by the part of a
          loss that is bigger than the cover.
        </p>
        <ol className="three">
          <li><b>1</b><span><strong>A co-signer posts cover.</strong> It earns a cut of the interest and MEZO rewards, and it loses first.</span></li>
          <li><b>2</b><span><strong>Lenders deposit behind it.</strong> A market takes at most 19 times its cover, so the lending limit follows the money at risk.</span></li>
          <li><b>3</b><span><strong>A bad loan hits cover first.</strong> Watch it happen below, using real Mezo testnet transactions.</span></li>
        </ol>
        <p className="demo-note">
          <strong>This page needs no wallet.</strong> It replays what was recorded on Mezo testnet. Nothing here moves funds. To use
          your own wallet, open <a href="#/markets">Markets</a>.
        </p>
      </section>

      <section className="replay-box" aria-labelledby="rp-title">
        <h2 id="rp-title">Replay the recorded loss</h2>
        {!stages || !st ? (
          <p className="muted">The recorded run is not available in this build. The links under “Verify it yourself” still work.</p>
        ) : (
          <>
            <ol className="stepper" aria-label="Replay steps">
              {stages.map((s, n) => (
                <li key={s.title}>
                  <button className={n === i ? "on" : n < i ? "done" : ""} onClick={() => { setPlaying(false); setI(n); }} aria-current={n === i ? "step" : undefined}>
                    <span>{n + 1}</span>{s.title}
                  </button>
                </li>
              ))}
            </ol>

            <Waterfall senior={st.lenders} junior={st.cover} scale={scale} lost={st.lostCover} large />

            <div className="stage">
              <h3>{i + 1}. {st.title}</h3>
              <p>{st.body}</p>
              {st.note && <p className="warn">{st.note}</p>}
              {st.tx && <a className="btn secondary" href={txUrl(st.tx)} target="_blank" rel="noreferrer">Open this transaction in the explorer</a>}
            </div>

            <dl className="figures">
              <div className="fig strong"><dt>Cover</dt><dd>{mu(st.cover)} MUSD<small> {st.cover < coverStart ? `was ${mu(coverStart)}` : "posted"}</small></dd></div>
              <div className="fig"><dt>Lenders’ booked principal</dt><dd>{mu(st.lenders, 6)} MUSD<small> {st.lenders === stages[0].lenders ? "unchanged" : "interest booked first"}</small></dd></div>
              <div className="fig"><dt>Paid by cover in this step</dt><dd className="j-text">{mu(st.lostCover)} MUSD</dd></div>
              <div className="fig"><dt>Paid by lenders in this step</dt><dd>0.00 MUSD</dd></div>
            </dl>

            <div className="controls">
              <button className="secondary" onClick={() => { setPlaying(false); setI(Math.max(0, i - 1)); }} disabled={i === 0}>Back</button>
              <button onClick={() => { if (i >= stages.length - 1) setI(0); setPlaying((p) => !p); }}>{playing ? "Pause" : i >= stages.length - 1 ? "Replay" : "Play"}</button>
              <button className="secondary" onClick={() => { setPlaying(false); setI(Math.min(stages.length - 1, i + 1)); }} disabled={i >= stages.length - 1}>Next</button>
            </div>
            <p className="muted small">Figures are read from the recorded run in this build. Each step links to its transaction so you can check it yourself.</p>
          </>
        )}
      </section>

      <section aria-labelledby="cmp-title">
        <h2 id="cmp-title" className="sec">Two markets, two risk settings</h2>
        <div className="compare">
          {SPEC.map((s) => {
            const m = live(s.key);
            return (
              <article key={s.key} className="card">
                <h3>{s.name}</h3>
                <p className="muted">{s.note}</p>
                <dl className="kv">
                  <div><dt>Loan-to-value limit</dt><dd>{s.lltv}</dd></div>
                  <div><dt>Lender deposits allowed per 1 of cover</dt><dd>{s.lev}</dd></div>
                  <div><dt>Cover must stay above</dt><dd>{s.minCover} of the vault</dd></div>
                  <div><dt>Borrow rate (fixed)</dt><dd>{s.apr}</dd></div>
                  <div><dt>Co-signers’ cut of lender interest</dt><dd>{s.premium}</dd></div>
                  <div><dt>Cover right now (live)</dt><dd>{m ? `${mu(m.junior)} MUSD` : "loading…"}</dd></div>
                </dl>
                <a className="btn secondary" href={`#/market/${s.key === "bold" ? d.vaultBold : d.vaultSteady}`}>Open the live market</a>
              </article>
            );
          })}
        </div>
        <p className="muted small">Bold lends more per unit of cover against a higher loan-to-value. Steady asks for more cover and lends less.</p>
      </section>

      <section className="limits" aria-labelledby="lim-title">
        <h2 id="lim-title" className="sec">What this does not protect against</h2>
        <p className="muted">Cover is first-loss money, not insurance. These limits are real and visible in the recorded run.</p>
        <ul>
          <li><strong>Direct liquidations skip a step.</strong> If someone liquidates on Morpho without Cosign’s liquidator, interest earned since the vault’s last update can be netted against the loss. In the recorded run that was 0.000004 MUSD. Cosign’s liquidator removes it.</li>
          <li><strong>Cover can leave.</strong> A co-signer whose withdrawal notice has ended can take cover out before a loss is booked, which leaves more of that loss to the cover that stays.</li>
          <li><strong>A deposit cap is not a borrowing cap.</strong> The 19× rule limits deposits into a Cosign vault. Borrowing on the underlying Morpho market is not limited by cover and is not paused when cover runs low.</li>
          <li><strong>Losses can exceed cover.</strong> Anything beyond it falls on the lenders who are still in the vault.</li>
          <li><strong>The price is a demo.</strong> The MEZO price comes from an oracle the Cosign team controls. This is an unaudited prototype on a test network.</li>
        </ul>
      </section>

      <section className="verify" aria-labelledby="ver-title">
        <h2 id="ver-title" className="sec">Verify it yourself</h2>
        <ul className="links">
          <li><a href={addrUrl(d.vaultBold)} target="_blank" rel="noreferrer">Bold vault contract</a>: read it in the Mezo explorer.</li>
          <li><a href={addrUrl(d.vaultSteady)} target="_blank" rel="noreferrer">Steady vault contract</a></li>
          <li><a href={addrUrl(d.gauge)} target="_blank" rel="noreferrer">Gauge</a>, <a href={addrUrl(d.liquidator ?? d.gauge)} target="_blank" rel="noreferrer">liquidator</a> and <a href={addrUrl(d.morpho)} target="_blank" rel="noreferrer">Morpho Blue</a></li>
          <li><a href={`${REPO}/blob/main/docs/TESTNET_EVIDENCE.md`} target="_blank" rel="noreferrer">Every transaction and check</a>, including the ones that failed first time.</li>
          <li><a href={REPO} target="_blank" rel="noreferrer">Source code and tests</a></li>
        </ul>
        <p className="muted small">Every recorded transaction is listed on a <a href={`#/market/${d.vaultBold}`}>market page</a> under “Recorded demo run”.</p>
      </section>
    </>
  );
}
