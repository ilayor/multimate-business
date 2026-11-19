"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui";
import { initials } from "@/lib/crm";

export type RowAction = { label: string; icon: string; color: string; onClick: () => void };

/**
 * A compact list row. On touch, dragging it sideways reveals its actions (tracks the finger 1:1,
 * projects the flick, snaps open or shut). With a mouse, the actions appear on hover.
 */
export function SwipeRow({ children, actions, href, onOpen }: { children: React.ReactNode; actions: RowAction[]; href?: string; onOpen?: () => void }) {
  const id = useId();
  const W = actions.length * 76;
  const track = useRef<HTMLDivElement>(null);
  const st = useRef({ x0: 0, y0: 0, base: 0, off: 0, mode: "idle" as "idle" | "h" | "v", hist: [] as { x: number; t: number }[], moved: false });
  const [open, setOpen] = useState(false);

  const setOff = (v: number, settle: boolean) => {
    st.current.off = v;
    const el = track.current;
    if (!el) return;
    el.classList.toggle("settle", settle);
    el.style.transform = v ? `translateX(${v}px)` : "";
  };
  const snap = (o: boolean) => {
    setOff(o ? W : 0, true);
    setOpen(o);
    if (o) window.dispatchEvent(new CustomEvent("swipe-open", { detail: id }));
  };
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail !== id && st.current.off) snap(false); };
    window.addEventListener("swipe-open", h);
    return () => window.removeEventListener("swipe-open", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function down(e: React.PointerEvent) {
    if (e.pointerType === "mouse") return;
    const s = st.current;
    Object.assign(s, { x0: e.clientX, y0: e.clientY, base: s.off, mode: "idle", hist: [{ x: e.clientX, t: e.timeStamp }], moved: false });
  }
  function move(e: React.PointerEvent) {
    const s = st.current;
    if (e.pointerType === "mouse" || s.mode === "v") return;
    const dx = e.clientX - s.x0, dy = e.clientY - s.y0;
    if (s.mode === "idle") {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { s.mode = "v"; return; }
      if (Math.abs(dx) < 10) return;
      s.mode = "h";
      s.moved = true;
      track.current?.setPointerCapture(e.pointerId);
    }
    let v = s.base + dx;
    if (v < 0) v = -rubber(-v, W);
    if (v > W) v = W + rubber(v - W, W);
    setOff(v, false);
    s.hist.push({ x: e.clientX, t: e.timeStamp });
    if (s.hist.length > 5) s.hist.shift();
  }
  function up() {
    const s = st.current;
    if (s.mode !== "h") { s.mode = "idle"; return; }
    s.mode = "idle";
    const a = s.hist[0], b = s.hist[s.hist.length - 1];
    const vel = b && a && b.t > a.t ? ((b.x - a.x) / (b.t - a.t)) * 1000 : 0;
    const projected = s.off + (vel / 1000) * 0.99 / (1 - 0.99);
    snap(projected > W / 2);
  }
  function click(e: React.MouseEvent) {
    if (st.current.moved) { e.preventDefault(); st.current.moved = false; return; }
    if (open) { e.preventDefault(); snap(false); return; }
    onOpen?.();
  }

  const body = <div className="row row-btn min-h-[60px]">{children}</div>;
  return (
    <div className="swipe">
      <div className="swipe-actions" aria-hidden={!open}>
        {actions.map((a) => (
          <button key={a.label} type="button" tabIndex={open ? 0 : -1} style={{ background: a.color }} onClick={() => { snap(false); a.onClick(); }}>
            <Icon name={a.icon} size={20} />{a.label}
          </button>
        ))}
      </div>
      <div ref={track} className="swipe-track" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {href ? <Link href={href} onClick={click} className="block">{body}</Link>
          : <div role="button" tabIndex={0} onClick={click} onKeyDown={(e) => e.key === "Enter" && onOpen?.()}>{body}</div>}
        <div className="hover-actions absolute inset-y-0 end-3 items-center gap-1">
          {actions.map((a) => (
            <button key={a.label} type="button" className="icon-btn !w-9 !h-9 bg-[var(--surface-2)]" aria-label={a.label} title={a.label}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); a.onClick(); }}>
              <Icon name={a.icon} size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
const rubber = (over: number, dim: number, c = 0.55) => (over * dim * c) / (dim + c * over);

export function Avatar({ name, tone }: { name: string; tone?: "lead" }) {
  return <span className="avatar" style={tone === "lead" ? { background: "var(--mark-soft)", color: "var(--mark)" } : undefined} aria-hidden>{initials(name)}</span>;
}

export function Chips<T extends string>({ value, onChange, options, label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="fchip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}{o.count != null && <span className="n">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="search">
      <Icon name="search" size={18} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button type="button" aria-label="ניקוי החיפוש" onClick={() => onChange("")}><Icon name="close" size={16} /></button>}
    </label>
  );
}

export function SortSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <label className="relative inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] min-h-10 px-1">
      <Icon name="sort" size={16} />
      <select aria-label="מיון" className="appearance-none bg-transparent pe-1 outline-none" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" className="fab" onClick={onClick}><Icon name="plus" size={20} />{label}</button>;
}

/** Title row for a page: large title with the main action beside it (desktop) or floating (phone). */
export function PageTop({ title, sub, action }: { title: string; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="large-title">{title}</h1>
        {sub && <div className="caption mt-1 text-[14px]">{sub}</div>}
      </div>
      {action}
    </div>
  );
}

export function Section({ title, count, action, children }: { title: string; count?: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-[13px] font-bold muted tracking-wide">{title}{count != null && <span className="num ms-1.5 opacity-70">{count}</span>}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
