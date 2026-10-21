import { useEffect, useState } from "react";
import { Art, type Slot } from "../ui/Art";
import { ArrowDown, ArrowNE, Mark, Wordmark } from "../ui/Icon";

const APP = "./app/";
const NAV = [
  ["#idea", "The idea"],
  ["#roles", "Roles"],
  ["#replay", "Loss replay"],
  ["#markets", "Markets"],
  ["#evidence", "Evidence"],
] as const;

export function Site() {
  useReveal();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <Header />
      <main id="main">
        <Hero />
        <Idea />
        <Roles />
        <Markets />
      </main>
      <Footer />
    </>
  );
}

/** Adds .in to [data-reveal] elements as they enter the viewport; skipped entirely for reduced motion. */
function useReveal() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => io.disconnect();
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
          <span className="chip chip-plain net-label">Mezo testnet</span>
          <a className="btn btn-dark btn-sm" href={APP}>Open app <ArrowNE /></a>
          <button className="menu-btn" type="button" aria-expanded={open} aria-controls="menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            <span /><span />
          </button>
        </div>
      </div>
      <nav id="menu" className="menu-sheet" aria-label="Sections" hidden={!open} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
        {NAV.map(([h, l], i) => <a key={h} href={h} style={{ "--i": i } as React.CSSProperties}>{l}</a>)}
        <a className="btn btn-dark btn-lg" href={APP}>Open the app <ArrowNE /></a>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-card">
        <Art slot="hero" eager />
        <div className="hero-copy">
          <Mark size={26} className="hero-mark" />
          <span className="eyebrow">A different kind of credit market</span>
          <h1 id="hero-title" className="t-hero">Capital with<br />conviction.</h1>
          <p className="t-lede">When you believe in a market, put capital behind it.<br className="br-wide" /> When things go wrong, your conviction pays first.</p>
          <div className="hero-cta">
            <a className="btn btn-dark btn-lg" href={APP}>Open the app <ArrowNE /></a>
            <a className="btn btn-white btn-lg" href="#replay">Replay a real loss</a>
          </div>
        </div>
        <div className="hero-foot">
          <span>01 / Credit with skin in the game</span>
          <a href="#idea">Scroll <ArrowDown size={14} /></a>
        </div>
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
        <div className="idea-copy" data-reveal style={{ "--i": 1 } as React.CSSProperties}>
          <p className="t-lede">Credit opinions usually cost nothing to give. <strong>Cosign changes that.</strong></p>
          <p className="t-lede">Bitcoin-aligned co-signers post MUSD as junior, first-loss cover on a lending market. Lenders supply behind them. The people who back a market take the first hit if it goes bad.</p>
          <div className="idea-note">
            <Mark size={16} />
            <span>Not a promise of safety.<br />An enforceable order of loss.</span>
          </div>
        </div>
      </div>
      <div className="principles">
        <Principle i={0} tone="art" slot="idea" n="01" k="Commit" title={<>Put capital<br />behind belief.</>} body="Co-signers post real MUSD as cover on the markets they back." />
        <Principle i={1} tone="dark" n="02" k="Protect" title={<>First in line<br />for losses.</>} body="Cover absorbs recognised bad debt before lenders' booked principal." glyph="layers" />
        <Principle i={2} tone="plum" n="03" k="Prove" title={<>Visible.<br />Verifiable.</>} body="Cover, votes and every loss are contract events you can check." glyph="orbit" />
      </div>
    </section>
  );
}

function Principle({ i, tone, slot, n, k, title, body, glyph }: { i: number; tone: "art" | "dark" | "plum"; slot?: Slot; n: string; k: string; title: React.ReactNode; body: string; glyph?: "layers" | "orbit" }) {
  return (
    <article className={`principle card card-pad is-${tone}`} data-reveal style={{ "--i": i } as React.CSSProperties}>
      {slot && <Art slot={slot} />}
      <span className="eyebrow">{n} / {k}</span>
      <h3 className="t-title">{title}</h3>
      <div className="principle-foot">
        <p>{body}</p>
        {glyph && <Glyph kind={glyph} />}
      </div>
    </article>
  );
}

/** Line glyphs for the dark principle cards: stacked layers (order of loss) and an orbit (verification). */
function Glyph({ kind }: { kind: "layers" | "orbit" }) {
  return kind === "layers" ? (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M8 40 32 52l24-12" /><path d="M8 32 32 44l24-12" /><path d="M8 24 32 36l24-12L32 12z" />
    </svg>
  ) : (
    <svg className="glyph" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" /><circle cx="32" cy="32" r="11" /><path d="M6 46 58 18" />
    </svg>
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
        <a className="link" href={`${APP}#/markets`}>View the markets <ArrowNE size={14} /></a>
      </div>
      <div className="roles-grid">
        <RoleCard i={0} cls="r-cosign" slot="cosign" n="01" k="Co-signers" title={<>Back what<br />you believe in.</>}
          body="Post first-loss cover, direct MEZO rewards with veBTC votes, and earn a premium on lenders' interest."
          href={`${APP}#/cosign`} cta="Explore co-signing" />
        <RoleCard i={1} cls="r-lend" slot="lend" n="02" k="Lenders" title={<>Earn behind<br />the cover.</>}
          body="Deposit MUSD into the senior tranche. Posted cover sits in front of recognised losses, up to the cover available."
          href={`${APP}#/markets`} cta="Explore lending" />
        <RoleCard i={2} cls="r-borrow" slot="borrow" n="03" k="Borrowers" title={<>Borrow against<br />MEZO.</>}
          body="Borrow MUSD on the underlying Morpho market. Cosign caps vault deposits, not borrowing."
          href={`${APP}#/markets`} cta="Explore borrowing" />
      </div>
    </section>
  );
}

function RoleCard({ i, cls, slot, n, k, title, body, href, cta }: { i: number; cls: string; slot: Slot; n: string; k: string; title: React.ReactNode; body: string; href: string; cta: string }) {
  return (
    <article className={`role card ${cls}`} data-reveal style={{ "--i": i } as React.CSSProperties}>
      <Art slot={slot} />
      <div className="role-copy card-pad">
        <span className="eyebrow">{n} / {k}</span>
        <h3 className="t-title">{title}</h3>
        <p>{body}</p>
      </div>
      <a className="circle role-go" href={href} aria-label={cta}><ArrowNE /></a>
    </article>
  );
}

const MARKETS = [
  { slot: "bold" as const, n: "01", name: "Bold MEZO", line: "Higher leverage", lltv: "77%", lev: "19×", min: "5%", href: `${APP}#/markets` },
  { slot: "steady" as const, n: "02", name: "Steady MEZO", line: "Lower collateral limit", lltv: "62.5%", lev: "9×", min: "10%", href: `${APP}#/markets` },
];

function Markets() {
  return (
    <section className="markets wrap" id="markets" aria-labelledby="markets-title">
      <div className="markets-intro" data-reveal>
        <span className="eyebrow">Markets<span className="idx">/ 04</span></span>
        <h2 id="markets-title" className="t-display">Choose your<br />risk profile.</h2>
        <p className="t-lede">Two markets with different collateral limits and cover requirements. Both are deployed on Mezo testnet.</p>
        <a className="btn btn-light btn-lg" href={`${APP}#/markets`}>Compare live markets <ArrowNE /></a>
      </div>
      <div className="market-list">
        {MARKETS.map((m, i) => (
          <a key={m.name} className="market card card-white" href={m.href} data-reveal style={{ "--i": i } as React.CSSProperties}>
            <div className="market-art"><Art slot={m.slot} /></div>
            <div className="market-body">
              <div className="market-top">
                <h3 className="t-heading">{m.name}</h3>
                <span className="market-n">{m.n}</span>
              </div>
              <p className="t-small">{m.line} · {m.lltv} max loan-to-value</p>
              <dl className="market-facts">
                <div><dt>Lenders per unit of cover</dt><dd className="num">up to {m.lev}</dd></div>
                <div><dt>Minimum cover</dt><dd className="num">{m.min}</dd></div>
              </dl>
            </div>
            <span className="market-go" aria-hidden="true"><ArrowNE /></span>
          </a>
        ))}
        <p className="t-caption market-note">Configuration, not live state. Current cover and room to lend are read from the chain in the app.</p>
      </div>
    </section>
  );
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
          <a href="https://github.com/bunnyyxtan/cosign" target="_blank" rel="noreferrer">Source on GitHub <ArrowNE size={12} /></a>
          <a href="https://explorer.test.mezo.org/" target="_blank" rel="noreferrer">Mezo testnet explorer <ArrowNE size={12} /></a>
        </nav>
        <p className="footer-legal t-caption">Unaudited prototype on Mezo testnet. Cover is first-loss capital, not insurance or a guarantee. Testnet tokens have no value.</p>
      </div>
    </footer>
  );
}
