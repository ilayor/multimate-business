"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loading } from "@/components/Shell";
import { deptName, isOpenTask, priorityLevel, priorityScore, todayISO, type Finding, type Task } from "@/lib/domain";

type Go = (tab: "diagnostics" | "findings" | "tasks" | "meetings" | "profile") => void;
type Data = {
  diag: { id: string; state: string } | null;
  answered: number;
  unknown: number;
  total: number;
  findings: Finding[];
  tasks: Task[];
  nextMeeting: string | null;
  meetings: number;
};

export function Snapshot({ businessId, isConsultant, go }: { businessId: string; isConsultant: boolean; go: Go }) {
  const [d, setD] = useState<Data | null>(null);

  useEffect(() => {
    (async () => {
      const sb = supabase();
      const [{ data: diags }, { data: findings }, { data: tasks }, { data: meetings }] = await Promise.all([
        sb.from("diagnostics").select("id,state").eq("business_id", businessId).order("started_at", { ascending: false }).limit(1),
        isConsultant ? sb.from("findings").select("*").eq("business_id", businessId) : Promise.resolve({ data: [] }),
        sb.from("tasks").select("*").eq("business_id", businessId),
        sb.from("meetings").select("scheduled_at,next_meeting_at").eq("business_id", businessId).order("scheduled_at", { ascending: false }),
      ]);
      const diag = diags?.[0] ?? null;
      let answered = 0, unknown = 0, total = 0;
      if (diag) {
        const { data: ans } = await sb.from("diagnostic_answers").select("answer_text,is_unknown").eq("diagnostic_id", diag.id);
        total = ans?.length ?? 0;
        answered = (ans ?? []).filter((a: { answer_text: string | null }) => (a.answer_text ?? "").trim()).length;
        unknown = (ans ?? []).filter((a: { is_unknown: boolean }) => a.is_unknown).length;
      }
      const upcoming = (meetings ?? []).map((m: { next_meeting_at: string | null }) => m.next_meeting_at)
        .filter((x: string | null): x is string => !!x && x > new Date().toISOString()).sort()[0] ?? null;
      setD({ diag, answered, unknown, total, findings: (findings as Finding[]) ?? [], tasks: (tasks as Task[]) ?? [],
        nextMeeting: upcoming, meetings: meetings?.length ?? 0 });
    })();
  }, [businessId, isConsultant]);

  if (!d) return <Loading />;

  const openFindings = d.findings.filter((f) => f.status === "open" || f.status === "in_progress");
  const p1 = openFindings.filter((f) => priorityLevel(f) === 1);
  const openTasks = d.tasks.filter(isOpenTask);
  const weekly = openTasks.filter((t) => t.is_weekly_commitment);
  const overdue = openTasks.filter((t) => t.due_on && t.due_on < todayISO());
  const done = d.tasks.filter((t) => t.status === "done").length;
  const pct = d.total ? Math.round(((d.answered + d.unknown) / d.total) * 100) : 0;

  // The coaching cycle, in order: the first unmet step is the next thing to do.
  const step = !d.diag
    ? { title: "להתחיל את האבחון הראשוני", body: "30 שאלות ב-6 מחלקות. אפשר לעצור ולהמשיך בכל רגע — הכול נשמר.", cta: "לאבחון", tab: "diagnostics" as const }
    : d.diag.state !== "completed" && pct < 100
    ? { title: `להמשיך את האבחון (${d.answered + d.unknown}/${d.total})`, body: "סמנו \"לא ידוע\" כשאין תשובה — זה ממצא בפני עצמו.", cta: "המשך אבחון", href: `/b/${businessId}/d/${d.diag.id}` }
    : isConsultant && d.findings.length === 0
    ? { title: "לנסח ממצאים מהתשובות", body: "ממצא הוא הפרשנות שלך לתשובה. התחילו ב-3–5 החשובים.", cta: "לממצאים", tab: "findings" as const }
    : isConsultant && openTasks.length === 0
    ? { title: "להפוך ממצאים למשימות", body: "לכל משימה: אחראית, תאריך יעד והגדרה מתי היא \"בוצעה\".", cta: "לממצאים", tab: "findings" as const }
    : weekly.length === 0
    ? { title: "לבחור עד 3 התחייבויות לשבוע", body: "שלוש זה המקסימום. פחות זה בסדר גמור.", cta: "למשימות", tab: "tasks" as const }
    : !d.nextMeeting
    ? { title: "לקבוע את הפגישה הבאה", body: "סגרו את הפגישה עם סיכום, החלטות ומועד המשך.", cta: "לפגישות", tab: "meetings" as const }
    : { title: "השבוע בתנועה", body: "יש התחייבויות ופגישה הבאה קבועה. עדכנו סטטוס כשמשהו זז.", cta: "למשימות", tab: "tasks" as const };

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-4 border-[var(--accent)] bg-[var(--accent-soft)]">
        <div className="min-w-0">
          <div className="eyebrow">הצעד הבא</div>
          <h2 className="text-2xl font-bold mt-1">{step.title}</h2>
          <p className="muted mt-1">{step.body}</p>
        </div>
        {"href" in step && step.href
          ? <Link className="btn" href={step.href}>{step.cta}</Link>
          : <button className="btn" onClick={() => go(step.tab!)}>{step.cta}</button>}
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="אבחון" value={d.diag ? `${pct}%` : "—"} sub={d.diag ? `${d.unknown} סומנו "לא ידוע"` : "עוד לא התחיל"}>
          {d.diag && <div className="bar mt-2"><span style={{ width: `${pct}%` }} /></div>}
        </Stat>
        {isConsultant && <Stat label="ממצאים פתוחים" value={String(openFindings.length)} sub={p1.length ? `${p1.length} בעדיפות P1` : "אין P1"} tone={p1.length ? "bad" : undefined} />}
        <Stat label="התחייבויות השבוע" value={`${weekly.length}/3`} sub={`${done} משימות הושלמו`} tone="mark" />
        <Stat label="באיחור" value={String(overdue.length)} sub={overdue.length ? "משימות שעבר מועדן" : "הכול בזמן"} tone={overdue.length ? "bad" : undefined} />
        {!isConsultant && <Stat label="הפגישה הבאה" value={d.nextMeeting ? new Date(d.nextMeeting).toLocaleDateString("he-IL", { day: "numeric", month: "short" }) : "—"} sub={d.nextMeeting ? new Date(d.nextMeeting).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) : "טרם נקבעה"} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-baseline justify-between"><h3 className="text-lg font-bold">השבוע</h3><button className="link text-sm" onClick={() => go("tasks")}>כל המשימות</button></div>
          {[0, 1, 2].map((i) => {
            const t = weekly[i];
            return t ? (
              <div key={t.id} className="item flex items-center gap-3" style={{ borderInlineStartColor: "var(--mark)", borderInlineStartWidth: 4 }}>
                <span className="num font-bold text-[var(--mark)]">{i + 1}</span>
                <div className="min-w-0 flex-1"><div className="font-semibold truncate">{t.title}</div>
                  <div className="text-xs muted">{t.due_on ? `עד ${new Date(t.due_on).toLocaleDateString("he-IL")}` : "ללא תאריך"}</div></div>
              </div>
            ) : (
              <div key={i} className="rounded-xl border border-dashed border-[var(--line)] px-4 py-3 text-sm muted flex gap-3"><span className="num">{i + 1}</span> משבצת פנויה</div>
            );
          })}
        </div>
        {isConsultant && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between"><h3 className="text-lg font-bold">ממצאים בראש סדר העדיפויות</h3><button className="link text-sm" onClick={() => go("findings")}>כל הממצאים</button></div>
            {openFindings.length === 0 && <div className="empty text-sm">אין עדיין ממצאים פתוחים.</div>}
            {[...openFindings].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 3).map((f) => (
              <div key={f.id} className="item" data-p={priorityLevel(f)}>
                <div className="flex items-center gap-2 mb-1"><span className="chip chip-plain">P{priorityLevel(f)}</span><span className="text-xs muted">{deptName(f.department_code)}</span></div>
                <div className="font-semibold">{f.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone, children }: { label: string; value: string; sub: string; tone?: "bad" | "mark"; children?: React.ReactNode }) {
  const color = tone === "bad" ? "text-[var(--bad)]" : tone === "mark" ? "text-[var(--mark)]" : "";
  return (
    <div className="card !p-4">
      <div className="eyebrow">{label}</div>
      <div className={`num text-3xl font-extrabold mt-1 ${color}`}>{value}</div>
      <div className="text-xs muted mt-0.5">{sub}</div>
      {children}
    </div>
  );
}
