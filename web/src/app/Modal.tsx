import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Close } from "../ui/Icon";
import "./connect.css";

/** Keeps a dialog mounted briefly after it closes so its exit animation can play. */
export function useLeaving(open: boolean) {
  const [shown, setShown] = useState(open);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (open) { setShown(true); setLeaving(false); return; }
    if (!shown) return;
    setLeaving(true);
    const t = setTimeout(() => { setShown(false); setLeaving(false); }, 200);
    return () => clearTimeout(t);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return { shown, leaving };
}

/**
 * A modal sheet: scrim, Escape, focus trap, focus returned to the opener. Centred on desktop, a bottom sheet on phones.
 * `focusKey` re-focuses the main control when the content changes step.
 */
export function Sheet({ title, onClose, leaving, children, describedBy, focusKey, onKeyDown, size = "md" }: {
  title: ReactNode; onClose: () => void; leaving: boolean; children: ReactNode; describedBy?: string; focusKey?: string;
  onKeyDown?: (e: KeyboardEvent) => void; size?: "sm" | "md";
}) {
  const box = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(document.activeElement);
  useEffect(() => {
    const el = box.current?.querySelector<HTMLElement>("[data-autofocus]") ?? box.current?.querySelector<HTMLElement>("button, a[href]");
    el?.focus({ preventScroll: true });
  }, [focusKey]);
  useEffect(() => {
    document.documentElement.classList.add("modal-open");
    const o = opener.current;
    return () => { document.documentElement.classList.remove("modal-open"); (o as HTMLElement | null)?.focus?.({ preventScroll: true }); };
  }, []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    const all = [...(box.current?.querySelectorAll<HTMLElement>("button:not([disabled]), a[href], summary, input:not([disabled])") ?? [])];
    if (e.key === "Tab" && all.length) {
      const i = all.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); all[all.length - 1].focus(); }
      else if (!e.shiftKey && i === all.length - 1) { e.preventDefault(); all[0].focus(); }
    }
    onKeyDown?.(e);
  };
  return (
    <div className={`wm-root${leaving ? " is-leaving" : ""}`} onKeyDown={onKey}>
      <div className="wm-scrim" onClick={onClose} aria-hidden="true" />
      <div className={`wm is-${size}`} ref={box} role="dialog" aria-modal="true" aria-labelledby="wm-title" aria-describedby={describedBy}>
        <header className="wm-head">
          <h2 id="wm-title" className="wm-title">{title}</h2>
          <button className="icon-btn wm-close" onClick={onClose} aria-label="Close"><Close /></button>
        </header>
        {children}
      </div>
    </div>
  );
}
