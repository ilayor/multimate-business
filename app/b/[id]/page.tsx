"use client";
import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBiz } from "@/components/biz2/BizContext";
import { useBizData, toggleDone } from "@/components/biz2/useBizData";
import { TaskRow } from "@/components/biz2/TaskRow";
import { TaskSheet, MeetingSheet } from "@/components/biz2/sheets";
import { DeptChip, Empty, Icon, PageHeader, Sheet, Check, Skeleton, useToast } from "@/components/ui";
import { deptVar, fmtTime, isOpenTask, nextTaskOf, pct, projectProgress, relDay, type Task } from "@/lib/domain";

export default function Snapshot() {
  const { biz } = useBiz();
  const { data, reload, setData } = useBizData(biz.id);
  const toast = useToast();
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [picker, setPicker] = useState(false);
  const [meetingSheet, setMeetingSheet] = useState(false);
  const [reorder, setReorder] = useState(false);

  if (!data) return <Skeleton h={90} />;
  const weekly = data.tasks.filter((t) => t.is_weekly_commitment && t.status !== "canceled");
  const done = weekly.filter((t) => t.status === "done").length;
  const upcoming = data.meetings.filter((m) => m.scheduled_at > new Date().toISOString()).slice(0, 3);
  const projects = data.projects;

  async function startNewWeek() {
    const ids = weekly.filter((t) => t.status === "done").map((t) => t.id);
    if (!ids.length) return;
    await supabase().from("tasks").update({ is_weekly_commitment: false }).in("id", ids);
    reload();
    toast(`${ids.length} משימות שבוצעו הורדו מהשבוע`, async () => { await supabase().from("tasks").update({ is_weekly_commitment: true }).in("id", ids); reload(); });
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= projects.length) return;
    const list = [...projects];
    [list[i], list[j]] = [list[j], list[i]];
    setData((d) => d && { ...d, projects: list.map((p, k) => ({ ...p, position: k })) });
    await Promise.all(list.map((p, k) => supabase().from("projects").update({ position: k }).eq("id", p.id)));
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })} title="תמונת מצב"
        subtitle={`${weekly.length ? `${done}/${weekly.length} משימות שבוע בוצעו` : "עוד לא נבחרו משימות לשבוע"} · ${projects.length} פרויקטים פעילים`} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* right: this week + meetings */}
        <div className="space-y-6 min-w-0">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {weekly.length > 0 && <div className="ring" style={{ ["--p" as string]: Math.round((done / weekly.length) * 100) }}><span>{done}/{weekly.length}</span></div>}
                <div>
                  <h2 className="section-title">משימות לשבוע</h2>
                  <div className="caption num">{weekly.length ? (done === weekly.length ? "הכול בוצע. כל הכבוד!" : `נשארו ${weekly.length - done}`) : "עוד לא נבחרו"}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="btn-plain text-sm" onClick={() => setPicker(true)}>מהרשימה</button>
                <button className="btn-tint" onClick={() => setTaskSheet({ open: true, task: null })}><Icon name="plus" size={18} /> משימה</button>
              </div>
            </div>
            {weekly.length === 0 ? (
              <Empty icon="star" title="אין עדיין משימות לשבוע">הוסיפו משימה חדשה, או בחרו משימות קיימות "מהרשימה".</Empty>
            ) : (
              <div className="list-group">
                {weekly.map((t) => <TaskRow key={t.id} t={t} projects={projects} showWeekly={false}
                  onToggle={() => toggleDone(t, setData)} onOpen={() => setTaskSheet({ open: true, task: t })} />)}
              </div>
            )}
            {done > 0 && <button className="btn-plain text-sm" onClick={startNewWeek}>שבוע חדש: להוריד את מה שבוצע</button>}
          </section>

          <section className="space-y-3">
            <h2 className="section-title">פגישות קרובות</h2>
            {upcoming.length === 0 ? (
              <div className="card p-4 flex items-center justify-between gap-3">
                <span className="muted">אין פגישה קרובה</span>
                <button className="btn" onClick={() => setMeetingSheet(true)}><Icon name="calendar" size={18} /> לקביעת פגישה</button>
              </div>
            ) : (
              <div className="list-group">
                {upcoming.map((m) => (
                  <Link key={m.id} href={`/b/${biz.id}/meetings/${m.id}`} className="row row-btn">
                    <span className="grid place-items-center w-11 h-11 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name="calendar" size={20} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold">{relDay(m.scheduled_at)} · {fmtTime(m.scheduled_at)}</span>
                      <span className="block caption truncate">{[m.title, m.location].filter(Boolean).join(" · ")}</span>
                    </span>
                    <Icon name="forward" size={18} className="text-[var(--muted)]" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* left: project status */}
        <section className="space-y-3 min-w-0">
          <div className="flex items-end justify-between">
            <h2 className="section-title">סטטוס פרויקטים</h2>
            {projects.length > 1 && <button className="btn-plain text-sm" onClick={() => setReorder(!reorder)}>{reorder ? "סיום" : "סידור"}</button>}
          </div>
          {projects.length === 0 ? (
            <Empty icon="target" title="אין פרויקטים עדיין"><Link className="btn-plain inline-flex" href={`/b/${biz.id}/projects`}>להגדרת פרויקט ראשון</Link></Empty>
          ) : (
            <div className="space-y-2">
              {projects.map((p, i) => {
                const prog = projectProgress(p, data.milestones, data.tasks);
                const next = nextTaskOf(p.id, data.tasks);
                return (
                  <div key={p.id} className="card flex items-stretch overflow-hidden dept-stripe" style={{ ["--c" as string]: deptVar(p.department_code) }}>
                    {reorder && (
                      <div className="flex flex-col justify-center border-e border-[var(--line)]">
                        <button className="icon-btn" aria-label="הזזה למעלה" disabled={i === 0} onClick={() => move(i, -1)}><Icon name="up" size={20} /></button>
                        <button className="icon-btn" aria-label="הזזה למטה" disabled={i === projects.length - 1} onClick={() => move(i, 1)}><Icon name="down" size={20} /></button>
                      </div>
                    )}
                    <Link href={`/b/${biz.id}/projects/${p.id}`} className="flex-1 min-w-0 p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1"><DeptChip code={p.department_code} /><div className="font-bold leading-snug">{p.title}</div></div>
                        <div className="text-end shrink-0">
                          <div className={`num text-xl font-extrabold leading-none ${prog === 1 ? "text-[var(--done)]" : ""}`}>{pct(prog)}</div>
                          {(p.goal || p.target != null) && <div className="caption max-w-[140px] truncate">{p.target != null ? `יעד: ${p.target}${p.unit ? " " + p.unit : ""}` : p.goal}</div>}
                        </div>
                      </div>
                      <div className={`bar ${prog === 1 ? "done" : ""}`}><span style={{ width: `${(prog ?? 0) * 100}%` }} /></div>
                      <div className="text-sm"><span className="muted">המשימה הבאה: </span>{next ? <span className="font-semibold">{next.title}</span> : <span className="muted">אין משימה פתוחה</span>}</div>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <TaskSheet open={taskSheet.open} onClose={() => setTaskSheet({ open: false })} businessId={biz.id} task={taskSheet.task}
        preset={{ is_weekly_commitment: true }} projects={projects} onSaved={reload} />
      <MeetingSheet open={meetingSheet} onClose={() => setMeetingSheet(false)} businessId={biz.id} onSaved={reload} />
      <WeekPicker open={picker} onClose={() => setPicker(false)} tasks={data.tasks.filter((t) => isOpenTask(t) && !t.is_weekly_commitment)} onDone={reload} />
    </div>
  );
}

function WeekPicker({ open, onClose, tasks, onDone }: { open: boolean; onClose: () => void; tasks: Task[]; onDone: () => void }) {
  const [sel, setSel] = useState<string[]>([]);
  async function add() {
    if (sel.length) await supabase().from("tasks").update({ is_weekly_commitment: true }).in("id", sel);
    setSel([]); onDone(); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="הוספה לשבוע"
      footer={<button className="btn w-full" disabled={!sel.length} onClick={add}>הוספת {sel.length || ""} משימות לשבוע</button>}>
      {tasks.length === 0 ? <div className="empty text-sm">אין משימות פתוחות שאינן בשבוע.</div> : (
        <div className="list-group">
          {tasks.map((t) => {
            const on = sel.includes(t.id);
            const toggle = () => setSel(on ? sel.filter((x) => x !== t.id) : [...sel, t.id]);
            return (
              <div key={t.id} className="row cursor-pointer" onClick={toggle}>
                <Check done={on} onToggle={toggle} label={t.title} />
                <span className="flex-1 font-semibold">{t.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
