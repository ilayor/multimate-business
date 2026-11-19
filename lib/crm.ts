/* ORSHINA CRM: types, Hebrew labels and the few calculations every screen shares. */

export type Client = {
  id: string;
  business_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  kind: "lead" | "client";
  lead_stage: "new" | "contacted" | "intro_call" | "won" | "lost";
  lost_reason: string | null;
  client_status: "active" | "paused" | "done";
  source: string | null;
  goal: string | null;
  notes: string | null;
  next_follow_up: string | null;
  follow_up_note: string | null;
  became_client_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type Package = {
  id: string;
  business_id: string;
  client_id: string;
  title: string;
  sessions_total: number;
  price: number;
  purchased_on: string;
  archived_at: string | null;
  created_at: string;
};

export type Session = {
  id: string;
  business_id: string;
  client_id: string;
  package_id: string | null;
  starts_at: string;
  duration_minutes: number;
  status: "scheduled" | "done" | "cancelled" | "no_show";
  price: number;
  summary: string | null;
  archived_at: string | null;
  created_at: string;
};

export type Payment = {
  id: string;
  business_id: string;
  client_id: string;
  amount: number;
  method: "bit" | "cash" | "transfer" | "paybox" | "other";
  paid_on: string;
  session_id: string | null;
  package_id: string | null;
  note: string | null;
  archived_at: string | null;
  created_at: string;
};

export type Template = { id: string; business_id: string; key: string; title: string; body: string; position: number };

export type CrmBusiness = {
  id: string;
  name: string;
  monthly_income_goal: number | null;
  default_session_price: number;
  default_session_minutes: number;
};

export const LEAD_STAGE: Record<Client["lead_stage"], string> = {
  new: "חדשה", contacted: "נוצר קשר", intro_call: "שיחת היכרות", won: "נרשמה", lost: "לא רלוונטית",
};
export const OPEN_STAGES = ["new", "contacted", "intro_call"] as const;
export const CLIENT_STATUS: Record<Client["client_status"], string> = { active: "פעילה", paused: "בהפסקה", done: "סיימה" };
export const SESSION_STATUS: Record<Session["status"], string> = { scheduled: "מתוכנן", done: "בוצע", cancelled: "בוטל", no_show: "לא הגיעה" };
export const METHOD: Record<Payment["method"], string> = { bit: "ביט", cash: "מזומן", transfer: "העברה", paybox: "פייבוקס", other: "אחר" };
export const SOURCES = ["המלצה", "אינסטגרם", "פייסבוק", "וואטסאפ", "אתר", "אחר"];

export const live = <T extends { archived_at: string | null }>(xs: T[]) => xs.filter((x) => !x.archived_at);
export const ils = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/* ---------- packages ---------- */
export const packageUsed = (p: Package, sessions: Session[]) =>
  sessions.filter((s) => s.package_id === p.id && !s.archived_at && (s.status === "done" || s.status === "no_show")).length;
export const packageRemaining = (p: Package, sessions: Session[]) => Math.max(0, p.sessions_total - packageUsed(p, sessions));
/** The package the next session should draw from: the oldest one that still has sessions left. */
export function activePackage(clientId: string, packages: Package[], sessions: Session[]) {
  return live(packages)
    .filter((p) => p.client_id === clientId && packageRemaining(p, sessions) > 0)
    .sort((a, b) => a.purchased_on.localeCompare(b.purchased_on))[0];
}

/* ---------- money ---------- */
export const isPaid = (s: Session, payments: Payment[]) =>
  !!s.package_id || payments.some((p) => p.session_id === s.id && !p.archived_at);
export const unpaidSessions = (sessions: Session[], payments: Payment[]) =>
  live(sessions).filter((s) => s.status === "done" && !isPaid(s, payments)).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
export const clientDebt = (clientId: string, sessions: Session[], payments: Payment[]) =>
  unpaidSessions(sessions.filter((s) => s.client_id === clientId), payments).reduce((n, s) => n + Number(s.price), 0);
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthPayments = (payments: Payment[], ym: string) => live(payments).filter((p) => p.paid_on.startsWith(ym));
export const sum = (ps: { amount: number }[]) => ps.reduce((n, p) => n + Number(p.amount), 0);

/* ---------- sessions ---------- */
export const nextSession = (clientId: string, sessions: Session[]) =>
  live(sessions)
    .filter((s) => s.client_id === clientId && s.status === "scheduled" && new Date(s.starts_at) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
/** Scheduled sessions whose time has passed: still waiting for "סיימתי מפגש". */
export const sessionsToClose = (sessions: Session[]) =>
  live(sessions).filter((s) => s.status === "scheduled" && new Date(s.starts_at).getTime() + s.duration_minutes * 60000 < Date.now());

export const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const addDaysISO = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoDay(d); };
export const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/* ---------- WhatsApp ---------- */
/** Israeli numbers: 050-1234567 → 972501234567. */
export function waNumber(phone: string | null | undefined) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d.length >= 9 ? d : null;
}
export function fillTemplate(body: string, vars: { name?: string; at?: string; amount?: number }) {
  const first = (vars.name ?? "").trim().split(/\s+/)[0] ?? "";
  const at = vars.at ? new Date(vars.at) : null;
  return body
    .replaceAll("{שם}", first)
    .replaceAll("{יום}", at ? dayWord(at) : "")
    .replaceAll("{שעה}", at ? at.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "")
    .replaceAll("{סכום}", vars.amount != null ? String(Math.round(vars.amount)) : "");
}
function dayWord(d: Date) {
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 864e5);
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  return "ב" + d.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" });
}
export const waLink = (phone: string | null, text: string) => {
  const n = waNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
};

export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("");
