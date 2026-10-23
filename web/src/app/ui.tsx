import type { ReactNode } from "react";
import { formatUnits, type Address } from "viem";
import { allowanceKey, type MarketState, type UserState } from "../chain";

export * from "./math";
import { fmt, minCoverBps, pct } from "./math";

export function Figure({ k, v, unit, sub, tone }: { k: string; v: string; unit?: string; sub?: React.ReactNode; tone?: "loss" | "cover" }) {
  return (
    <div className={`afig ${tone ? `is-${tone}` : ""}`}>
      <dt>{k}</dt>
      <dd>
        <span className="afig-v num">{v}</span>
        {unit && <span className="afig-u">{unit}</span>}
      </dd>
      {sub && <p className="afig-s">{sub}</p>}
    </div>
  );
}

/** Digits and one decimal point, at most 18 decimals (the token precision), so what is typed is what is sent. */
export function cleanAmount(v: string) {
  const [whole, ...rest] = v.replace(/,/g, ".").replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 18)}` : whole;
}

export function Amount({ value, onChange, max, unit, id, invalid }: { value: string; onChange: (v: string) => void; max?: bigint; unit: string; id: string; invalid?: boolean }) {
  return (
    <div className={`amount ${invalid ? "is-error" : ""}`}>
      <input id={id} inputMode="decimal" placeholder="0.00" autoComplete="off" value={value} aria-invalid={invalid || undefined}
        onChange={(e) => onChange(cleanAmount(e.target.value))} />
      <span className="amount-unit">{unit}</span>
      {max !== undefined && <button type="button" className="amount-max" onClick={() => onChange(formatUnits(max, 18))}>Max</button>}
    </div>
  );
}

/**
 * The capital stack of one market, on one scale. Losses arrive at the left edge, so cover sits first, lender deposits
 * behind it and unused room to lend is an outline. The dashed marker is the minimum cover; under it, deposits pause.
 */
export function Stack({ m, lost = 0n, lostSenior = 0n, senior, junior, scale, compact = false }: {
  m: MarketState; senior?: bigint; junior?: bigint; scale?: bigint; lost?: bigint; lostSenior?: bigint; compact?: boolean;
}) {
  const s = senior ?? m.senior, j = junior ?? m.junior;
  const room = senior === undefined ? m.capacity : 0n;
  const total = Number(formatUnits(scale ?? (s + j + room + lost + lostSenior), 18)) || 1;
  const w = (v: bigint) => `${(Number(formatUnits(v, 18)) / total) * 100}%`;
  const vault = s + j;
  // minimum cover drawn at its share of the current vault, so it reads against the cover segment
  const minAt = vault > 0n ? (Number(formatUnits(vault, 18)) * (Number(minCoverBps(m)) / 10_000)) / total : 0;
  const label = `Cover ${fmt(j)} MUSD in front of ${fmt(s)} MUSD of lender deposits${room > 0n ? `, ${fmt(room)} MUSD room to lend` : ""}. Minimum cover ${pct(minCoverBps(m), 0)} of the vault.`;
  return (
    <figure className={`astack ${compact ? "is-compact" : ""}`}>
      <div className="astack-bar" role="img" aria-label={vault + room === 0n ? "No cover or lender deposits yet" : label}>
        {vault + room + lost + lostSenior === 0n && <span className="astack-empty">No cover or lender deposits yet</span>}
        {lost > 0n && <span className="astack-seg is-lost" style={{ width: w(lost) }} />}
        <span className="astack-seg is-cover" style={{ width: w(j) }} />
        {lostSenior > 0n && <span className="astack-seg is-lost" style={{ width: w(lostSenior) }} />}
        <span className="astack-seg is-senior" style={{ width: w(s) }} />
        {room > 0n && <span className="astack-seg is-room" style={{ width: w(room) }} />}
        {vault > 0n && <span className="astack-min" style={{ left: `calc(${w(lost)} + ${minAt * 100}%)` }} title={`Minimum cover ${pct(minCoverBps(m), 0)}`} />}
      </div>
      {!compact && (
        <figcaption className="astack-key">
          <span><i className="sw sw-cover" />Cover {fmt(j)}</span>
          <span><i className="sw sw-senior" />Lenders {fmt(s)}</span>
          {room > 0n && <span><i className="sw sw-room" />Room to lend {fmt(room)}</span>}
          {lost + lostSenior > 0n && <span><i className="sw sw-lost" />Loss {fmt(lost + lostSenior)}</span>}
          <span className="astack-mink"><i className="sw-min" />Minimum cover {pct(minCoverBps(m), 0)}</span>
        </figcaption>
      )}
    </figure>
  );
}

export function PageHead({ title, lede, children }: { title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

/** The allowance the connected account has given `spender` for `token`, as read with the rest of its positions. */
export const allowanceOf = (user: UserState | null, token: Address, spender: Address) => user?.allowances[allowanceKey(token, spender)] ?? 0n;

/**
 * Approval and action are two wallet signatures. This shows which one comes next, from the live allowance, so the
 * next step stays in the form whatever happens to the notification.
 */
export function TwoStep({ approve, action, done }: { approve: string; action: string; done: boolean }) {
  return (
    <ol className="twostep" aria-label="Wallet steps">
      <li className={done ? "done" : "on"} aria-current={done ? undefined : "step"}>{done ? `${approve} approved` : `1 · ${approve}`}</li>
      <li className={done ? "on" : ""} aria-current={done ? "step" : undefined}>2 · {action}</li>
    </ol>
  );
}

/** A labelled value in a compact list. */
export function Row({ k, children, tone }: { k: ReactNode; children: ReactNode; tone?: "loss" | "cover" | "muted" }) {
  return <div className="row"><dt>{k}</dt><dd className={`num ${tone ? `is-${tone}` : ""}`}>{children}</dd></div>;
}
