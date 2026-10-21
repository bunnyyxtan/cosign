// Image slots. A slot shows the file in src/art/<slot>.<ext> when present, otherwise a tonal placeholder.
const files = import.meta.glob("../art/*.{avif,webp,jpg,jpeg,png}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const find = (name: string) => {
  for (const ext of ["avif", "webp", "jpg", "jpeg", "png"]) if (files[`../art/${name}.${ext}`]) return files[`../art/${name}.${ext}`];
  return undefined;
};

/** Every slot, with the size it is delivered at and where its subject should sit. See docs/ASSET_BRIEFS.md. */
export const SLOTS = {
  hero: { size: "1898×445", alt: "", focal: "62% 100%", dark: false },
  lend: { size: "1024×282", alt: "", focal: "70% 100%", dark: false },
  cosign: { size: "797×352", alt: "", focal: "50% 100%", dark: false },
  bold: { size: "296×240", alt: "", focal: "50% 60%", dark: true },
  steady: { size: "289×239", alt: "", focal: "50% 60%", dark: false },
  closing: { size: "1372×387", alt: "", focal: "40% 100%", dark: false },
} as const;
export type Slot = keyof typeof SLOTS;

export function Art({ slot, eager, className = "" }: { slot: Slot; eager?: boolean; className?: string }) {
  const s = SLOTS[slot];
  const src = find(slot);
  const mobile = find(`${slot}.mobile`);
  if (!src) {
    return (
      <div className={`art art-blank ${s.dark ? "dark" : ""} ${className}`} aria-hidden="true">
        {import.meta.env.DEV && <span className="art-label">{slot} · {s.size}</span>}
      </div>
    );
  }
  // decorative unless the slot names an alt text
  return (
    <div className={`art ${className}`} aria-hidden={s.alt ? undefined : "true"}>
      <picture>
        {mobile && <source media="(max-width: 640px)" srcSet={mobile} />}
        <img src={src} alt={s.alt} loading={eager ? "eager" : "lazy"} decoding="async" style={{ objectPosition: `var(--focal, ${s.focal})` }} {...(eager ? { fetchpriority: "high" } : {})} />
      </picture>
    </div>
  );
}
