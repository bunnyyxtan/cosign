// Inline icons drawn on a 16px grid with a 1.6 stroke, so they align to text and inherit colour.
type P = { size?: number; className?: string };
const svg = (d: string, cls: string) => ({ size = 16, className = "" }: P) => (
  <svg className={`${cls} ${className}`} width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
export const ArrowNE = svg("M5 11 11 5M6 5h5v5", "arrow-ne");
export const ArrowE = svg("M3 8h10M9 4l4 4-4 4", "arrow-e");
export const ArrowDown = svg("M8 3v10M4 9l4 4 4-4", "arrow-down");
export const Plus = svg("M8 3v10M3 8h10", "plus");
export const Check = svg("M3.5 8.5 6.5 11.5 12.5 4.5", "check");
export const Close = svg("M4 4l8 8M12 4l-8 8", "close");
export const Copy = svg("M5.5 5.5V3.5h7v7h-2M3.5 5.5h7v7h-7z", "copy");
export const Info = svg("M8 14.25A6.25 6.25 0 1 0 8 1.75a6.25 6.25 0 0 0 0 12.5ZM8 7.5V11M8 5h.01", "info");
export const Clock = svg("M8 14.25A6.25 6.25 0 1 0 8 1.75a6.25 6.25 0 0 0 0 12.5ZM8 4.5V8l2.5 1.5", "clock");
export const ChevronDown = svg("M4 6l4 4 4-4", "chev");
// Navigation: one shape per destination, same 16px grid and stroke as the rest.
export const NavMarkets = svg("M2.5 13.5h11M4.5 11V7M8 11V3.5M11.5 11V5.5", "nav");
export const NavCosign = svg("M8 1.75 2.75 3.75v4c0 3 2.2 5.4 5.25 6.5 3.05-1.1 5.25-3.5 5.25-6.5v-4L8 1.75ZM5.75 8l1.5 1.5 3-3", "nav");
export const NavRewards = svg("M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M4.4 4.4l1.6 1.6M10 10l1.6 1.6M11.6 4.4 10 6M6 10l-1.6 1.6", "nav");
export const NavPortfolio = svg("M2.25 5.25h11.5v8H2.25zM5.5 5.25V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.75M2.25 8.75h11.5", "nav");
export const Activity = svg("M1.75 8h2.5l2-4.5 3.5 9 2-4.5h2.5", "act");

/** The Cosign mark: four petals around an empty centre, the space where a loss is held. */
export function Mark({ size = 22, className = "" }: P) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <g fill="currentColor">
        <ellipse cx="6.2" cy="6.2" rx="3.1" ry="4.3" transform="rotate(-45 6.2 6.2)" />
        <ellipse cx="17.8" cy="6.2" rx="3.1" ry="4.3" transform="rotate(45 17.8 6.2)" />
        <ellipse cx="6.2" cy="17.8" rx="3.1" ry="4.3" transform="rotate(45 6.2 17.8)" />
        <ellipse cx="17.8" cy="17.8" rx="3.1" ry="4.3" transform="rotate(-45 17.8 17.8)" />
      </g>
    </svg>
  );
}

export function Wordmark({ href = "/", label = "Cosign home" }: { href?: string; label?: string }) {
  return (
    <a className="wordmark" href={href} aria-label={label}>
      <Mark />
      <span>Cosign<span className="wordmark-dot">.</span></span>
    </a>
  );
}
