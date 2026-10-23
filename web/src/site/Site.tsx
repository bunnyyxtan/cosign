import { useEffect, useState } from "react";
import { Art, type Slot } from "../ui/Art";
import { ArrowNE, Mark, Plus, Wordmark } from "../ui/Icon";
import { Replay } from "./Replay";
import { CHECKS, EVIDENCE, EXPLORER, REPO, REWARDS, STAGES, tx } from "./recorded";

const APP = "/app/markets";
const NAV = [
  ["#idea", "The idea"],
  ["#roles", "Roles"],
  ["#replay", "Loss replay"],
  ["#markets", "Markets"],
  ["#evidence", "Evidence"],
] as const;
const css = (v: Record<string, string | number>) => v as React.CSSProperties;

export function Site() {
  useReveal();
  useParallax();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Idea />
        <Roles />
        <Mechanism />
        <Markets />
        <Architecture />
        <Evidence />
        <Limits />
        <Questions />
        <Closing />
      </main>
      <Footer />
    </>
  );
}

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Adds .in to [data-reveal] elements as they enter the viewport; skipped entirely for reduced motion. */
function useReveal() {
  useEffect(() => {
    if (reducedMotion() || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/** Drifts [data-parallax] bands by a fraction of their distance from the viewport centre. Transform only. */
function useParallax() {
  useEffect(() => {
    if (reducedMotion() || matchMedia("(pointer: coarse)").matches) return;
    const els = [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
    let raf = 0;
    const run = () => {
      raf = 0;
      const vh = innerHeight;
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) continue;
        const k = Number(el.dataset.parallax);
        // only ever drift downward, so the clipped bottom edge hides the movement and the faded top never exposes a seam
        el.style.setProperty("--band-shift", `${Math.max(0, (r.top + r.height / 2 - vh / 2) * k).toFixed(1)}px`);
      }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    addEventListener("scroll", on, { passive: true });
    addEventListener("resize", on, { passive: true });
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, []);
}

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const f = () => setScrolled(scrollY > 8);
    f();
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("menu-open", open);
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open]);
  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="site-header-in">
        <Wordmark href="#top" />
        <nav className="site-nav" aria-label="Sections">
          {NAV.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
        </nav>
        <div className="site-actions">
          <span className="net-label"><i />Mezo testnet</span>
          <a className="btn btn-dark btn-sm" href={APP}>Open app <ArrowNE /></a>
          <button className="menu-btn" type="button" aria-expanded={open} aria-controls="menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            <span /><span />
          </button>
        </div>
      </div>
      <nav id="menu" className="menu-sheet" aria-label="Sections" hidden={!open} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
        {NAV.map(([h, l], i) => <a key={h} href={h} style={css({ "--i": i })}>{l}</a>)}
        <a className="btn btn-dark btn-lg" href={APP}>Open the app <ArrowNE /></a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-card">
        <div className="hero-copy">
          <span className="eyebrow hero-in" style={css({ "--i": 0 })}>A different kind of credit market</span>
          <h1 id="hero-title" className="t-hero hero-in" style={css({ "--i": 1 })}>Capital with<br />conviction.</h1>
          <p className="t-lede hero-in" style={css({ "--i": 2 })}>When you believe in a market, put capital behind it.<br className="br-wide" /> When things go wrong, your conviction pays first.</p>
          <div className="hero-cta hero-in" style={css({ "--i": 3 })}>
            <a className="btn btn-dark btn-lg" href={APP}>Open the app <ArrowNE /></a>
            <a className="btn btn-white btn-lg" href="#replay">Replay a real loss</a>
          </div>
        </div>
        <div className="hero-band" data-parallax="-0.12"><Art slot="hero" eager className="fade-all" /></div>
      </div>
    </section>
  );
}

function Idea() {
  return (
    <section className="idea wrap" id="idea" aria-labelledby="idea-title">
      <div className="idea-top">
        <div data-reveal>
          <span className="eyebrow">The idea<span className="idx">/ 01</span></span>
          <h2 id="idea-title" className="t-display">A better way<br />to stand behind<br />credit.</h2>
        </div>
        <div className="idea-copy" data-reveal style={css({ "--i": 1 })}>
          <p className="t-lede">Credit opinions usually cost nothing to give. <strong>Cosign changes that.</strong></p>
          <p className="t-lede">Bitcoin-aligned co-signers post MUSD as junior, first-loss cover on a lending market. Lenders supply behind them. The people who back a market take the first hit if it goes bad.</p>
          <div className="idea-note">
            <Mark size={16} />
            <span>Not a promise of safety.<br />An enforceable order of loss.</span>
          </div>
        </div>
      </div>
      <ol className="order" data-reveal>
        <li><span className="order-n num">01</span><h3 className="t-heading">Commit</h3><p>Co-signers post real MUSD as cover on the markets they back.</p></li>
        <li><span className="order-n num">02</span><h3 className="t-heading">Protect</h3><p>Cover absorbs recognised bad debt before lenders' booked principal.</p></li>
        <li><span className="order-n num">03</span><h3 className="t-heading">Prove</h3><p>Cover, votes and every loss are contract events anyone can check.</p></li>
      </ol>
      <div className="built" data-reveal>
        <span className="eyebrow">Built on</span>
        <ul>
          <li>Mezo testnet</li><li>Morpho Blue</li><li>MUSD</li><li>veBTC</li>
        </ul>
        <span className="t-caption">Open infrastructure Cosign uses. No partnership is implied.</span>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section className="roles wrap" id="roles" aria-labelledby="roles-title">
      <div className="sec-head" data-reveal>
        <div>
          <span className="eyebrow">Made for different roles<span className="idx">/ 02</span></span>
          <h2 id="roles-title" className="t-display">Same market.<br />Different stakes.</h2>
          <p className="t-lede">Three ways to take part in one transparent credit market.</p>
        </div>
        <a className="link" href={APP}>View the markets <ArrowNE size={14} /></a>
      </div>
      <div className="roles-grid">
        <RoleCard i={0} cls="r-lend" slot="lend" n="01" k="Lenders" title={<>Lend behind<br />the cover.</>}
          body="Deposit MUSD into the senior tranche. Cover sits in front of recognised losses, up to the amount posted."
          href={APP} cta="Explore lending" />
        <RoleCard i={1} cls="r-cosign" slot="cosign" n="02" k="Co-signers" title={<>Back what<br />you believe in.</>}
          body="Post first-loss cover and share in borrower interest when the market earns it. With veBTC, vote MEZO rewards toward it; rewards depend on what each epoch is funded with."
          href="/app/co-sign" cta="Explore co-signing" />
        <article className="role role-borrow card" data-reveal style={css({ "--i": 2 })}>
          <div className="role-copy">
            <span className="eyebrow">03 / Borrowers</span>
            <h3 className="t-title">Borrow against MEZO.</h3>
            <p>Borrow MUSD from the underlying Morpho Blue market. Cosign caps deposits into its vaults, not borrowing.</p>
          </div>
          <dl className="borrow-facts">
            <div><dt>Bold MEZO</dt><dd className="num">77%</dd><span>max loan-to-value</span></div>
            <div><dt>Steady MEZO</dt><dd className="num">62.5%</dd><span>max loan-to-value</span></div>
          </dl>
          <a className="circle role-go" href={APP} aria-label="Explore borrowing"><ArrowNE /></a>
        </article>
      </div>
    </section>
  );
}

function RoleCard({ i, cls, slot, n, k, title, body, href, cta }: { i: number; cls: string; slot: Slot; n: string; k: string; title: React.ReactNode; body: string; href: string; cta: string }) {
  return (
    <article className={`role card ${cls}`} data-reveal style={css({ "--i": i })}>
      <div className="role-copy">
        <span className="eyebrow">{n} / {k}</span>
        <h3 className="t-title">{title}</h3>
        <p>{body}</p>
      </div>
      <div className="role-band"><Art slot={slot} className="fade-top" /></div>
      <a className="circle role-go" href={href} aria-label={cta}><ArrowNE /></a>
    </article>
  );
}

function Mechanism() {
  return (
    <section className="mechanism" id="replay" aria-labelledby="replay-title">
      <div className="wrap">
        <div className="sec-head center" data-reveal>
          <div>
            <span className="eyebrow">The mechanism<span className="idx">/ 03</span></span>
            <h2 id="replay-title" className="t-display">Protection has<br /><span className="accent">a price.</span></h2>
            <p className="t-lede">A real testnet liquidation, a real loss, and a visible order of who pays. Replayed from the recorded transactions.</p>
          </div>
        </div>
        <Replay />
      </div>
    </section>
  );
}

const MARKETS = [
  { slot: "bold" as const, n: "01", name: "Bold MEZO", line: "Higher leverage, thinner cover", lltv: "77%", lev: "19×", min: "5%" },
  { slot: "steady" as const, n: "02", name: "Steady MEZO", line: "Lower leverage, thicker cover", lltv: "62.5%", lev: "9×", min: "10%" },
];

function Markets() {
  return (
    <section className="markets wrap" id="markets" aria-labelledby="markets-title">
      <div className="markets-intro" data-reveal>
        <span className="eyebrow">Markets<span className="idx">/ 04</span></span>
        <h2 id="markets-title" className="t-display">Choose your<br />risk profile.</h2>
        <p className="t-lede">Two configurations of the same design. Bold lets lenders stack higher on each unit of cover; Steady asks for more cover and lends less against collateral.</p>
        <a className="btn btn-light btn-lg" href={APP}>Compare live markets <ArrowNE /></a>
      </div>
      <div className="market-list">
        {MARKETS.map((m, i) => (
          <a key={m.name} className="market card card-white" href={`/app/markets/${m.slot}`} data-reveal style={css({ "--i": i })}>
            <div className="market-art"><Art slot={m.slot} /></div>
            <div className="market-body">
              <h3 className="t-heading">{m.name}</h3>
              <p className="t-small">{m.line}</p>
              <dl className="market-facts">
                <div><dt>Lenders per cover</dt><dd className="num">{m.lev}</dd></div>
                <div><dt>Minimum cover</dt><dd className="num">{m.min}</dd></div>
                <div><dt>Max LTV</dt><dd className="num">{m.lltv}</dd></div>
              </dl>
            </div>
            <span className="market-go" aria-hidden="true"><ArrowNE /></span>
          </a>
        ))}
        <p className="t-caption market-note">Market configuration, not live state. Neither market is safe: a loss larger than the cover reaches lenders. Live cover and room to lend are in the app.</p>
      </div>
    </section>
  );
}

function Architecture() {
  return (
    <section className="arch" id="architecture" aria-labelledby="arch-title">
      <div className="wrap">
        <div className="sec-head" data-reveal>
          <div>
            <span className="eyebrow">Under the surface<span className="idx">/ 05</span></span>
            <h2 id="arch-title" className="t-display">Built with the protocol,<br /><span className="accent">not around it.</span></h2>
          </div>
          <p className="t-lede arch-lede">Cosign is a vault in front of an unmodified Morpho Blue market. Nothing in Morpho changes; Cosign only decides who pays first.</p>
        </div>
        <div className="arch-flow" data-reveal>
          <div className="arch-col">
            <span className="arch-k">Capital in</span>
            <div className="arch-node"><h3>Co-signers</h3><p>Post MUSD as junior cover. Vote with veBTC.</p></div>
            <div className="arch-node"><h3>Lenders</h3><p>Deposit MUSD as senior, up to the market's multiple of cover.</p></div>
          </div>
          <div className="arch-link" aria-hidden="true" />
          <div className="arch-col arch-core">
            <span className="arch-k">Cosign vault</span>
            <div className="arch-node is-core">
              <div className="tranche t-j"><b>Junior</b><span>pays first</span></div>
              <div className="tranche t-s"><b>Senior</b><span>pays after cover is gone</span></div>
              <p>Syncs Morpho's books and splits every recognised loss, cover first.</p>
            </div>
          </div>
          <div className="arch-link" aria-hidden="true" />
          <div className="arch-col">
            <span className="arch-k">Lending market</span>
            <div className="arch-node"><h3>Morpho Blue</h3><p>MUSD loans against MEZO collateral, unmodified.</p></div>
            <div className="arch-node"><h3>Demo oracle</h3><p>MEZO price set by the Cosign team for testnet demonstrations.</p></div>
          </div>
        </div>
        <div className="arch-under" data-reveal>
          <div><b>Gauge</b><span>veBTC votes direct self-funded MEZO rewards, capped by each market's cover.</span></div>
          <div><b>CosignLiquidator</b><span>Books lenders' interest, liquidates on Morpho, then syncs the loss.</span></div>
          <a className="link" href={REPO} target="_blank" rel="noreferrer">Read the contracts <ArrowNE size={14} /></a>
        </div>
      </div>
    </section>
  );
}

function Evidence() {
  const loss1 = STAGES.find((s) => s.key === "absorbed")!, loss2 = STAGES.find((s) => s.key === "second")!;
  const rows = [
    { n: "01", t: "Direct Morpho liquidation, then sync", s: "Booked senior principal unchanged", v: "300.50", u: "MUSD to cover", h: loss1.hash, b: loss1.block },
    { n: "02", t: "Liquidation through CosignLiquidator", s: "Lenders' interest booked before the loss", v: "60.10", u: "MUSD to cover", h: loss2.hash, b: loss2.block },
  ];
  return (
    <section className="evidence on-dark" id="evidence" aria-labelledby="ev-title">
      <div className="wrap evidence-in">
        <div className="evidence-left" data-reveal>
          <span className="eyebrow">See it for yourself<span className="idx">/ 06</span></span>
          <h2 id="ev-title" className="t-display">Trust less.<br />Verify more.</h2>
          <p className="t-lede">The waterfall ran on Mezo testnet. Every number on this page links to the transaction that produced it.</p>
          <a className="btn btn-white btn-lg" href={EVIDENCE} target="_blank" rel="noreferrer">Open the full evidence <ArrowNE /></a>
        </div>
        <div className="evidence-right" data-reveal style={css({ "--i": 1 })}>
          <div className="ev-head"><span>Recorded event</span><span>Loss</span></div>
          {rows.map((r) => (
            <a key={r.n} className="ev-row" href={tx(r.h)} target="_blank" rel="noreferrer">
              <span className="ev-n num">{r.n}</span>
              <span className="ev-t"><b>{r.t}</b><small>{r.s} · block {r.b.toLocaleString("en-US")}</small></span>
              <span className="ev-v num">{r.v}<small>{r.u}</small></span>
              <ArrowNE className="ev-go" />
            </a>
          ))}
          <div className="ev-stats">
            <div><b className="num">{CHECKS.passed} / {CHECKS.total}</b><span>recorded checks passed; the {CHECKS.total - CHECKS.passed} failures were test-script errors, kept in the evidence</span></div>
            <div><b className="num">{REWARDS.funded} MEZO</b><span>self-funded rewards for epoch {REWARDS.epoch}, distributed and claimed; not Mezo emissions</span></div>
          </div>
          <p className="ev-foot t-caption">Testnet prototype · unaudited · demo oracle · <a href={EXPLORER} target="_blank" rel="noreferrer">Mezo explorer</a></p>
        </div>
      </div>
    </section>
  );
}

function Limits() {
  return (
    <section className="limits wrap" aria-labelledby="limits-title">
      <div className="limits-quote" data-reveal>
        <span className="eyebrow">A new way to measure conviction</span>
        <p className="t-display">Not a rating.<br /><span className="accent">A position.</span></p>
        <p className="t-lede">A vote for a market is more credible when the voter bears the first loss. That is the idea Cosign puts onchain.</p>
      </div>
      <div className="limits-body">
        <div data-reveal>
          <span className="eyebrow">The important details<span className="idx">/ 07</span></span>
          <h2 id="limits-title" className="t-title">Clear about what's covered.</h2>
        </div>
        <div className="limit-cols">
          {[
            ["First-loss, not a guarantee.", "Lenders lose money when a loss is larger than the cover in front of them. Cover is not insurance."],
            ["Rules, with their edges.", "Cover can leave after its notice period. A direct Morpho liquidation can absorb lenders' unbooked interest first."],
            ["A prototype to examine.", "Unaudited, on testnet, with a demo oracle. The vault cap limits deposits, not borrowing on Morpho."],
          ].map(([h, p], i) => (
            <div key={h} className="limit" data-reveal style={css({ "--i": i })}><h3 className="t-heading">{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["Does Cosign guarantee lender deposits?", "No. Posted cover absorbs recognised losses first, and any larger loss reaches lenders. A co-signer whose withdrawal notice has ended can also leave before a loss is booked."],
  ["Where do the MEZO rewards come from?", "Anyone can fund an epoch through the gauge; on testnet so far the Cosign team has. They are not Mezo protocol emissions, and an unfunded epoch pays nothing."],
  ["Is the 19× limit a borrowing cap?", "No. It caps new lender deposits into the Bold vault relative to its cover. Borrowing on the underlying Morpho market is not limited by Cosign."],
  ["Is Cosign on mainnet?", "No. It is an unaudited Mezo testnet prototype with a price oracle the Cosign team controls. Do not use it with real funds."],
  ["Can I check the losses myself?", "Yes. The replay and the evidence section link to the Mezo testnet transactions, and the repository holds every recorded step and check."],
];

function Questions() {
  return (
    <section className="faq wrap" id="questions" aria-labelledby="faq-title">
      <div className="faq-head" data-reveal>
        <span className="eyebrow">Before you explore<span className="idx">/ 08</span></span>
        <h2 id="faq-title" className="t-display">Good questions.<br /><span className="accent">Clear answers.</span></h2>
      </div>
      <div className="faq-list" data-reveal style={css({ "--i": 1 })}>
        {FAQ.map(([q, a]) => (
          <details key={q}>
            <summary><span>{q}</span><Plus className="faq-icon" /></summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="closing" aria-labelledby="closing-title">
      <div className="closing-card">
        <div className="closing-copy" data-reveal>
          <span className="eyebrow">The next chapter in onchain credit</span>
          <h2 id="closing-title" className="t-display">Belief is easy.<br /><span className="accent">Backing it changes everything.</span></h2>
          <a className="btn btn-dark btn-lg" href={APP}>Enter the Cosign app <ArrowNE /></a>
        </div>
        <div className="closing-band" data-parallax="0.1"><Art slot="closing" className="fade-all" /></div>
      </div>
    </section>
  );
}

// keeps the arrow on the line of the last word, so a narrow column never strands it alone
function ext(href: string, label: string) {
  const i = label.lastIndexOf(" ") + 1;
  return <a href={href} target="_blank" rel="noreferrer">{label.slice(0, i)}<span className="nowrap">{label.slice(i)} <ArrowNE size={12} /></span></a>;
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-in">
        <div className="footer-brand">
          <Wordmark href="#top" />
          <p className="t-small">Credit ratings with skin in the game.</p>
        </div>
        <nav aria-label="Footer">
          <span className="eyebrow">Explore</span>
          <a href="#idea">The idea</a><a href="#replay">Loss replay</a><a href="#markets">Markets</a><a href={APP}>Open the app</a>
        </nav>
        <nav aria-label="Verify">
          <span className="eyebrow">Verify</span>
          {ext(REPO, "Source on GitHub")}
          {ext(EVIDENCE, "Testnet evidence")}
          {ext(EXPLORER, "Mezo testnet explorer")}
        </nav>
        <p className="footer-legal t-caption">Unaudited prototype on Mezo testnet. Cover is first-loss capital, not insurance or a guarantee. Testnet tokens have no value.</p>
      </div>
    </footer>
  );
}
