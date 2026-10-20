import { formatUnits } from "viem";

const n = (v: bigint) => Number(formatUnits(v, 18));
const money = (v: bigint) => n(v).toLocaleString("en-US", { maximumFractionDigits: 0 });

/**
 * The capital waterfall, drawn to scale. Cover sits in front (left), where losses arrive first;
 * lender deposits sit behind it; unused room to lend is hatched. `lost` / `lostSenior` draw the
 * amount just taken from each tranche in red so a loss is visible as it happens.
 */
export function Waterfall({
  senior, junior, scale, capacity = 0n, lost = 0n, lostSenior = 0n, large = false,
}: {
  senior: bigint; junior: bigint; scale: bigint; capacity?: bigint; lost?: bigint; lostSenior?: bigint; large?: boolean;
}) {
  const total = scale > 0n ? scale : 1n;
  const w = (v: bigint) => `${Math.max(0, (n(v) / n(total)) * 100)}%`;
  const room = capacity > 0n ? capacity : 0n;
  const summary = `Cover ${money(junior)} MUSD in front of ${money(senior)} MUSD of lender deposits${room > 0n ? `, ${money(room)} MUSD room to lend` : ""}${lost + lostSenior > 0n ? `. Loss: cover paid ${money(lost)}, lenders paid ${money(lostSenior)}` : ""}.`;
  return (
    <figure className={large ? "wf large" : "wf"}>
      <div className="wf-bar" role="img" aria-label={summary}>
        <span className="wf-seg lost" style={{ width: w(lost) }} />
        <span className="wf-seg j" style={{ width: w(junior) }} />
        <span className="wf-seg lost" style={{ width: w(lostSenior) }} />
        <span className="wf-seg s" style={{ width: w(senior) }} />
        <span className="wf-seg c" style={{ width: w(room) }} />
      </div>
      <figcaption>
        <span className="cap-j">Cover {money(junior)}</span>
        <span className="cap-s">Lenders {money(senior)}</span>
        {room > 0n && <span className="cap-c">Room {money(room)}</span>}
        {large && <span className="cap-edge">Losses are taken from the left edge first.</span>}
      </figcaption>
    </figure>
  );
}
