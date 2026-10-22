"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBiz } from "@/components/biz2/BizContext";
import { useBizData, toggleDone } from "@/components/biz2/useBizData";
import { TaskRow } from "@/components/biz2/TaskRow";
import { MeetingSheet, TaskSheet } from "@/components/biz2/sheets";
import { Recorder } from "@/components/biz2/Recorder";
import { Materials } from "@/components/biz2/Materials";
import { Characterization } from "@/components/biz2/Characterization";
import { Icon, SaveState, Skeleton, useAutosave, useToast } from "@/components/ui";
import { fmtTime, isOpenTask, pct, projectProgress, relDay, type Meeting, type Task } from "@/lib/domain";

const STEPS = [
  { key: "notes_current", n: 1, title: "המצב הקיים", hint: "איפה העסק עומד היום. מבט על הפרויקטים." },
  { key: "notes_last_week", n: 2, title: "השבוע שחלף", hint: "מה היה השבוע, ומה מהמשימות בוצע." },
  { key: "notes_progress", n: 3, title: "מה התקדם", hint: "הצלחות, גם קטנות." },
  { key: "notes_problems", n: 4, title: "בעיות ותקיעות", hint: "מה עצר, ומה צריך כדי לשחרר." },
  { key: "notes_goals", n: 5, title: "יעדים לשבוע הבא", hint: "המשימות שנכנסות לשבוע הבא." },
] as const;
type Notes = Record<(typeof STEPS)[number]["key"], string>;

export default function MeetingRoom() {
  const { mid } = useParams<{ mid: string }>();
  const { biz, isConsultant } = useBiz();
  const { data, reload, setData } = useBizData(biz.id);
  const toast = useToast();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [priv, setPriv] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [scheduleNext, setScheduleNext] = useState(false);
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });

  async function loadMeeting() {
    const { data: m } = await supabase().from("meetings").select("*").eq("id", mid).maybeSingle();
    if (!m) return;
    setMeeting(m as Meeting);
    setNotes((n) => n ?? Object.fromEntries(STEPS.map((s) => [s.key, (m as Record<string, string | null>)[s.key] ?? ""])) as Notes);
  }
  useEffect(() => {
    loadMeeting();
    supabase().from("meeting_private_notes").select("notes").eq("meeting_id", mid).maybeSingle().then(({ data }) => setPriv(data?.notes ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  const notesState = useAutosave(notes, async (v) => {
    if (!v) return true;
    const { error } = await supabase().from("meetings").update(v).eq("id", mid);
    return !error;
  });
  const privState = useAutosave(priv, async (v) => {
    if (v == null) return true;
    const { error } = await supabase().from("meeting_private_notes").upsert({ meeting_id: mid, business_id: biz.id, notes: v, updated_at: new Date().toISOString() });
    return !error;
  });

  if (!meeting || !notes || !data) return <Skeleton h={120} />;
  const weekly = data.tasks.filter((t) => t.is_weekly_commitment && t.status !== "canceled");
  const nextMeeting = data.meetings.find((m) => m.scheduled_at > meeting.scheduled_at && m.id !== meeting.id);
  // the first meeting of a business opens with the initial characterization
  const isFirst = data.meetings[0]?.id === meeting.id;

  async function complete() {
    const at = meeting!.completed_at ? null : new Date().toISOString();
    await supabase().from("meetings").update({ completed_at: at }).eq("id", meeting!.id);
    await loadMeeting();
    if (at && !nextMeeting) setScheduleNext(true);
    if (at) toast("הפגישה סומנה כמתועדת");
  }

  function summaryText() {
    const lines = [`*סיכום פגישה – ${biz.name}*`, new Date(meeting!.scheduled_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }), ""];
    if (notes!.notes_progress.trim()) lines.push("*מה התקדם*", notes!.notes_progress.trim(), "");
    if (notes!.notes_problems.trim()) lines.push("*על מה עובדים*", notes!.notes_problems.trim(), "");
    const open = weekly.filter(isOpenTask);
    if (open.length) lines.push("*המשימות לשבוע הקרוב*", ...open.map((t, i) => `${i + 1}. ${t.title}${t.due_on ? ` (עד ${new Date(t.due_on).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })})` : ""}`), "");
    if (notes!.notes_goals.trim()) lines.push(notes!.notes_goals.trim(), "");
    if (nextMeeting) lines.push(`*הפגישה הבאה:* ${new Date(nextMeeting.scheduled_at).toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "numeric" })} ב-${fmtTime(nextMeeting.scheduled_at)}`);
    return lines.join("\n").trim();
  }
  async function copySummary() {
    const text = summaryText();
    try { await navigator.clipboard.writeText(text); toast("הסיכום הועתק. אפשר להדביק בוואטסאפ"); }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className={`chip ${meeting.completed_at ? "chip-done" : "chip-accent"}`}>{meeting.completed_at ? "תועדה" : new Date(meeting.scheduled_at) > new Date() ? "מתוכננת" : "בתיעוד"}</span>
            <SaveState state={notesState} />
          </div>
          <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight leading-tight mt-2">{relDay(meeting.scheduled_at)} · {fmtTime(meeting.scheduled_at)}</h1>
          <div className="caption mt-1">{[meeting.title, meeting.location, `${meeting.duration_minutes} דק׳`].filter(Boolean).join(" · ")}</div>
        </div>
        <button className="btn-tint shrink-0" onClick={() => setEdit(true)}><Icon name="edit" size={18} /> עריכה</button>
      </div>

      <Recorder businessId={biz.id} meetingId={meeting.id} />

      {/* jump between the fixed steps */}
      <nav aria-label="שלבי הפגישה" className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 md:mx-0 md:px-0 py-2 chrome md:bg-transparent md:backdrop-blur-none overflow-x-auto">
        <div className="flex gap-1.5">
          {isFirst && <a href="#characterization" className="shrink-0 h-9 px-3 rounded-full flex items-center gap-1.5 text-sm font-semibold bg-[var(--accent)] text-[var(--accent-ink)]">אפיון ראשוני</a>}
          {STEPS.map((s) => (
            <a key={s.key} href={`#${s.key}`} className={`shrink-0 h-9 px-3 rounded-full flex items-center gap-1.5 text-sm font-semibold ${notes[s.key].trim() ? "bg-[var(--done-soft)] text-[var(--done)]" : "bg-[var(--surface)] shadow-sm"}`}>
              <span className="num">{s.n}</span> {s.title}
            </a>
          ))}
        </div>
      </nav>

      {isFirst && (
        <section id="characterization" className="card p-4 space-y-3 scroll-mt-28 border-2 border-[var(--accent)]">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] shrink-0"><Icon name="note" size={18} /></span>
            <div><h2 className="font-bold text-lg leading-tight">אפיון ראשוני</h2><div className="caption">פגישה ראשונה: מכירים את העסק לעומק. התשובות נשמרות גם בפרופיל העסק.</div></div>
          </div>
          <Characterization businessId={biz.id} canEdit={isConsultant} compact />
        </section>
      )}

      {STEPS.map((s) => (
        <section key={s.key} id={s.key} className="card p-4 space-y-3 scroll-mt-28">
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] font-bold num shrink-0">{s.n}</span>
            <div><h2 className="font-bold text-lg leading-tight">{s.title}</h2><div className="caption">{s.hint}</div></div>
          </div>

          {s.key === "notes_current" && data.projects.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.projects.map((p) => {
                const prog = projectProgress(p, data.milestones, data.tasks);
                return (
                  <div key={p.id} className="rounded-xl bg-[var(--surface-2)] px-3 py-2">
                    <div className="flex justify-between gap-2 text-sm"><span className="font-semibold truncate">{p.title}</span><span className="num font-bold">{pct(prog)}</span></div>
                    <div className="bar mt-1.5"><span style={{ width: `${(prog ?? 0) * 100}%` }} /></div>
                  </div>
                );
              })}
            </div>
          )}

          {s.key === "notes_last_week" && (
            weekly.length ? <div className="list-group !shadow-none border border-[var(--line)]">{weekly.map((t) => <TaskRow key={t.id} t={t} projects={data.projects} showWeekly={false} onToggle={() => toggleDone(t, setData)} onOpen={() => setTaskSheet({ open: true, task: t })} />)}</div>
              : <div className="caption">לא היו משימות לשבוע.</div>
          )}

          <textarea className="input" aria-label={s.title} value={notes[s.key]} placeholder="רשימות…"
            onChange={(e) => setNotes({ ...notes, [s.key]: e.target.value })} />

          {s.key === "notes_goals" && (
            <div className="space-y-2">
              <button className="btn-tint" onClick={() => setTaskSheet({ open: true, task: null })}><Icon name="plus" size={18} /> משימה לשבוע הבא</button>
              {weekly.filter(isOpenTask).length > 0 && <div className="caption">{weekly.filter(isOpenTask).length} משימות פתוחות לשבוע</div>}
            </div>
          )}
        </section>
      ))}

      {!isFirst && (
        <details className="card p-4">
          <summary className="font-bold cursor-pointer flex items-center gap-2 list-none"><Icon name="note" size={20} className="text-[var(--accent)]" /> האפיון הראשוני <span className="caption font-normal">(לעיון ועדכון)</span></summary>
          <div className="pt-3"><Characterization businessId={biz.id} canEdit={isConsultant} compact /></div>
        </details>
      )}

      <section className="space-y-2">
        <h2 className="section-title">חומרים לפגישה</h2>
        <Materials businessId={biz.id} meetingId={meeting.id} />
      </section>

      {priv != null && (
        <section className="rounded-[var(--radius)] p-4 space-y-2 bg-[var(--mark-soft)]">
          <div className="flex justify-between gap-2"><h2 className="font-bold text-[var(--mark)]">🔒 הערות פרטיות</h2><SaveState state={privState} /></div>
          <div className="caption">רק אתה רואה אותן. לא נכנסות לסיכום.</div>
          <textarea className="input !bg-[var(--surface)]" value={priv} onChange={(e) => setPriv(e.target.value)} aria-label="הערות פרטיות" />
        </section>
      )}

      <div className="card p-4 space-y-3">
        <div className="font-bold">סיום הפגישה</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn" onClick={copySummary}><Icon name="copy" size={18} /> העתקת סיכום לוואטסאפ</button>
          <button className={meeting.completed_at ? "btn-tint" : "btn-tint"} onClick={complete}>
            <Icon name="check" size={18} /> {meeting.completed_at ? "ביטול סימון 'תועדה'" : "סימון הפגישה כמתועדת"}
          </button>
        </div>
        <div className="caption">{nextMeeting ? `הפגישה הבאה: ${relDay(nextMeeting.scheduled_at)} ב-${fmtTime(nextMeeting.scheduled_at)}` : <button className="btn-plain !p-0 text-sm" onClick={() => setScheduleNext(true)}>עוד לא נקבעה פגישה הבאה · לקביעה</button>}</div>
      </div>

      <MeetingSheet open={edit} onClose={() => setEdit(false)} businessId={biz.id} meeting={meeting} onSaved={() => { loadMeeting(); reload(); }} />
      <MeetingSheet open={scheduleNext} onClose={() => setScheduleNext(false)} businessId={biz.id} onSaved={reload} />
      <TaskSheet open={taskSheet.open} onClose={() => setTaskSheet({ open: false })} businessId={biz.id} task={taskSheet.task}
        preset={{ is_weekly_commitment: true }} projects={data.projects} onSaved={reload} />
    </div>
  );
}
