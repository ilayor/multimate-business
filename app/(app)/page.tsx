"use client";
import Link from "next/link";
import { useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { useWhatsApp } from "@/components/crm/WhatsApp";
import { Avatar, Section } from "@/components/crm/kit";
import { Check, DeptChip, Icon } from "@/components/ui";
import { fmtDate, fmtTime, isOpenTask, relDay, todayISO } from "@/lib/domain";
import {
  ils, live, monthKey, monthPayments, OPEN_STAGES, sameDay, sessionsToClose, sum, unpaidSessions,
} from "@/lib/crm";

export default function TodayPage() {
  const { biz, data, update } = useCrm();
  const open = useSheets();
  const wa = useWhatsApp();
  const today = todayISO();
  const now = new Date();
  const name = (id: string) => data.clients.find((c) => c.id === id);

  // numbers
  const income = sum(monthPayments(data.payments, monthKey()));
  const goal = Number(biz.monthly_income_goal) || 0;
  const clients = live(data.clients);
  const active = clients.filter((c) => c.kind === "client" && c.client_status === "active").length;
  const newLeads = clients.filter((c) => c.kind === "lead" && c.created_at.startsWith(monthKey())).length;
  const unpaid = unpaidSessions(data.sessions, data.payments);
  const debt = unpaid.reduce((n, s) => n + Number(s.price), 0);

  // what to do today
  const todaySessions = live(data.sessions).filter((s) => s.status === "scheduled" && sameDay(new Date(s.starts_at), now) && !sessionsToClose([s]).length);
  const toClose = sessionsToClose(data.sessions).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const followUps = clients.filter((c) => c.kind === "lead" && (OPEN_STAGES as readonly string[]).includes(c.lead_stage) && c.next_follow_up && c.next_follow_up <= today)
    .sort((a, b) => (a.next_follow_up ?? "").localeCompare(b.next_follow_up ?? ""));
  const tasks = live(data.tasks).filter((t) => isOpenTask(t) && ((t.due_on && t.due_on <= today) || t.status === "in_progress"))
    .sort((a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9"));
  const nothing = !todaySessions.length && !toClose.length && !followUps.length && !tasks.length && !unpaid.length;

  const hour = now.getHours();
  const hello = hour < 12 ? "בוקר טוב" : hour < 17 ? "צהריים טובים" : hour < 21 ? "ערב טוב" : "לילה טוב";

  return (
    <div className="space-y-7">
      <div>
        <div className="caption font-semibold">{now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h1 className="large-title mt-0.5">{hello}, אורית</h1>
      </div>

      {/* numbers first */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link href="/payments" className="stat col-span-2 lg:col-span-1">
          <span className="l">הכנסות החודש</span>
          <span className="v">{ils(income)}</span>
          {goal > 0 ? (
            <>
              <div className="bar mt-1"><span style={{ width: `${Math.min(100, (income / goal) * 100)}%` }} /></div>
              <span className="caption num">{Math.round((income / goal) * 100)}% מהיעד · {ils(goal)}</span>
            </>
          ) : <span className="caption">אפשר להגדיר יעד חודשי בהגדרות</span>}
        </Link>
        <Link href="/clients" className="stat"><span className="l">מתאמנות פעילות</span><span className="v">{active}</span></Link>
        <Link href="/clients?tab=leads" className="stat"><span className="l">מתעניינות החודש</span><span className="v">{newLeads}</span></Link>
        <Link href="/payments" className="stat col-span-2 lg:col-span-1">
          <span className="l">ממתין לתשלום</span>
          <span className={`v ${debt ? "text-[var(--bad)]" : ""}`}>{ils(debt)}</span>
          <span className="caption">{unpaid.length ? `${unpaid.length} מפגשים` : "הכול שולם"}</span>
        </Link>
      </div>

      {nothing && (
        <div className="empty">
          <span className="empty-icon"><Icon name="check" size={22} /></span>
          <div className="font-bold text-[var(--ink)]">אין משהו פתוח להיום</div>
          <div className="text-sm">מפגשים, פולואפים ומשימות של היום יופיעו כאן.</div>
        </div>
      )}

      {(todaySessions.length > 0 || toClose.length > 0) && (
        <Section title="מפגשים" count={todaySessions.length + toClose.length}>
          <div className="list-group">
            {toClose.map((s) => {
              const c = name(s.client_id);
              return (
                <div key={s.id} className="row">
                  <Avatar name={c?.full_name ?? "?"} />
                  <button className="flex-1 min-w-0 text-start" onClick={() => open({ kind: "session", session: s })}>
                    <div className="font-semibold truncate">{c?.full_name}</div>
                    <div className="caption num text-[var(--mark)] font-semibold">{relDay(s.starts_at)} · {fmtTime(s.starts_at)} · מחכה לסגירה</div>
                  </button>
                  <button className="btn !min-h-9 !px-3 text-sm !bg-[var(--done)]" onClick={() => open({ kind: "finish", session: s })}>סיימתי</button>
                </div>
              );
            })}
            {todaySessions.map((s) => {
              const c = name(s.client_id);
              return (
                <div key={s.id} className="row">
                  <span className="w-12 text-center num font-bold text-[var(--accent)]">{fmtTime(s.starts_at)}</span>
                  <button className="flex-1 min-w-0 text-start" onClick={() => open({ kind: "session", session: s })}>
                    <div className="font-semibold truncate">{c?.full_name}</div>
                    <div className="caption">{s.duration_minutes} דק׳{s.package_id ? " · מהחבילה" : ` · ${ils(Number(s.price))}`}</div>
                  </button>
                  {c && <button className="icon-btn" aria-label={`תזכורת בוואטסאפ ל${c.full_name}`} onClick={() => wa({ client: c, at: s.starts_at, prefer: "reminder" })}><Icon name="wa" size={20} /></button>}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {followUps.length > 0 && (
        <Section title="לחזור אליהן" count={followUps.length}>
          <div className="list-group">
            {followUps.map((c) => (
              <div key={c.id} className="row">
                <Avatar name={c.full_name} tone="lead" />
                <Link href={`/clients/${c.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.full_name}</div>
                  <div className={`caption truncate ${c.next_follow_up! < today ? "!text-[var(--accent)] font-semibold" : ""}`}>
                    {c.next_follow_up! < today ? `באיחור · ${fmtDate(c.next_follow_up!)}` : "היום"}{c.follow_up_note ? ` · ${c.follow_up_note}` : ""}
                  </div>
                </Link>
                <button className="icon-btn" aria-label={`וואטסאפ ל${c.full_name}`} onClick={() => wa({ client: c, prefer: "follow_up" })}><Icon name="wa" size={20} /></button>
              </div>
            ))}
          </div>
        </Section>
      )}

      {tasks.length > 0 && (
        <Section title="משימות" count={tasks.length} action={<Link href="/tasks" className="btn-plain text-sm">כל המשימות</Link>}>
          <div className="list-group">
            {tasks.slice(0, 6).map((t) => (
              <div key={t.id} className="row cursor-pointer" onClick={() => open({ kind: "task", task: t })}>
                <Check done={t.status === "done"} label={`סימון כבוצע: ${t.title}`} onToggle={() => update("tasks", t.id, { status: "done" })} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold leading-snug">{t.title}</div>
                  <div className="flex items-center gap-2 mt-0.5"><DeptChip code={t.department_code} />
                    {t.due_on && <span className={`caption num ${t.due_on < today ? "!text-[var(--bad)] font-semibold" : ""}`}>{t.due_on < today ? "באיחור · " : ""}{relDay(t.due_on)}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {unpaid.length > 0 && (
        <Section title="לא שולם" count={unpaid.length} action={<Link href="/payments" className="btn-plain text-sm">לתשלומים</Link>}>
          <div className="list-group">
            {unpaid.slice(0, 5).map((s) => {
              const c = name(s.client_id);
              return (
                <div key={s.id} className="row">
                  <Avatar name={c?.full_name ?? "?"} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c?.full_name}</div>
                    <div className="caption num">מפגש {fmtDate(s.starts_at)} · {ils(Number(s.price))}</div>
                  </div>
                  {c && <button className="icon-btn" aria-label={`בקשת תשלום מ${c.full_name}`} onClick={() => wa({ client: c, amount: Number(s.price), prefer: "payment" })}><Icon name="wa" size={20} /></button>}
                  <button className="btn-tint !min-h-9 text-sm" onClick={() => open({ kind: "payment", preset: { client_id: s.client_id, session_id: s.id, amount: Number(s.price) } })}>שולם</button>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
