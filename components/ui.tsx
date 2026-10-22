"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { deptName, deptVar } from "@/lib/domain";

/* ---------- icons (1.8px stroke, currentColor) ---------- */
const paths: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".8" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 20.5c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  back: <path d="m9 5 7 7-7 7" />,
  forward: <path d="m15 5-7 7 7 7" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></>,
  up: <path d="m6 15 6-6 6 6" />,
  down: <path d="m6 9 6 6 6-6" />,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2.5" /><path d="m16 10.5 5-3v9l-5-3" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  file: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>,
  note: <><path d="M5 4h14v16H5z" /><path d="M9 9h6M9 13h6M9 17h3" /></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 6.5 8.5 7 8.5-7" /></>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></>,
  sliders: <path d="M4 7h10M18 7h2M4 17h4M12 17h8M14 4.5v5M8 14.5v5" />,
  logout: <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};
export function Icon({ name, size = 22, className = "" }: { name: keyof typeof paths | string; size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>{paths[name]}</svg>
  );
}

/* ---------- round check (Multimate style): empty ring → filled green with a tick ---------- */
export function Check({ done, onToggle, label }: { done: boolean; onToggle: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={done} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="grid place-items-center w-11 h-11 -m-2 shrink-0 active:scale-90 transition-transform">
      <span className={`grid place-items-center w-[26px] h-[26px] rounded-full border-2 transition-colors ${done ? "bg-[var(--done)] border-[var(--done)] text-white" : "border-[var(--muted)]/50"}`}>
        {done && <Icon name="check" size={16} />}
      </span>
    </button>
  );
}

/* ---------- segmented control ---------- */
export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>)}
    </div>
  );
}

/* ---------- sheet: bottom on phones, centred card on desktop ---------- */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sticky top-0 z-10 chrome flex items-center justify-between gap-2 px-4 pt-2 pb-2 border-b border-[var(--line)]">
          <div className="absolute top-1.5 inset-x-0 mx-auto w-10 h-1 rounded-full bg-[var(--muted)]/35 md:hidden" aria-hidden />
          <button className="btn-plain mt-2" onClick={onClose}>ביטול</button>
          <h2 className="font-bold mt-2 text-[17px] truncate">{title}</h2>
          <span className="w-[52px]" aria-hidden />
        </div>
        <div className="p-4 space-y-4">{children}</div>
        {footer && <div className="sticky bottom-0 chrome px-4 py-3 border-t border-[var(--line)]">{footer}</div>}
      </div>
    </>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

/* ---------- two-step delete without a dialog ---------- */
export function DeleteButton({ onConfirm, label = "מחיקה", confirmLabel = "למחוק?" }: { onConfirm: () => void; label?: string; confirmLabel?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(t); }, [armed]);
  return armed ? (
    <button type="button" className="btn-danger w-full" onClick={onConfirm}><Icon name="trash" size={18} /> {confirmLabel} לחצו שוב לאישור</button>
  ) : (
    <button type="button" className="btn-danger w-full !bg-transparent" onClick={() => setArmed(true)}><Icon name="trash" size={18} /> {label}</button>
  );
}

/* ---------- toasts with undo ---------- */
type Toast = { id: number; text: string; undo?: () => void };
const ToastCtx = createContext<(text: string, undo?: () => void) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, undo?: () => void) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, undo }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed z-[60] inset-x-0 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] md:bottom-6 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="toast pointer-events-auto flex items-center gap-4 rounded-2xl px-4 py-3 bg-[var(--ink)] text-[var(--bg)] shadow-lg text-sm font-semibold max-w-md w-full justify-between">
            <span>{t.text}</span>
            {t.undo && <button className="font-bold text-[var(--accent-soft)] underline-offset-2" onClick={() => { t.undo!(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>ביטול</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Skeleton({ h = 64, n = 3 }: { h?: number; n?: number }) {
  return <div className="space-y-3" aria-busy="true">{Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton" style={{ height: h }} />)}</div>;
}

/* debounced autosave with status */
export function useAutosave<T>(value: T, save: (v: T) => Promise<boolean>, delay = 700) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);
  const dirty = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;
  const prev = useRef<T>(value);
  useEffect(() => {
    // skip the first render and the moment data arrives (null → loaded); only edits save
    const wasEmpty = prev.current == null;
    prev.current = value;
    if (first.current || wasEmpty) { first.current = false; return; }
    dirty.current = true;
    setState("saving");
    const t = setTimeout(async () => {
      const ok = await saveRef.current(value);
      dirty.current = !ok;
      setState(ok ? "saved" : "error");
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);
  return state;
}

export function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const map = { saving: ["שומר…", "muted"], saved: ["נשמר", "text-[var(--done)]"], error: ["לא נשמר — בדקו חיבור", "text-[var(--bad)] font-semibold"] } as const;
  const [t, c] = map[state];
  return <span aria-live="polite" className={`text-xs ${c}`}>{t}</span>;
}

/* ---------- page header: title, optional subtitle, actions on the far side ---------- */
export function PageHeader({ title, subtitle, eyebrow, actions }: { title: string; subtitle?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <h1 className="large-title">{title}</h1>
        {subtitle && <div className="caption mt-1.5 text-[14px]">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function DeptChip({ code }: { code: string | null | undefined }) {
  return <span className="dept-chip" style={{ ["--c" as string]: deptVar(code) }}>{deptName(code)}</span>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <div className="font-bold text-[var(--ink)]">{title}</div>
      {children && <div className="text-sm max-w-sm">{children}</div>}
    </div>
  );
}

/* ---------- brand mark: the Multimate M with a rising arrow, green and white ---------- */
export function BrandMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 180 180" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id="mm-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#2a8a72" /><stop offset="1" stopColor="#16503f" /></linearGradient>
        <linearGradient id="mm-ar" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#7fe3bd" /><stop offset="1" stopColor="#d9fff0" /></linearGradient>
      </defs>
      <rect width="180" height="180" rx="40" fill="url(#mm-bg)" />
      <path d="M36 72c0-8 6-11 12-6l46 44-15 16-23-22v30c0 6-5 9-10 7l-6-2c-3-1-4-3-4-6z" fill="#fff" />
      <path d="M114 106l22-20v48c0 5-4 8-9 6l-8-3c-3-1-5-4-5-7z" fill="#fff" />
      <path d="M68 132l57-57" stroke="url(#mm-ar)" strokeWidth="22" strokeLinecap="round" />
      <path d="M152 36l-5 49-44-44z" fill="#d9fff0" stroke="#d9fff0" strokeWidth="6" strokeLinejoin="round" />
    </svg>
  );
}
