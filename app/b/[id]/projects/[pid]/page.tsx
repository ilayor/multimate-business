"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBiz } from "@/components/biz2/BizContext";
import { useBizData, toggleDone } from "@/components/biz2/useBizData";
import { TaskRow } from "@/components/biz2/TaskRow";
import { ProjectSheet, TaskSheet } from "@/components/biz2/sheets";
import { Check, DeleteButton, DeptChip, Empty, Icon, Skeleton, useToast } from "@/components/ui";
import { deptVar, fmtDate, pct, projectProgress, type Task } from "@/lib/domain";

export default function ProjectPage() {
  const { pid } = useParams<{ pid: string }>();
  const { biz } = useBiz();
  const router = useRouter();
  const toast = useToast();
  const { data, reload, setData } = useBizData(biz.id);
  const [edit, setEdit] = useState(false);
  const [taskSheet, setTaskSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [newMs, setNewMs] = useState("");
  const [valueDraft, setValueDraft] = useState<string | null>(null);

  if (!data) return <Skeleton h={100} />;
  const p = data.projects.find((x) => x.id === pid);
  if (!p) return <div className="empty">הפרויקט לא נמצא. ייתכן שנמחק.</div>;
  const prog = projectProgress(p, data.milestones, data.tasks);
  const ms = data.milestones.filter((m) => m.project_id === p.id);
  const tasks = data.tasks.filter((t) => t.project_id === p.id);
  const numeric = p.baseline != null && p.target != null;

  async function addMilestone() {
    if (!newMs.trim()) return;
    await supabase().from("project_milestones").insert({ project_id: p!.id, business_id: biz.id, title: newMs.trim(), position: ms.length });
    setNewMs(""); reload();
  }
  async function toggleMs(id: string, done: boolean) {
    setData((d) => d && { ...d, milestones: d.milestones.map((m) => m.id === id ? { ...m, done: !done } : m) });
    await supabase().from("project_milestones").update({ done: !done }).eq("id", id);
  }
  async function removeMs(id: string) {
    const m = ms.find((x) => x.id === id)!;
    await supabase().from("project_milestones").delete().eq("id", id);
    reload();
    toast("תת-היעד נמחק", async () => { await supabase().from("project_milestones").insert({ project_id: m.project_id, business_id: m.business_id, title: m.title, done: m.done, position: m.position }); reload(); });
  }
  async function saveValue() {
    if (valueDraft == null) return;
    const v = valueDraft.trim() === "" ? null : Number(valueDraft);
    if (v != null && isNaN(v)) return;
    await supabase().from("projects").update({ current_value: v }).eq("id", p!.id);
    setValueDraft(null); reload();
  }
  async function archive() {
    await supabase().from("projects").update({ archived_at: new Date().toISOString() }).eq("id", p!.id);
    toast("הפרויקט נמחק", async () => { await supabase().from("projects").update({ archived_at: null }).eq("id", p!.id); router.push(`/b/${biz.id}/projects/${p!.id}`); });
    router.push(`/b/${biz.id}/projects`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <DeptChip code={p.department_code} />
          <h1 className="large-title mt-2">{p.title}</h1>
          {p.target_date && <div className="caption mt-1">תאריך יעד: {fmtDate(p.target_date, { day: "numeric", month: "long", year: "numeric" })}</div>}
        </div>
        <button className="btn-tint shrink-0" onClick={() => setEdit(true)}><Icon name="edit" size={18} /> עריכה</button>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex items-end justify-between">
          <span className="eyebrow">התקדמות</span>
          <span className={`num text-3xl font-extrabold ${prog === 1 ? "text-[var(--done)]" : ""}`}>{pct(prog)}</span>
        </div>
        <div className={`bar ${prog === 1 ? "done" : ""}`} style={{ height: 10 }}><span style={{ width: `${(prog ?? 0) * 100}%` }} /></div>
        {numeric && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="muted num">התחלה: {p.baseline} · יעד: {p.target} {p.unit ?? ""}</span>
            {valueDraft == null ? (
              <button className="btn-plain text-sm" onClick={() => setValueDraft(p.current_value == null ? "" : String(p.current_value))}>
                עכשיו: <b className="num ms-1">{p.current_value ?? "לא ידוע"}</b> · עדכון
              </button>
            ) : (
              <span className="flex items-center gap-2">
                <input className="input !min-h-9 w-28 num" inputMode="decimal" autoFocus value={valueDraft} onChange={(e) => setValueDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveValue()} aria-label="ערך נוכחי" />
                <button className="btn !min-h-9" onClick={saveValue}>שמירה</button>
              </span>
            )}
          </div>
        )}
        {prog == null && <div className="caption">האחוז יופיע אחרי שתוסיפו תת-יעדים, משימות או יעד מספרי.</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4"><div className="eyebrow mb-1">המצב היום</div><p className="whitespace-pre-wrap">{p.current_state || <span className="muted">לא נכתב</span>}</p></div>
        <div className="card p-4 dept-stripe" style={{ ["--c" as string]: deptVar(p.department_code) }}><div className="eyebrow mb-1">היעד</div><p className="whitespace-pre-wrap">{p.goal || <span className="muted">לא נכתב</span>}</p></div>
      </div>

      <section className="space-y-2">
        <h2 className="section-title">תת-יעדים</h2>
        <div className="list-group">
          {ms.map((m) => (
            <div key={m.id} className={`row ${m.done ? "bg-[var(--done-soft)]" : ""}`}>
              <Check done={m.done} onToggle={() => toggleMs(m.id, m.done)} label={m.title} />
              <span className={`flex-1 font-semibold ${m.done ? "line-through text-[var(--done)]" : ""}`}>{m.title}</span>
              <button className="icon-btn !text-[var(--muted)]" aria-label={`מחיקת ${m.title}`} onClick={() => removeMs(m.id)}><Icon name="close" size={18} /></button>
            </div>
          ))}
          <form className="row" onSubmit={(e) => { e.preventDefault(); addMilestone(); }}>
            <Icon name="plus" size={20} className="text-[var(--accent)]" />
            <input className="flex-1 bg-transparent outline-none min-h-10" placeholder="תת-יעד חדש, למשל: טבלת הכנסות מלאה ל-3 חודשים" value={newMs} onChange={(e) => setNewMs(e.target.value)} aria-label="תת-יעד חדש" />
            {newMs.trim() && <button className="btn-plain">הוספה</button>}
          </form>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="section-title">משימות</h2>
          <button className="btn-tint" onClick={() => setTaskSheet({ open: true, task: null })}><Icon name="plus" size={18} /> משימה</button>
        </div>
        {tasks.length === 0 ? <Empty icon="list" title="אין משימות בפרויקט">אפשר לעבוד משימה אחרי משימה, או להוסיף כמה בבת אחת.</Empty> : (
          <div className="list-group">{tasks.map((t) => <TaskRow key={t.id} t={t} projects={data.projects} onToggle={() => toggleDone(t, setData)} onOpen={() => setTaskSheet({ open: true, task: t })} />)}</div>
        )}
      </section>

      <div className="pt-4"><DeleteButton onConfirm={archive} label="מחיקת הפרויקט" /></div>

      <ProjectSheet open={edit} onClose={() => setEdit(false)} businessId={biz.id} project={p} nextPosition={p.position} onSaved={reload} />
      <TaskSheet open={taskSheet.open} onClose={() => setTaskSheet({ open: false })} businessId={biz.id} task={taskSheet.task}
        preset={{ project_id: p.id, department_code: p.department_code }} projects={data.projects} onSaved={reload} />
    </div>
  );
}
