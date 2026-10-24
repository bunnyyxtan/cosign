import { addrUrl, txUrl } from "../chain";
import { ArrowNE } from "../ui/Icon";
import type { Ctx } from "./ctx";
import { ConnectGate } from "./Markets";
import { ExitLabel } from "./Cosign";
import { collateralValue, coverExit, debtOf, fmt, fmtCoverShare, fmtDown, ltvBps, PageHead, pct, pctTrim, Row, short, WAD } from "./ui";
import type { Slug } from "./routes";
import { href } from "./routes";

/** Everything this wallet holds across the deployed markets, from the same reads the action panels use. */
export function Portfolio({ user, account, connect, markets, price, activity }: Ctx) {
  if (!account) {
    return (
      <>
        <PageHead title="Portfolio" />
        <div className="empty card card-white"><ConnectGate connect={connect} what="see your balances and positions" /></div>
      </>
    );
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  const rows = markets.map((m) => {
    const p = user?.perVault[m.vault];
    const debt = p ? debtOf(p.borrowShares, m) : 0n;
    const value = p ? collateralValue(p.collateral, price) : 0n;
    const exit = coverExit(m, p, now);
    return { m, p, debt, value, exit, any: !!p && (p.senior > 0n || p.junior > 0n || p.collateral > 0n || debt > 0n || p.rewards > 0n) };
  });
  const held = rows.filter((r) => r.any);
  // Only the columns this wallet has something in; a dash then always means "none in this market".
  const has = {
    lend: held.some((r) => r.p!.senior > 0n), cover: held.some((r) => r.p!.juniorShares > 0n),
    loan: held.some((r) => r.p!.collateral > 0n || r.debt > 0n), claim: held.some((r) => r.p!.rewards > 0n),
  };
  const power = (user?.veTokens ?? []).reduce((a, t) => a + t.power, 0n);
  return (
    <>
      <PageHead title="Portfolio">
        <a className="link" href={addrUrl(account)} target="_blank" rel="noreferrer">{short(account)} <ArrowNE size={14} /></a>
      </PageHead>

      <dl className="kpis card card-white">
        <div><dt>MUSD</dt><dd className="num">{user ? fmtDown(user.musd) : "…"}</dd></div>
        <div><dt>MEZO</dt><dd className="num">{user ? fmtDown(user.mezo, 4) : "…"}</dd></div>
        <div><dt>BTC <small>for network fees</small></dt><dd className="num">{user ? fmtDown(user.btc, 6) : "…"}</dd></div>
        <div><dt>veBTC voting power</dt><dd className="num">{user ? (user.veTokens.length ? fmt(power, 6) : "—") : "…"}</dd></div>
      </dl>

      {!user ? <p className="empty-line" role="status"><span className="spin" />Reading your positions…</p>
        : held.length === 0 ? (
          <div className="empty card card-white">
            <h2 className="panel-title">No positions yet</h2>
            <p>Lend MUSD behind cover, post cover as a co-signer, or borrow against MEZO.</p>
            <div className="empty-actions"><a className="btn btn-dark" href={href.markets()}>Explore markets</a><a className="btn btn-ghost" href={href.cosign()}>Co-sign</a></div>
          </div>
        ) : (
          <section className="panel card card-white" aria-labelledby="pos-h">
            <div className="panel-head"><h2 id="pos-h" className="panel-title">Positions</h2><span className="t-caption">Read at the latest block · updates every 15 s</span></div>
            <div className="table-wrap pf-table">
              <table className="atable">
                <thead><tr>
                  <th>Market</th>
                  {has.lend && <th className="r">Lending (MUSD)</th>}
                  {has.cover && <><th className="r">Cover (MUSD)</th><th className="r">Your cover share</th></>}
                  {has.loan && <><th className="r">Collateral (MEZO)</th><th className="r">Debt (MUSD)</th><th className="r">Loan-to-value</th></>}
                  {has.claim && <th className="r">Claimable (MEZO)</th>}
                  {has.cover && <th>Cover withdrawal</th>}
                  <th className="r">Manage</th>
                </tr></thead>
                <tbody>
                  {held.map(({ m, p, debt, value, exit }) => {
                    const ltv = ltvBps(debt, value);
                    const lim = (m.lltv * 10_000n) / WAD;
                    return (
                      <tr key={m.vault}>
                        <td className="nowrap"><a href={href.market(m.slug)}><b>{m.name}</b></a></td>
                        {has.lend && <td className="r num">{p!.senior > 0n ? fmt(p!.senior) : "—"}</td>}
                        {has.cover && <><td className="r num">{p!.junior > 0n ? <span className="is-cover">{fmt(p!.junior)}</span> : "—"}</td>
                          <td className="r num">{p!.juniorShares > 0n ? fmtCoverShare(p!.juniorShares, m.totalJuniorShares) : "—"}</td></>}
                        {has.loan && <><td className="r num">{p!.collateral > 0n ? fmt(p!.collateral, 4) : "—"}</td>
                          <td className="r num">{debt > 0n ? fmt(debt) : "—"}</td>
                          <td className={`r num ${ltv !== null && debt > 0n && ltv * 10n >= lim * 9n ? "is-loss" : ""}`}>{debt > 0n && ltv !== null ? <>{pct(ltv)} <small>/ {pctTrim(lim)}</small></> : "—"}</td></>}
                        {has.claim && <td className="r num">{p!.rewards > 0n ? fmt(p!.rewards, 4) : "—"}</td>}
                        {has.cover && <td className="t-small">{p!.juniorShares > 0n && exit.kind !== "none" ? <ExitLabel {...exit} /> : "—"}</td>}
                        <td className="r"><Manage slug={m.slug} lending={p!.senior > 0n} cover={p!.juniorShares > 0n} loan={p!.collateral > 0n || debt > 0n} claim={p!.rewards > 0n} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pf-cards">
              {held.map(({ m, p, debt, value, exit }) => {
                const ltv = ltvBps(debt, value);
                return (
                  <div key={m.vault} className="pf-card">
                    <h3 className="panel-title"><a href={href.market(m.slug)}>{m.name}</a></h3>
                    <dl className="rows">
                      {p!.senior > 0n && <Row k="Lending">{fmt(p!.senior)} MUSD</Row>}
                      {p!.junior > 0n && <Row k="Cover" tone="cover">{fmt(p!.junior)} MUSD</Row>}
                      {p!.juniorShares > 0n && <Row k="Your cover share">{fmtCoverShare(p!.juniorShares, m.totalJuniorShares)} of all cover</Row>}
                      {p!.juniorShares > 0n && exit.kind !== "none" && <Row k="Cover withdrawal"><ExitLabel {...exit} /></Row>}
                      {p!.collateral > 0n && <Row k="Collateral">{fmt(p!.collateral, 4)} MEZO <small>≈ {fmt(value)} MUSD</small></Row>}
                      {debt > 0n && <Row k="Debt">{fmt(debt)} MUSD</Row>}
                      {debt > 0n && <Row k="Loan-to-value">{ltv === null ? "—" : pct(ltv)} <small>/ {pctTrim((m.lltv * 10_000n) / WAD)}</small></Row>}
                      {p!.rewards > 0n && <Row k="Claimable">{fmt(p!.rewards, 4)} MEZO</Row>}
                    </dl>
                    <Manage slug={m.slug} lending={p!.senior > 0n} cover={p!.juniorShares > 0n} loan={p!.collateral > 0n || debt > 0n} claim={p!.rewards > 0n} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

      {activity.length > 0 && (
        <section className="panel card card-white" aria-labelledby="act-h">
          <div className="panel-head"><h2 id="act-h" className="panel-title">This session</h2><span className="t-caption">Kept in this tab only</span></div>
          <div className="table-wrap">
            <table className="atable">
              <thead><tr><th>Action</th><th>Status</th><th className="r">Time</th><th className="r">Transaction</th></tr></thead>
              <tbody>
                {activity.map((t) => (
                  <tr key={t.id}>
                    <td>{t.label}</td>
                    <td>{t.text}</td>
                    <td className="r num">{new Date(t.at).toLocaleTimeString()}</td>
                    <td className="r">{t.tx ? <a className="num" href={txUrl(t.tx)} target="_blank" rel="noreferrer">{t.tx.slice(0, 10)}…</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

/** One restrained link per kind of position, each to the control that manages it. */
function Manage({ slug, lending, cover, loan, claim }: { slug: Slug; lending: boolean; cover: boolean; loan: boolean; claim: boolean }) {
  const links: [string, string][] = [];
  if (lending) links.push(["Lending", href.market(slug)]);
  if (cover) links.push(["Cover", href.cosign(slug)]);
  if (loan) links.push(["Loan", href.market(slug, "borrow")]);
  if (claim) links.push(["Claim", href.rewards()]);
  return <span className="pf-manage">{links.map(([t, h]) => <a key={t} className="link" href={h}>{t}</a>)}</span>;
}
