"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { AppHeader } from "@/components/Shell";
import { Empty, Icon, Sheet, Field, Skeleton } from "@/components/ui";
import { MeetingSheet } from "@/components/biz2/sheets";
import { Calendar, type CalItem } from "@/components/home/Calendar";
import { isOpenTask, projectProgress, pct, relDay, fmtTime, toLocalInput, todayISO, type Meeting, type Milestone, type Project, type Task } from "@/lib/domain";

type Biz = { id: string; name: string; profession: string | null; owner_name: string | null };
type Data = { biz: Biz[]; tasks: Task[]; projects: Project[]; milestones: Milestone[]; meetings: Meeting[] };
type Alert = { key: string; bizId: string; bizName: string; text: string; tone: "bad" | "mark" | "accent"; href: string };

const greeting = () => { const h = new Date().getHours(); return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב"; };

export default function Home() {
  const user = useRequireUser();
  const router = useRouter();
  const [d, setD] = useState<Data | null>(null);
  const [name, setName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<{ open: boolean; bizId?: string; at?: string }>({ open: false });
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const [{ data: biz }, { data: org }, { data: prof }, { data: mem }] = await Promise.all([
      sb.from("businesses").select("id,name,profession,owner_name").order("created_at"),
      sb.from("organizations").select("id").limit(1),
      sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      sb.from("business_memberships").select("role").eq("user_id", user.id),
    ]);
    const list = (biz as Biz[]) ?? [];
    const consultant = (mem ?? []).some((m: { role: string }) => m.role === "consultant");
    if (!consultant && list.length === 1) { router.replace(`/b/${list[0].id}`); return; }
    setName(prof?.display_name ?? ""); setOrgId(org?.[0]?.id ?? null);
    const ids = list.map((b) => b.id);
    if (!ids.length) { setD({ biz: [], tasks: [], projects: [], milestones: [], meetings: [] }); return; }
    const [{ data: t }, { data: p }, { data: ms }, { data: m }] = await Promise.all([
      sb.from("tasks").select("*").in("business_id", ids).is("archived_at", null),
      sb.from("projects").select("*").in("business_id", ids).is("archived_at", null),
      sb.from("project_milestones").select("*").in("business_id", ids),
      sb.from("meetings").select("*").in("business_id", ids).is("archived_at", null).order("scheduled_at"),
    ]);
    setD({ biz: list, tasks: (t as Task[]) ?? [], projects: (p as Project[]) ?? [], milestones: (ms as Milestone[]) ?? [], meetings: (m as Meeting[]) ?? [] });
  }, [user, router]);
  useEffect(() => { load(); }, [load]);

  const now = new Date().toISOString();
  const derived = useMemo(() => {
    if (!d) return null;
    const nameOf = (id: string) => d.biz.find((b) => b.id === id)?.name ?? "";
    const next = (id: string) => d.meetings.find((m) => m.business_id === id && m.scheduled_at > now);
    const last = (id: string) => [...d.meetings].reverse().find((m) => m.business_id === id && m.scheduled_at <= now);
    const alerts: Alert[] = [];
    for (const b of d.biz) {
      const open = d.tasks.filter((t) => t.business_id === b.id && isOpenTask(t));
      const overdue = open.filter((t) => t.due_on && t.due_on < todayISO());
      if (overdue.length) alerts.push({ key: b.id + "o", bizId: b.id, bizName: b.name, tone: "bad", href: `/b/${b.id}/tasks`,
        text: overdue.length === 1 ? `משימה באיחור: ${overdue[0].title}` : `${overdue.length} משימות באיחור` });
      const blocked = open.filter((t) => t.status === "blocked");
      if (blocked.length) alerts.push({ key: b.id + "b", bizId: b.id, bizName: b.name, tone: "bad", href: `/b/${b.id}/tasks`, text: blocked.length === 1 ? `משימה תקועה: ${blocked[0].title}` : `${blocked.length} משימות תקועות` });
      const todayMeet = d.meetings.find((m) => m.business_id === b.id && relDay(m.scheduled_at) === "היום" && m.scheduled_at > now);
      if (todayMeet) alerts.push({ key: b.id + "t", bizId: b.id, bizName: b.name, tone: "accent", href: `/b/${b.id}/meetings/${todayMeet.id}`, text: `פגישה היום ב-${fmtTime(todayMeet.scheduled_at)}` });
      const undocumented = d.meetings.filter((m) => m.business_id === b.id && !m.completed_at && new Date(m.scheduled_at).getTime() < Date.now() - 2 * 3600e3);
      if (undocumented.length) alerts.push({ key: b.id + "u", bizId: b.id, bizName: b.name, tone: "mark", href: `/b/${b.id}/meetings/${undocumented[undocumented.length - 1].id}`, text: "פגישה שלא תועדה עד הסוף" });
      const late = d.projects.filter((p) => p.business_id === b.id && p.target_date && p.target_date < todayISO() && (projectProgress(p, d.milestones, d.tasks) ?? 0) < 1);
      if (late.length) alerts.push({ key: b.id + "p", bizId: b.id, bizName: b.name, tone: "mark", href: `/b/${b.id}/projects`, text: `${late.length} פרויקטים עברו את תאריך היעד` });
    }
    const calItems: CalItem[] = d.meetings.map((m) => ({ id: m.id, businessId: m.business_id, businessName: nameOf(m.business_id), at: m.scheduled_at, title: m.title, done: !!m.completed_at }));
    const needMeeting = d.biz.filter((b) => !next(b.id)).map((b) => ({ b, last: last(b.id) }));
    return { alerts, calItems, needMeeting, next, last };
  }, [d, now]);

  if (!user || !d || !derived) return <><AppHeader /><main className="max-w-6xl mx-auto p-4"><Skeleton h={120} /></main></>;

  return (
    <>
      <AppHeader right={<button className="btn-tint" onClick={() => setAdding(true)}><Icon name="plus" size={18} /> עסק</button>} />
      <main className="max-w-6xl mx-auto px-4 pt-6 pb-[calc(40px+env(safe-area-inset-bottom,0px))] space-y-8">
        <div className="space-y-4">
          <div>
            <div className="eyebrow">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</div>
            <h1 className="large-title mt-1">{greeting()}{name ? `, ${name}` : ""}</h1>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Summary icon="user" label="עסקים בליווי" value={d.biz.length} />
            <Summary icon="calendar" label="פגישות השבוע" value={d.meetings.filter((m) => m.scheduled_at > now && new Date(m.scheduled_at).getTime() < Date.now() + 7 * 864e5).length} />
            <Summary icon="list" label="משימות פתוחות" value={d.tasks.filter(isOpenTask).length} />
            <Summary icon="bell" label="התראות" value={derived.alerts.length} tone={derived.alerts.length ? "bad" : undefined} />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* businesses: right */}
          <section className="space-y-3 min-w-0 order-2 lg:order-1">
            <h2 className="section-title">עסקים בליווי <span className="num muted font-normal text-base">{d.biz.length}</span></h2>
            {d.biz.length === 0 && <Empty icon="user" title="עוד אין עסקים בליווי">לחצו "+ עסק" למעלה כדי להוסיף את הראשון.</Empty>}
            {d.biz.map((b) => <BizCard key={b.id} b={b} d={d} next={derived.next(b.id)} last={derived.last(b.id)} />)}
          </section>

          {/* alerts + calendar: left */}
          <aside className="space-y-6 order-1 lg:order-2">
            <section className="space-y-3">
              <h2 className="section-title flex items-center gap-2"><Icon name="bell" size={20} /> התראות</h2>
              {derived.alerts.length === 0 ? <Empty icon="check" title="אין התראות">הכול בזמן.</Empty> : (
                <div className="list-group">
                  {derived.alerts.map((a) => (
                    <Link key={a.key} href={a.href} className="row row-btn">
                      <span aria-hidden className={`w-2.5 h-2.5 rounded-full shrink-0 ${a.tone === "bad" ? "bg-[var(--bad)]" : a.tone === "mark" ? "bg-[var(--mark)]" : "bg-[var(--accent)]"}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-[15px] leading-snug">{a.text}</span>
                        <span className="block caption">{a.bizName}</span>
                      </span>
                      <Icon name="forward" size={18} className="text-[var(--muted)]" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
            <section className="space-y-3">
              <h2 className="section-title flex items-center gap-2"><Icon name="calendar" size={20} /> פגישות</h2>
              <Calendar items={derived.calItems} onPickDay={(day) => { const x = new Date(day); x.setHours(18, 0, 0, 0); setSchedule({ open: true, at: toLocalInput(x.toISOString()) }); }} />
            </section>
          </aside>
        </div>

        {/* who needs a next meeting */}
        <section className="space-y-3">
          <h2 className="section-title">צריך לקבוע פגישה הבאה</h2>
          {derived.needMeeting.length === 0 ? <div className="empty text-sm">לכל העסקים יש פגישה קבועה.</div> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {derived.needMeeting.map(({ b, last }) => {
                const days = last ? Math.floor((Date.now() - new Date(last.scheduled_at).getTime()) / 864e5) : null;
                return (
                  <div key={b.id} className="card p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{b.name}</div>
                      <div className={`caption ${days != null && days > 10 ? "!text-[var(--bad)] font-semibold" : ""}`}>
                        {last ? `פגישה אחרונה לפני ${days === 0 ? "פחות מיום" : `${days} ימים`}` : "עוד לא הייתה פגישה"}
                      </div>
                    </div>
                    <button className="btn-tint shrink-0" onClick={() => setSchedule({ open: true, bizId: b.id })}>קביעה</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <MeetingSheet open={schedule.open} onClose={() => setSchedule({ open: false })} businessId={schedule.bizId}
        businesses={d.biz} defaultAt={schedule.at} onSaved={load} />
      <NewBusinessSheet open={adding} onClose={() => setAdding(false)} orgId={orgId} onCreated={(id) => router.push(`/b/${id}`)} />
    </>
  );
}

function BizCard({ b, d, next, last }: { b: Biz; d: Data; next?: Meeting; last?: Meeting }) {
  const weekly = d.tasks.filter((t) => t.business_id === b.id && t.is_weekly_commitment && t.status !== "canceled");
  const weeklyDone = weekly.filter((t) => t.status === "done").length;
  const overdue = d.tasks.filter((t) => t.business_id === b.id && isOpenTask(t) && t.due_on && t.due_on < todayISO()).length;
  const projects = d.projects.filter((p) => p.business_id === b.id);
  const progresses = projects.map((p) => projectProgress(p, d.milestones, d.tasks)).filter((x): x is number => x != null);
  const avg = progresses.length ? progresses.reduce((a, c) => a + c, 0) / progresses.length : null;
  return (
    <Link href={`/b/${b.id}`} className="card block p-4 active:scale-[.99] transition-transform">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid place-items-center w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] text-xl font-extrabold shrink-0">{b.name[0]}</span>
        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold truncate">{b.name}</div>
          <div className="caption truncate">{[b.profession, b.owner_name].filter(Boolean).join(" · ")}</div>
        </div>
        <Icon name="forward" size={20} className="text-[var(--muted)]" />
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        <Stat label="השבוע" value={weekly.length ? `${weeklyDone}/${weekly.length}` : "—"} sub={weekly.length ? "משימות בוצעו" : "לא נקבעו"} tone={weekly.length && weeklyDone === weekly.length ? "done" : undefined} />
        <Stat label="פרויקטים" value={pct(avg)} sub={`${projects.length} פעילים`} />
        <Stat label="באיחור" value={String(overdue)} sub="משימות" tone={overdue ? "bad" : undefined} />
        <Stat label="פגישה הבאה" value={next ? relDay(next.scheduled_at) : "—"} sub={next ? fmtTime(next.scheduled_at) : last ? "לא נקבעה" : "אין עדיין"} tone={next ? undefined : "mark"} />
      </dl>
    </Link>
  );
}

function Summary({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: "bad" }) {
  return (
    <div className="card px-3 py-3 flex items-center gap-3">
      <span className={`grid place-items-center w-10 h-10 rounded-xl shrink-0 ${tone === "bad" ? "bg-[var(--bad-soft)] text-[var(--bad)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}><Icon name={icon} size={20} /></span>
      <div className="min-w-0">
        <div className="num text-xl font-extrabold leading-none">{value}</div>
        <div className="caption leading-tight mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" | "mark" | "done" }) {
  const c = tone === "bad" ? "text-[var(--bad)]" : tone === "mark" ? "text-[var(--mark)]" : tone === "done" ? "text-[var(--done)]" : "";
  return (
    <div className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
      <dt className="caption font-semibold">{label}</dt>
      <dd className={`num text-lg font-extrabold leading-tight ${c}`}>{value}</dd>
      <dd className="caption leading-tight">{sub}</dd>
    </div>
  );
}

function NewBusinessSheet({ open, onClose, orgId, onCreated }: { open: boolean; onClose: () => void; orgId: string | null; onCreated: (id: string) => void }) {
  const [f, setF] = useState({ name: "", profession: "", owner: "" });
  const [busy, setBusy] = useState(false);
  async function create() {
    if (!orgId || !f.name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase().rpc("create_business", { p_org: orgId, p_name: f.name.trim() });
    if (!error && data) {
      await supabase().from("businesses").update({ profession: f.profession || null, owner_name: f.owner || null }).eq("id", data);
      onCreated(data as string);
    }
    setBusy(false);
  }
  return (
    <Sheet open={open} onClose={onClose} title="עסק חדש בליווי"
      footer={<button className="btn w-full" disabled={busy || !f.name.trim() || !orgId} onClick={create}>{busy ? "יוצר…" : "יצירה ומעבר לעסק"}</button>}>
      <Field label="שם העסק"><input className="input text-[17px]" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="מקצוע / תחום"><input className="input" value={f.profession} placeholder="למשל: אימון אישי" onChange={(e) => setF({ ...f, profession: e.target.value })} /></Field>
      <Field label="שם בעל/ת העסק"><input className="input" value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value })} /></Field>
    </Sheet>
  );
}
