"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutosave } from "@/components/useAutosave";
import { SaveBadge, Loading } from "@/components/Shell";
import { TASK_STATUS, isOpenTask, priorityLevel, todayISO, type Finding, type Task } from "@/lib/domain";

type Meeting = {
  id: string; scheduled_at: string; agenda: string | null; shared_summary: string | null; decisions: string | null;
  follow_up_questions: string | null; next_meeting_at: string | null; status: string;
};
type Brief = { weekly: Task[]; overdue: Task[]; p1: Finding[]; doneSinceLast: number };

const fmt = (iso: string) => new Date(iso).toLocaleString("he-IL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function Meetings({ businessId, isConsultant }: { businessId: string; isConsultant: boolean }) {
  const [list, setList] = useState<Meeting[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [brief, setBrief] = useState<Brief | null>(null);

  async function load() {
    const { data } = await supabase().from("meetings").select("*").eq("business_id", businessId).order("scheduled_at", { ascending: false });
    const rows = (data as Meeting[]) ?? [];
    setList(rows);
    if (isConsultant) loadBrief(rows[0]?.scheduled_at ?? null);
  }

  // What the consultant needs on screen before and during the meeting.
  async function loadBrief(lastMeetingAt: string | null) {
    const sb = supabase();
    const [{ data: t }, { data: f }] = await Promise.all([
      sb.from("tasks").select("*").eq("business_id", businessId),
      sb.from("findings").select("*").eq("business_id", businessId).in("status", ["open", "in_progress"]),
    ]);
    const tasks = (t as Task[]) ?? [];
    const open = tasks.filter(isOpenTask);
    setBrief({
      weekly: tasks.filter((x) => x.is_weekly_commitment && (isOpenTask(x) || (x.completed_at && (!lastMeetingAt || x.completed_at > lastMeetingAt)))),
      overdue: open.filter((x) => x.due_on && x.due_on < todayISO()),
      p1: ((f as Finding[]) ?? []).filter((x) => priorityLevel(x) === 1),
      doneSinceLast: tasks.filter((x) => x.completed_at && (!lastMeetingAt || x.completed_at > lastMeetingAt)).length,
    });
  }
  useEffect(() => { load(); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    const b = brief;
    const agenda = [
      `1. מה זז מאז הפעם הקודמת${b ? ` (${b.doneSinceLast} משימות הושלמו)` : ""}`,
      `2. התחייבויות השבוע — מה בוצע, מה נתקע${b?.overdue.length ? ` (${b.overdue.length} באיחור)` : ""}`,
      `3. ממצאים בעדיפות עליונה${b?.p1.length ? ` (${b.p1.length})` : ""}`,
      "4. החלטות ו-1–3 התחייבויות לשבוע הבא",
    ].join("\n");
    const { data, error } = await supabase().from("meetings").insert({ business_id: businessId, agenda }).select("id").single();
    if (!error && data) {
      await supabase().from("meeting_private_notes").insert({ meeting_id: data.id, business_id: businessId });
      setOpen(data.id);
      load();
    }
  }

  if (!list) return <Loading />;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-bold">פגישות</h2><p className="text-sm muted mt-1">כל פגישה נסגרת בסיכום, החלטות, התחייבויות ומועד המשך. בעלת העסק רואה רק מה ששותף.</p></div>
        {isConsultant && <button className="btn" onClick={create}>+ פגישה חדשה</button>}
      </div>
      {list.length === 0 && (
        <div className="empty">{isConsultant ? "אין פגישות עדיין. פגישה חדשה נפתחת עם סדר יום שנבנה מהמשימות והממצאים הפתוחים." : "עדיין לא שותף סיכום פגישה."}</div>
      )}
      {list.map((m) => {
        const isOpen = open === m.id;
        return (
          <div key={m.id} className={`card ${isOpen ? "border-[var(--accent)]" : ""}`}>
            <button className="w-full flex flex-wrap gap-2 justify-between items-center text-start" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.id)}>
              <span className="font-display font-bold text-xl">{fmt(m.scheduled_at)}</span>
              <span className="flex items-center gap-2">
                {m.next_meeting_at && <span className="text-xs muted">הבאה: {fmt(m.next_meeting_at)}</span>}
                <span className={`chip ${m.status === "published" ? "" : "chip-plain"}`}>{m.status === "published" ? "שותף" : "טיוטה"}</span>
              </span>
            </button>
            {isOpen && (isConsultant
              ? <MeetingEditor meeting={m} businessId={businessId} brief={brief} onChange={load} />
              : <MeetingView meeting={m} />)}
          </div>
        );
      })}
    </div>
  );
}

function MeetingView({ meeting: m }: { meeting: Meeting }) {
  const block = (title: string, body: string | null) => body ? (
    <div><div className="eyebrow mb-1">{title}</div><p className="whitespace-pre-wrap">{body}</p></div>
  ) : null;
  return (
    <div className="mt-4 space-y-4">
      {block("סיכום", m.shared_summary)}
      {block("החלטות", m.decisions)}
      {block("מה צריך לברר", m.follow_up_questions)}
      {m.next_meeting_at && <div className="panel"><span className="eyebrow">הפגישה הבאה · </span><b>{fmt(m.next_meeting_at)}</b></div>}
    </div>
  );
}

function MeetingEditor({ meeting, businessId, brief, onChange }: { meeting: Meeting; businessId: string; brief: Brief | null; onChange: () => void }) {
  const [m, setM] = useState({
    agenda: meeting.agenda ?? "", shared_summary: meeting.shared_summary ?? "", decisions: meeting.decisions ?? "",
    follow_up_questions: meeting.follow_up_questions ?? "", next_meeting_at: meeting.next_meeting_at ? toLocalInput(meeting.next_meeting_at) : "",
  });
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    supabase().from("meeting_private_notes").select("notes").eq("meeting_id", meeting.id).maybeSingle()
      .then(({ data }) => setNotes(data?.notes ?? ""));
  }, [meeting.id]);

  const state = useAutosave(m, async (v) => {
    const { error } = await supabase().from("meetings").update({
      ...v, next_meeting_at: v.next_meeting_at ? new Date(v.next_meeting_at).toISOString() : null,
    }).eq("id", meeting.id);
    return !error;
  });

  async function togglePublish() {
    await supabase().from("meetings").update({ status: meeting.status === "published" ? "draft" : "published" }).eq("id", meeting.id);
    onChange();
  }

  const openWeekly = brief?.weekly.filter(isOpenTask).length ?? 0;
  const checklist = [
    { ok: !!m.shared_summary.trim(), label: "סיכום משותף" },
    { ok: !!m.decisions.trim(), label: "החלטות" },
    { ok: openWeekly > 0, label: "1–3 התחייבויות לשבוע" },
    { ok: !!m.next_meeting_at, label: "מועד הפגישה הבאה" },
  ];
  const ready = checklist.every((c) => c.ok);

  const field = (key: keyof typeof m, label: string, hint?: string) => (
    <div>
      <label className="label" htmlFor={`${key}-${meeting.id}`}>{label}</label>
      <textarea id={`${key}-${meeting.id}`} className="input" rows={3} placeholder={hint} value={m[key]} onChange={(e) => setM({ ...m, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="space-y-4 min-w-0">
        <div className="flex justify-between items-center"><span className="eyebrow">במהלך הפגישה</span><SaveBadge state={state} /></div>
        {field("agenda", "סדר יום")}
        {field("shared_summary", "סיכום משותף — מה שבעלת העסק תראה", "מה עלה, מה למדנו, מה משתנה")}
        {field("decisions", "החלטות", "החלטה אחת בשורה")}
        {field("follow_up_questions", "מה צריך לברר עד הפעם הבאה")}
        <div>
          <label className="label" htmlFor={`next-${meeting.id}`}>מועד הפגישה הבאה</label>
          <input id={`next-${meeting.id}`} type="datetime-local" className="input !w-auto" value={m.next_meeting_at} onChange={(e) => setM({ ...m, next_meeting_at: e.target.value })} />
        </div>
        {notes !== null && <PrivateNotes meetingId={meeting.id} businessId={businessId} initial={notes} />}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        {brief && (
          <div className="panel space-y-3">
            <div className="eyebrow">תדריך</div>
            <BriefList title="התחייבויות השבוע" empty="לא נקבעו" items={brief.weekly.map((t) => ({ id: t.id, text: t.title, tag: TASK_STATUS[t.status], tone: t.status === "done" ? "ok" : t.status === "blocked" ? "bad" : undefined }))} />
            <BriefList title="באיחור" empty="אין" items={brief.overdue.map((t) => ({ id: t.id, text: t.title, tone: "bad" as const }))} />
            <BriefList title="ממצאי P1 פתוחים" empty="אין" items={brief.p1.map((f) => ({ id: f.id, text: f.title }))} />
            <div className="text-sm"><span className="num font-bold">{brief.doneSinceLast}</span> <span className="muted">משימות הושלמו מאז הפגישה הקודמת</span></div>
          </div>
        )}
        <div className="card !p-4 space-y-2">
          <div className="eyebrow">לפני סגירה</div>
          <ul className="space-y-1.5 text-sm">
            {checklist.map((c) => (
              <li key={c.label} className={`flex items-center gap-2 ${c.ok ? "" : "muted"}`}>
                <span aria-hidden className={`grid place-items-center w-5 h-5 rounded-full text-xs ${c.ok ? "bg-[var(--ok)] text-[var(--surface)]" : "border border-[var(--line)]"}`}>{c.ok ? "✓" : ""}</span>
                {c.label}
              </li>
            ))}
          </ul>
          <button className={meeting.status === "published" ? "btn-ghost w-full" : "btn w-full"} onClick={togglePublish}>
            {meeting.status === "published" ? "ביטול שיתוף" : ready ? "שיתוף הסיכום עם בעלת העסק" : "שיתוף בכל זאת"}
          </button>
          {meeting.status !== "published" && <p className="text-xs muted">ההערות הפרטיות לא משותפות לעולם.</p>}
        </div>
      </aside>
    </div>
  );
}

function BriefList({ title, items, empty }: { title: string; empty: string; items: { id: string; text: string; tag?: string; tone?: "bad" | "ok" }[] }) {
  return (
    <div>
      <div className="text-sm font-bold mb-1">{title} <span className="num muted font-normal">{items.length || ""}</span></div>
      {items.length === 0 ? <div className="text-sm muted">{empty}</div> : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.id} className="text-sm flex justify-between gap-2">
              <span className={`min-w-0 ${i.tone === "bad" ? "text-[var(--bad)]" : ""}`}>{i.text}</span>
              {i.tag && <span className={`shrink-0 text-xs ${i.tone === "ok" ? "text-[var(--ok)]" : i.tone === "bad" ? "text-[var(--bad)]" : "muted"}`}>{i.tag}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// datetime-local wants local wall time, not UTC
function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function PrivateNotes({ meetingId, businessId, initial }: { meetingId: string; businessId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const state = useAutosave(notes, async (v) => {
    const { error } = await supabase().from("meeting_private_notes")
      .upsert({ meeting_id: meetingId, business_id: businessId, notes: v, updated_at: new Date().toISOString() });
    return !error;
  });
  return (
    <div className="rounded-xl p-3 border border-dashed border-[var(--mark)] bg-[var(--mark-soft)]">
      <div className="flex justify-between gap-2">
        <label className="label !text-[var(--mark)]" htmlFor={`pn-${meetingId}`}>🔒 הערות פרטיות — לעולם לא מוצגות לבעלת העסק</label>
        <SaveBadge state={state} />
      </div>
      <textarea id={`pn-${meetingId}`} className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </div>
  );
}
