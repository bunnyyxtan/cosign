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
