// Image slots. A slot shows the file in src/art/<slot>.<ext> when present, otherwise a tonal placeholder.
const files = import.meta.glob("../art/*.{avif,webp,jpg,jpeg,png}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const find = (name: string) => {
  for (const ext of ["avif", "webp", "jpg", "jpeg", "png"]) if (files[`../art/${name}.${ext}`]) return files[`../art/${name}.${ext}`];
  return undefined;
};

/** Every slot, with the size it is delivered at and where its subject should sit. See docs/ASSET_BRIEFS.md. */
export const SLOTS = {
  hero: { size: "2880×1360", mobile: "1080×1800", alt: "", focal: "50% 70%", dark: false },
  idea: { size: "1600×1200", alt: "", focal: "50% 50%", dark: false },
  lend: { size: "1200×1440", alt: "", focal: "60% 70%", dark: false },
  cosign: { size: "1200×720", alt: "", focal: "70% 60%", dark: false },
  borrow: { size: "1200×720", alt: "", focal: "70% 60%", dark: false },
  evidence: { size: "1600×1200", alt: "", focal: "50% 50%", dark: true },
  bold: { size: "960×720", alt: "", focal: "50% 60%", dark: false },
  steady: { size: "960×720", alt: "", focal: "50% 60%", dark: false },
  position: { size: "2880×1000", mobile: "1080×1500", alt: "", focal: "75% 60%", dark: false },
  closing: { size: "2880×1200", mobile: "1080×1600", alt: "", focal: "50% 75%", dark: false },
  "app-cover": { size: "2200×640", alt: "", focal: "80% 50%", dark: false },
} as const;
export type Slot = keyof typeof SLOTS;

export function Art({ slot, eager, className = "" }: { slot: Slot; eager?: boolean; className?: string }) {
  const s = SLOTS[slot];
  const src = find(slot);
  const mobile = find(`${slot}.mobile`);
  if (!src) {
    return (
      <div className={`art art-blank ${s.dark ? "dark" : ""} ${className}`} aria-hidden="true">
        {import.meta.env.DEV && <span className="art-label">{slot} · {s.size}{"mobile" in s ? ` · mobile ${s.mobile}` : ""}</span>}
      </div>
    );
  }
  // decorative unless the slot names an alt text
  return (
    <div className={`art ${className}`} aria-hidden={s.alt ? undefined : "true"}>
      <picture>
        {mobile && <source media="(max-width: 640px)" srcSet={mobile} />}
        <img src={src} alt={s.alt} loading={eager ? "eager" : "lazy"} decoding="async" style={{ objectPosition: s.focal }} {...(eager ? { fetchpriority: "high" } : {})} />
      </picture>
    </div>
  );
}
