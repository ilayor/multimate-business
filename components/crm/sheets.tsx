"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Field, Icon, Seg, Sheet, useToast } from "@/components/ui";
import { useCrm } from "@/components/crm/CrmContext";
import { useWhatsApp } from "@/components/crm/WhatsApp";
import { ASSIGNEES, DEPARTMENTS, fmtDate, todayISO, toLocalInput, type Task } from "@/lib/domain";
import {
  activePackage, addDaysISO, ils, isPaid, live, METHOD, packageRemaining, SESSION_STATUS, SOURCES,
  type Client, type Package, type Payment, type Session,
} from "@/lib/crm";

type Open =
  | { kind: "client"; preset?: Partial<Client> }
  | { kind: "session"; session?: Session; preset?: { client_id?: string; at?: Date } }
  | { kind: "finish"; session: Session }
  | { kind: "payment"; payment?: Payment; preset?: { client_id?: string; session_id?: string; amount?: number } }
  | { kind: "package"; preset: { client_id?: string } }
  | { kind: "task"; task?: Task; preset?: Partial<Task> };

const SheetsCtx = createContext<(o: Open) => void>(() => {});
export const useSheets = () => useContext(SheetsCtx);

export function SheetsProvider({ children }: { children: React.ReactNode }) {
  const [o, setO] = useState<Open | null>(null);
  const close = useCallback(() => setO(null), []);
  return (
    <SheetsCtx.Provider value={setO}>
      {children}
      <ClientSheet open={o?.kind === "client"} preset={o?.kind === "client" ? o.preset : undefined} onClose={close} />
      <SessionSheet open={o?.kind === "session"} o={o?.kind === "session" ? o : null} onClose={close} onFinish={(s) => setO({ kind: "finish", session: s })} />
      <FinishSheet session={o?.kind === "finish" ? o.session : null} onClose={close} />
      <PaymentSheet open={o?.kind === "payment"} o={o?.kind === "payment" ? o : null} onClose={close} />
      <PackageSheet clientId={o?.kind === "package" ? o.preset.client_id ?? "" : null} onClose={close} />
      <TaskSheet open={o?.kind === "task"} o={o?.kind === "task" ? o : null} onClose={close} />
    </SheetsCtx.Provider>
  );
}

/* ---------- shared bits ---------- */
function ClientSelect({ value, onChange, includeLeads = true }: { value: string; onChange: (v: string) => void; includeLeads?: boolean }) {
  const { data } = useCrm();
  const cs = live(data.clients).sort((a, b) => a.full_name.localeCompare(b.full_name, "he"));
  const clients = cs.filter((c) => c.kind === "client"), leads = cs.filter((c) => c.kind === "lead");
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">בחירה…</option>
      <optgroup label="מתאמנות">{clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</optgroup>
      {includeLeads && leads.length > 0 && <optgroup label="מתעניינות">{leads.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</optgroup>}
    </select>
  );
}

type Method = Payment["method"];
const METHOD_OPTS = (Object.keys(METHOD) as Method[]).filter((m) => m !== "other").map((m) => ({ value: m, label: METHOD[m] }));

function MoreToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn-plain text-sm" onClick={onToggle} aria-expanded={open}>
      <Icon name={open ? "up" : "down"} size={16} /> {open ? "פחות פרטים" : "עוד פרטים"}
    </button>
  );
}

function ArchiveButton({ onClick, label = "העברה לארכיון" }: { onClick: () => void; label?: string }) {
  return <button type="button" className="btn-danger w-full !bg-transparent" onClick={onClick}><Icon name="archive" size={18} /> {label}</button>;
}

const nextRoundHour = (d = new Date()) => { const x = new Date(d); x.setMinutes(0, 0, 0); x.setHours(x.getHours() + 1); return x; };

/* ---------- new client / lead ---------- */
function ClientSheet({ open, preset, onClose }: { open: boolean; preset?: Partial<Client>; onClose: () => void }) {
  const { insert } = useCrm();
  const toast = useToast();
  const blank = { full_name: "", phone: "", kind: "lead" as Client["kind"], source: "", next_follow_up: "", email: "", goal: "", notes: "" };
  const [f, setF] = useState(blank);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setF({ ...blank, kind: preset?.kind ?? "lead", next_follow_up: preset?.kind === "client" ? "" : addDaysISO(todayISO(), 1) });
    setMore(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const isLead = f.kind === "lead";
  async function save() {
    if (!f.full_name.trim()) return;
    setBusy(true);
    const r = await insert("clients", {
      full_name: f.full_name.trim(), phone: f.phone.trim() || null, kind: f.kind, source: f.source || null,
      next_follow_up: isLead ? f.next_follow_up || null : null, email: f.email.trim() || null, goal: f.goal.trim() || null, notes: f.notes.trim() || null,
      ...(isLead ? {} : { lead_stage: "won", became_client_at: new Date().toISOString() }),
    });
    setBusy(false);
    if (r) { toast(isLead ? "המתעניינת נוספה" : "המתאמנת נוספה"); onClose(); }
  }
  return (
    <Sheet open={open} onClose={onClose} title={isLead ? "מתעניינת חדשה" : "מתאמנת חדשה"}
      footer={<button className="btn w-full" disabled={busy || !f.full_name.trim()} onClick={save}>{busy ? "שומר…" : "הוספה"}</button>}>
      <Seg label="סוג" value={f.kind} onChange={(kind) => setF({ ...f, kind, next_follow_up: kind === "lead" ? f.next_follow_up || addDaysISO(todayISO(), 1) : "" })}
        options={[{ value: "lead", label: "מתעניינת" }, { value: "client", label: "מתאמנת" }]} />
      <Field label="שם מלא"><input className="input text-[17px]" autoFocus value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="טלפון"><input className="input text-left" dir="ltr" type="tel" inputMode="tel" placeholder="050-0000000" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="איך הגיעה?">
          <select className="input" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })}>
            <option value="">לא ידוע</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {isLead && <Field label="לחזור אליה ב"><input type="date" className="input" value={f.next_follow_up} onChange={(e) => setF({ ...f, next_follow_up: e.target.value })} /></Field>}
      </div>
      <MoreToggle open={more} onToggle={() => setMore(!more)} />
      {more && (
        <>
          <Field label="אימייל"><input className="input text-left" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="מה היא רוצה להשיג?"><textarea className="input" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
          <Field label="הערות"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </>
      )}
    </Sheet>
  );
}

/* ---------- session: schedule or edit ---------- */
function SessionSheet({ open, o, onClose, onFinish }: {
  open: boolean; o: Extract<Open, { kind: "session" }> | null; onClose: () => void; onFinish: (s: Session) => void;
}) {
  const { biz, data, insert, update, archive } = useCrm();
  const wa = useWhatsApp();
  const toast = useToast();
  const s = o?.session;
  const [f, setF] = useState({ client_id: "", at: "", duration: 60, price: 300, fromPackage: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (s) setF({ client_id: s.client_id, at: toLocalInput(s.starts_at), duration: s.duration_minutes, price: Number(s.price), fromPackage: !!s.package_id });
    else {
      const at = o?.preset?.at ? new Date(o.preset.at) : nextRoundHour();
      if (o?.preset?.at && at.getHours() === 0) at.setHours(10);
      setF({ client_id: o?.preset?.client_id ?? "", at: toLocalInput(at.toISOString()), duration: biz.default_session_minutes, price: Number(biz.default_session_price), fromPackage: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, s]);
  const pkg = f.client_id ? (s?.package_id ? data.packages.find((p) => p.id === s.package_id) : activePackage(f.client_id, data.packages, data.sessions)) : undefined;
  const client = data.clients.find((c) => c.id === f.client_id);

  async function save() {
    if (!f.client_id || !f.at) return;
    setBusy(true);
    const body = {
      client_id: f.client_id, starts_at: new Date(f.at).toISOString(), duration_minutes: Number(f.duration) || 60,
      price: Number(f.price) || 0, package_id: pkg && f.fromPackage ? pkg.id : null,
    };
    const ok = s ? await update("sessions", s.id, body) : !!(await insert("sessions", body));
    setBusy(false);
    if (ok) { toast(s ? "המפגש עודכן" : "המפגש נקבע"); onClose(); }
  }
  async function setStatus(status: Session["status"]) {
    if (!s) return;
    if (await update("sessions", s.id, { status })) { toast(`סומן: ${SESSION_STATUS[status]}`); onClose(); }
  }

  return (
    <Sheet open={open} onClose={onClose} title={s ? "מפגש" : "מפגש חדש"}
      footer={<button className="btn w-full" disabled={busy || !f.client_id || !f.at} onClick={save}>{busy ? "שומר…" : s ? "שמירה" : "קביעת מפגש"}</button>}>
      {s && s.status === "scheduled" && (
        <button type="button" className="btn w-full !min-h-12 !bg-[var(--done)]" onClick={() => onFinish({ ...s })}>
          <Icon name="check" size={20} /> סיימתי מפגש
        </button>
      )}
      {s && s.status !== "scheduled" && (
        <div className="card p-3 flex items-center justify-between gap-2">
          <span className="font-semibold">סטטוס: {SESSION_STATUS[s.status]}{s.status === "done" && !isPaid(s, data.payments) ? " · לא שולם" : ""}</span>
          <button className="btn-plain text-sm" onClick={() => setStatus("scheduled")}>החזרה למתוכנן</button>
        </div>
      )}
      <Field label="מתאמנת"><ClientSelect value={f.client_id} onChange={(client_id) => setF({ ...f, client_id })} /></Field>
      <Field label="מתי"><input type="datetime-local" className="input" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="משך (דקות)"><input type="number" inputMode="numeric" className="input num" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) })} /></Field>
        <Field label="מחיר (₪)"><input type="number" inputMode="numeric" className="input num" value={f.price} disabled={!!pkg && f.fromPackage} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
      </div>
      {pkg && (
        <button type="button" aria-pressed={f.fromPackage} onClick={() => setF({ ...f, fromPackage: !f.fromPackage })}
          className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 min-h-12 font-semibold transition-colors ${f.fromPackage ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)]"}`}>
          <span className="flex items-center gap-2"><Icon name="package" size={20} /> מהחבילה · נשארו {packageRemaining(pkg, data.sessions)}</span>
          <span className={`flex w-12 h-7 rounded-full p-0.5 transition-colors ${f.fromPackage ? "bg-[var(--accent)] justify-end" : "bg-[var(--surface-2)] justify-start"}`}><span className="block w-6 h-6 rounded-full bg-white shadow" /></span>
        </button>
      )}
      {s && (
        <div className="space-y-2 pt-2">
          {client && s.status === "scheduled" && (
            <button type="button" className="btn-tint w-full" onClick={() => wa({ client, at: s.starts_at, prefer: "reminder" })}><Icon name="wa" size={18} /> תזכורת בוואטסאפ</button>
          )}
          {s.status === "scheduled" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn-tint" onClick={() => setStatus("no_show")}>לא הגיעה</button>
              <button type="button" className="btn-tint" onClick={() => setStatus("cancelled")}>בוטל</button>
            </div>
          )}
          <ArchiveButton onClick={() => { archive("sessions", s.id, "מפגש"); onClose(); }} />
        </div>
      )}
    </Sheet>
  );
}

/* ---------- finish a session: summary, payment, next session ---------- */
function FinishSheet({ session, onClose }: { session: Session | null; onClose: () => void }) {
  const { data, update, insert } = useCrm();
  const toast = useToast();
  const open = !!session;
  const pkg = session ? (session.package_id ? data.packages.find((p) => p.id === session.package_id) : activePackage(session.client_id, data.packages, data.sessions)) : undefined;
  const client = session ? data.clients.find((c) => c.id === session.client_id) : undefined;
  const hasNext = session ? live(data.sessions).some((x) => x.client_id === session.client_id && x.status === "scheduled" && x.id !== session.id && x.starts_at > session.starts_at) : false;
  type Pay = Method | "package" | "later";
  const [f, setF] = useState({ summary: "", pay: "bit" as Pay, amount: 300, next: true, nextAt: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    const nextAt = new Date(session.starts_at); nextAt.setDate(nextAt.getDate() + 7);
    setF({ summary: session.summary ?? "", pay: pkg ? "package" : "bit", amount: Number(session.price), next: !hasNext, nextAt: toLocalInput(nextAt.toISOString()) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);
  if (!session) return null;
  const left = pkg ? packageRemaining(pkg, data.sessions) : 0;

  async function save() {
    if (!session) return;
    setBusy(true);
    const usePkg = f.pay === "package" && pkg;
    const ok = await update("sessions", session.id, { status: "done", summary: f.summary.trim() || null, package_id: usePkg ? pkg.id : null });
    if (ok && f.pay !== "package" && f.pay !== "later" && f.amount > 0) {
      await insert("payments", { client_id: session.client_id, amount: f.amount, method: f.pay, paid_on: todayISO(), session_id: session.id });
    }
    if (ok && f.next && f.nextAt) {
      const remainingAfter = usePkg ? left - 1 : pkg ? left : 0;
      await insert("sessions", {
        client_id: session.client_id, starts_at: new Date(f.nextAt).toISOString(), duration_minutes: session.duration_minutes,
        price: session.price, package_id: pkg && remainingAfter > 0 ? pkg.id : null,
      });
    }
    setBusy(false);
    if (ok) { toast(f.pay === "later" ? "המפגש נסגר · מסומן כלא שולם" : "המפגש נסגר"); onClose(); }
  }

  const payOpts: { value: Pay; label: string }[] = [
    ...(pkg ? [{ value: "package" as Pay, label: `מהחבילה (${left})` }] : []),
    ...METHOD_OPTS.map((m) => ({ value: m.value as Pay, label: m.label })),
    { value: "later", label: "עוד לא" },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={`סיום מפגש · ${client?.full_name.split(" ")[0] ?? ""}`}
      footer={<button className="btn w-full !min-h-12" disabled={busy} onClick={save}>{busy ? "שומר…" : "סגירת המפגש"}</button>}>
      <Field label="1 · מה עשינו? (סיכום קצר)">
        <textarea className="input" autoFocus placeholder="נושא המפגש, תובנות, משימה למתאמנת…" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      </Field>
      <div className="field">
        <span>2 · שולם?</span>
        <div className="flex flex-wrap gap-1.5">
          {payOpts.map((p) => (
            <button key={p.value} type="button" className="fchip" aria-pressed={f.pay === p.value} onClick={() => setF({ ...f, pay: p.value })}>{p.label}</button>
          ))}
        </div>
        {f.pay !== "package" && f.pay !== "later" && (
          <div className="flex items-center gap-2 mt-1">
            <input type="number" inputMode="numeric" aria-label="סכום" className="input num !w-32" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} />
            <span className="muted">₪</span>
          </div>
        )}
      </div>
      <div className="field">
        <span>3 · המפגש הבא</span>
        <button type="button" aria-pressed={f.next} onClick={() => setF({ ...f, next: !f.next })}
          className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 min-h-12 font-semibold transition-colors ${f.next ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface)]"}`}>
          <span>{hasNext ? "כבר נקבע מפגש הבא · לקבוע עוד אחד?" : "לקבוע את המפגש הבא"}</span>
          <span className={`flex w-12 h-7 rounded-full p-0.5 transition-colors ${f.next ? "bg-[var(--accent)] justify-end" : "bg-[var(--surface-2)] justify-start"}`}><span className="block w-6 h-6 rounded-full bg-white shadow" /></span>
        </button>
        {f.next && <input type="datetime-local" aria-label="מועד המפגש הבא" className="input mt-1" value={f.nextAt} onChange={(e) => setF({ ...f, nextAt: e.target.value })} />}
      </div>
    </Sheet>
  );
}

/* ---------- payment ---------- */
function PaymentSheet({ open, o, onClose }: { open: boolean; o: Extract<Open, { kind: "payment" }> | null; onClose: () => void }) {
  const { biz, data, insert, update, archive } = useCrm();
  const toast = useToast();
  const p = o?.payment;
  const [f, setF] = useState({ client_id: "", amount: 300, method: "bit" as Method, paid_on: todayISO(), link: "", note: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    if (p) setF({ client_id: p.client_id, amount: Number(p.amount), method: p.method, paid_on: p.paid_on, link: p.session_id ? "s:" + p.session_id : p.package_id ? "p:" + p.package_id : "", note: p.note ?? "" });
    else setF({ client_id: o?.preset?.client_id ?? "", amount: o?.preset?.amount ?? Number(biz.default_session_price), method: "bit", paid_on: todayISO(), link: o?.preset?.session_id ? "s:" + o.preset.session_id : "", note: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, p]);
  const unpaid = useMemo(() => live(data.sessions).filter((s) => s.client_id === f.client_id && s.status === "done" && (!isPaid(s, data.payments) || "s:" + s.id === f.link)), [data, f.client_id, f.link]);
  const pkgs = live(data.packages).filter((x) => x.client_id === f.client_id);

  async function save() {
    if (!f.client_id || !(f.amount > 0)) return;
    setBusy(true);
    const body = {
      client_id: f.client_id, amount: f.amount, method: f.method, paid_on: f.paid_on, note: f.note.trim() || null,
      session_id: f.link.startsWith("s:") ? f.link.slice(2) : null, package_id: f.link.startsWith("p:") ? f.link.slice(2) : null,
    };
    const ok = p ? await update("payments", p.id, body) : !!(await insert("payments", body));
    setBusy(false);
    if (ok) { toast(p ? "התשלום עודכן" : `נרשם תשלום של ${ils(f.amount)}`); onClose(); }
  }
  return (
    <Sheet open={open} onClose={onClose} title={p ? "תשלום" : "תשלום חדש"}
      footer={<button className="btn w-full" disabled={busy || !f.client_id || !(f.amount > 0)} onClick={save}>{busy ? "שומר…" : p ? "שמירה" : "רישום תשלום"}</button>}>
      <Field label="ממי?"><ClientSelect value={f.client_id} onChange={(client_id) => setF({ ...f, client_id, link: "" })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="סכום (₪)"><input type="number" inputMode="numeric" className="input num text-[17px]" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></Field>
        <Field label="תאריך"><input type="date" className="input" value={f.paid_on} onChange={(e) => setF({ ...f, paid_on: e.target.value })} /></Field>
      </div>
      <div className="field"><span>איך שולם?</span>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(METHOD) as Method[]).map((m) => <button key={m} type="button" className="fchip" aria-pressed={f.method === m} onClick={() => setF({ ...f, method: m })}>{METHOD[m]}</button>)}
        </div>
      </div>
      {f.client_id && (unpaid.length > 0 || pkgs.length > 0) && (
        <Field label="על מה?">
          <select className="input" value={f.link} onChange={(e) => {
            const link = e.target.value;
            const s = link.startsWith("s:") ? data.sessions.find((x) => x.id === link.slice(2)) : undefined;
            const pk = link.startsWith("p:") ? data.packages.find((x) => x.id === link.slice(2)) : undefined;
            setF({ ...f, link, amount: s ? Number(s.price) : pk ? Number(pk.price) : f.amount });
          }}>
            <option value="">כללי</option>
            {unpaid.map((s) => <option key={s.id} value={"s:" + s.id}>מפגש {fmtDate(s.starts_at)} · {ils(Number(s.price))}</option>)}
            {pkgs.map((x) => <option key={x.id} value={"p:" + x.id}>{x.title} ({x.sessions_total} מפגשים)</option>)}
          </select>
        </Field>
      )}
      <Field label="הערה"><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      {p && <ArchiveButton onClick={() => { archive("payments", p.id, `תשלום ${ils(Number(p.amount))}`); onClose(); }} />}
    </Sheet>
  );
}

/* ---------- package ---------- */
function PackageSheet({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const { biz, data, insert, update } = useCrm();
  const toast = useToast();
  const open = clientId !== null;
  const price = Number(biz.default_session_price);
  const [f, setF] = useState({ client_id: "", size: 4, price: 4 * price, paidNow: true, method: "bit" as Method });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setF({ client_id: clientId ?? "", size: 4, price: 4 * price, paidNow: true, method: "bit" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  async function save() {
    if (!f.client_id || f.size < 1) return;
    setBusy(true);
    const pkg = await insert("packages", { client_id: f.client_id, title: `חבילת ${f.size} מפגשים`, sessions_total: f.size, price: f.price, purchased_on: todayISO() }) as Package | null;
    if (pkg && f.paidNow && f.price > 0) await insert("payments", { client_id: f.client_id, amount: f.price, method: f.method, paid_on: todayISO(), package_id: pkg.id });
    // future sessions already booked move into the new package
    if (pkg) {
      const future = live(data.sessions).filter((s) => s.client_id === f.client_id && s.status === "scheduled" && !s.package_id).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, f.size);
      for (const s of future) await update("sessions", s.id, { package_id: pkg.id });
    }
    setBusy(false);
    if (pkg) { toast("החבילה נוספה"); onClose(); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="חבילת מפגשים"
      footer={<button className="btn w-full" disabled={busy || !f.client_id} onClick={save}>{busy ? "שומר…" : "הוספת חבילה"}</button>}>
      <Field label="מתאמנת"><ClientSelect value={f.client_id} onChange={(client_id) => setF({ ...f, client_id })} includeLeads={false} /></Field>
      <div className="field"><span>כמה מפגשים?</span>
        <div className="flex flex-wrap gap-1.5 items-center">
          {[4, 6, 8, 10, 12].map((n) => <button key={n} type="button" className="fchip num" aria-pressed={f.size === n} onClick={() => setF({ ...f, size: n, price: n * price })}>{n}</button>)}
          <input type="number" inputMode="numeric" aria-label="מספר מפגשים אחר" className="input num !w-20 !min-h-9" value={f.size} onChange={(e) => setF({ ...f, size: Number(e.target.value) })} />
        </div>
      </div>
      <Field label="מחיר החבילה (₪)"><input type="number" inputMode="numeric" className="input num text-[17px]" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
      <p className="caption -mt-2">{f.size > 0 ? `${ils(f.price / f.size)} למפגש` : ""}</p>
      <button type="button" aria-pressed={f.paidNow} onClick={() => setF({ ...f, paidNow: !f.paidNow })}
        className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 min-h-12 font-semibold transition-colors ${f.paidNow ? "bg-[var(--done-soft)] text-[var(--done)]" : "bg-[var(--surface)]"}`}>
        <span>שולם עכשיו</span>
        <span className={`flex w-12 h-7 rounded-full p-0.5 transition-colors ${f.paidNow ? "bg-[var(--done)] justify-end" : "bg-[var(--surface-2)] justify-start"}`}><span className="block w-6 h-6 rounded-full bg-white shadow" /></span>
      </button>
      {f.paidNow && (
        <div className="flex flex-wrap gap-1.5">
          {METHOD_OPTS.map((m) => <button key={m.value} type="button" className="fchip" aria-pressed={f.method === m.value} onClick={() => setF({ ...f, method: m.value })}>{m.label}</button>)}
        </div>
      )}
    </Sheet>
  );
}

/* ---------- task ---------- */
function TaskSheet({ open, o, onClose }: { open: boolean; o: Extract<Open, { kind: "task" }> | null; onClose: () => void }) {
  const { insert, update, archive } = useCrm();
  const toast = useToast();
  const t = o?.task;
  const [f, setF] = useState({ title: "", department_code: "", due_on: "", assignee_name: "אורית", status: "todo", description: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const src = { ...o?.preset, ...(t ?? {}) };
    setF({ title: src.title ?? "", department_code: src.department_code ?? "", due_on: src.due_on ?? "", assignee_name: src.assignee_name ?? "אורית", status: src.status ?? "todo", description: src.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, t]);
  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    const body = { title: f.title.trim(), department_code: f.department_code || null, due_on: f.due_on || null, assignee_name: f.assignee_name || null, status: f.status, description: f.description.trim() || null };
    const ok = t ? await update("tasks", t.id, body) : !!(await insert("tasks", body));
    setBusy(false);
    if (ok) { if (!t) toast("המשימה נוספה"); onClose(); }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t ? "משימה" : "משימה חדשה"}
      footer={<button className="btn w-full" disabled={busy || !f.title.trim()} onClick={save}>{busy ? "שומר…" : t ? "שמירה" : "הוספה"}</button>}>
      <Field label="מה צריך לעשות?">
        <textarea className="input text-[17px] !min-h-[64px]" autoFocus value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <Seg label="סטטוס" value={f.status} onChange={(status) => setF({ ...f, status })}
        options={[{ value: "todo", label: "לביצוע" }, { value: "in_progress", label: "בתהליך" }, { value: "done", label: "בוצע" }]} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="תחום">
          <select className="input" value={f.department_code} onChange={(e) => setF({ ...f, department_code: e.target.value })}>
            <option value="">כללי</option>{DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="עד מתי"><input type="date" className="input" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} /></Field>
      </div>
      <div className="field"><span>באחריות</span>
        <Seg label="באחריות" value={f.assignee_name} onChange={(assignee_name) => setF({ ...f, assignee_name })} options={ASSIGNEES.map((a) => ({ value: a, label: a }))} />
      </div>
      <Field label="פירוט"><textarea className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      {t && <ArchiveButton onClick={() => { archive("tasks", t.id, "משימה"); onClose(); }} />}
    </Sheet>
  );
}
