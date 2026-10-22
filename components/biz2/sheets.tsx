"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Sheet, Field, DeleteButton, Seg, useToast, Icon } from "@/components/ui";
import { ASSIGNEES, DEPARTMENTS, TASK_STATUS, toLocalInput, type Meeting, type Project, type Task } from "@/lib/domain";

/* ---------------- task ---------------- */
export function TaskSheet({ open, onClose, businessId, task, preset, projects, onSaved }: {
  open: boolean; onClose: () => void; businessId: string; task?: Task | null;
  preset?: Partial<Task>; projects: Project[]; onSaved: () => void;
}) {
  const toast = useToast();
  const blank = { title: "", department_code: "", project_id: "", due_on: "", assignee_name: "אורית", status: "todo", is_weekly_commitment: false, description: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const src = { ...preset, ...(task ?? {}) };
    setF({
      title: src.title ?? "", department_code: src.department_code ?? "", project_id: src.project_id ?? "",
      due_on: src.due_on ?? "", assignee_name: src.assignee_name ?? (task ? "" : "אורית"), status: src.status ?? "todo",
      is_weekly_commitment: !!src.is_weekly_commitment, description: src.description ?? "",
    });
    // preset is read only when the sheet opens; callers pass a fresh object each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  // picking a project fills its department
  function pickProject(pid: string) {
    const p = projects.find((x) => x.id === pid);
    setF((v) => ({ ...v, project_id: pid, department_code: v.department_code || p?.department_code || "" }));
  }

  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    const body = {
      title: f.title.trim(), department_code: f.department_code || null, project_id: f.project_id || null, due_on: f.due_on || null,
      assignee_name: f.assignee_name || null, status: f.status, is_weekly_commitment: f.is_weekly_commitment, description: f.description || null,
    };
    const { error } = task
      ? await supabase().from("tasks").update(body).eq("id", task.id)
      : await supabase().from("tasks").insert({ ...body, business_id: businessId });
    setBusy(false);
    if (error) { toast("המשימה לא נשמרה. נסו שוב."); return; }
    onSaved(); onClose();
  }

  async function remove() {
    if (!task) return;
    const at = new Date().toISOString();
    await supabase().from("tasks").update({ archived_at: at }).eq("id", task.id);
    onSaved(); onClose();
    toast("המשימה נמחקה", async () => { await supabase().from("tasks").update({ archived_at: null }).eq("id", task.id); onSaved(); });
  }

  return (
    <Sheet open={open} onClose={onClose} title={task ? "עריכת משימה" : "משימה חדשה"}
      footer={<button className="btn w-full" disabled={busy || !f.title.trim()} onClick={save}>{busy ? "שומר…" : task ? "שמירה" : "הוספה"}</button>}>
      <Field label="מה צריך לעשות?">
        <input className="input text-[17px]" autoFocus value={f.title} placeholder="למשל: לרכז הכנסות של 3 חודשים"
          onChange={(e) => setF({ ...f, title: e.target.value })} onKeyDown={(e) => e.key === "Enter" && save()} />
      </Field>
      <button type="button" onClick={() => setF({ ...f, is_weekly_commitment: !f.is_weekly_commitment })} aria-pressed={f.is_weekly_commitment}
        className={`w-full flex items-center justify-between gap-3 rounded-xl px-4 min-h-12 font-semibold transition-colors ${f.is_weekly_commitment ? "bg-[var(--mark-soft)] text-[var(--mark)]" : "bg-[var(--surface)]"}`}>
        <span className="flex items-center gap-2"><Icon name="star" size={20} /> משימה לשבוע הזה</span>
        <span className={`flex w-12 h-7 rounded-full p-0.5 transition-colors ${f.is_weekly_commitment ? "bg-[var(--mark)] justify-end" : "bg-[var(--surface-2)] justify-start"}`}>
          <span className="block w-6 h-6 rounded-full bg-white shadow" />
        </span>
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Field label="מחלקה">
          <select className="input" value={f.department_code} onChange={(e) => setF({ ...f, department_code: e.target.value })}>
            <option value="">כללי</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="תאריך יעד">
          <input type="date" className="input" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} />
        </Field>
      </div>
      <Field label="פרויקט">
        <select className="input" value={f.project_id} onChange={(e) => pickProject(e.target.value)}>
          <option value="">ללא פרויקט</option>
          {projects.filter((p) => !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
      </Field>
      <div className="field"><span>מי אחראי</span>
        <Seg label="מי אחראי" value={f.assignee_name} onChange={(v) => setF({ ...f, assignee_name: v })}
          options={[...ASSIGNEES.map((a) => ({ value: a as string, label: a as string })), { value: "", label: "לא נקבע" }]} />
      </div>
      {task && (
        <div className="field"><span>סטטוס</span>
          <div className="overflow-x-auto -mx-1 px-1"><Seg label="סטטוס" value={f.status} onChange={(v) => setF({ ...f, status: v })}
            options={Object.entries(TASK_STATUS).map(([value, label]) => ({ value, label }))} /></div>
        </div>
      )}
      <Field label="הערות">
        <textarea className="input" value={f.description} placeholder="פרטים, קישורים, מתי היא נחשבת 'בוצעה'" onChange={(e) => setF({ ...f, description: e.target.value })} />
      </Field>
      {task && <DeleteButton onConfirm={remove} label="מחיקת משימה" />}
    </Sheet>
  );
}

/* ---------------- meeting ---------------- */
export function MeetingSheet({ open, onClose, businessId, businesses, meeting, defaultAt, onSaved }: {
  open: boolean; onClose: () => void; businessId?: string; businesses?: { id: string; name: string }[];
  meeting?: Meeting | null; defaultAt?: string; onSaved: (id?: string) => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ business_id: "", title: "פגישת ליווי", at: "", duration: "60", location: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const next = new Date(); next.setDate(next.getDate() + 7); next.setHours(18, 0, 0, 0);
    setF({
      business_id: meeting?.business_id ?? businessId ?? businesses?.[0]?.id ?? "",
      title: meeting?.title ?? "פגישת ליווי",
      at: meeting ? toLocalInput(meeting.scheduled_at) : defaultAt ?? toLocalInput(next.toISOString()),
      duration: String(meeting?.duration_minutes ?? 60), location: meeting?.location ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting]);

  async function save() {
    if (!f.business_id || !f.at) return;
    setBusy(true);
    const body = { title: f.title || null, scheduled_at: new Date(f.at).toISOString(), duration_minutes: Number(f.duration), location: f.location || null };
    const res = meeting
      ? await supabase().from("meetings").update(body).eq("id", meeting.id).select("id").single()
      : await supabase().from("meetings").insert({ ...body, business_id: f.business_id }).select("id").single();
    setBusy(false);
    if (res.error) { toast("הפגישה לא נשמרה. נסו שוב."); return; }
    if (!meeting) await supabase().from("meeting_private_notes").insert({ meeting_id: res.data.id, business_id: f.business_id });
    onSaved(res.data.id); onClose();
    if (!meeting) toast("הפגישה נקבעה");
  }

  async function archive() {
    if (!meeting) return;
    await supabase().from("meetings").update({ archived_at: new Date().toISOString() }).eq("id", meeting.id);
    onSaved(); onClose();
    toast("הפגישה הועברה לארכיון", async () => { await supabase().from("meetings").update({ archived_at: null }).eq("id", meeting.id); onSaved(); });
  }

  return (
    <Sheet open={open} onClose={onClose} title={meeting ? "עריכת פגישה" : "קביעת פגישה"}
      footer={<button className="btn w-full" disabled={busy || !f.at || !f.business_id} onClick={save}>{busy ? "שומר…" : meeting ? "שמירה" : "קביעה"}</button>}>
      {!businessId && businesses && businesses.length > 0 && (
        <Field label="עסק">
          <select className="input" value={f.business_id} onChange={(e) => setF({ ...f, business_id: e.target.value })}>
            {businesses.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
      )}
      <Field label="מתי"><input type="datetime-local" className="input" value={f.at} onChange={(e) => setF({ ...f, at: e.target.value })} /></Field>
      <div className="field"><span>משך</span>
        <Seg label="משך" value={f.duration} onChange={(v) => setF({ ...f, duration: v })}
          options={[{ value: "30", label: "30 דק׳" }, { value: "45", label: "45 דק׳" }, { value: "60", label: "שעה" }, { value: "90", label: "שעה וחצי" }]} />
      </div>
      <Field label="כותרת"><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="מיקום"><input className="input" value={f.location} placeholder="בבית / זום / טלפון" onChange={(e) => setF({ ...f, location: e.target.value })} /></Field>
      {meeting && <DeleteButton onConfirm={archive} label="מחיקה (מעבר לארכיון)" confirmLabel="להעביר לארכיון?" />}
    </Sheet>
  );
}

/* ---------------- project ---------------- */
export function ProjectSheet({ open, onClose, businessId, project, defaultDept, nextPosition, onSaved }: {
  open: boolean; onClose: () => void; businessId: string; project?: Project | null; defaultDept?: string; nextPosition: number; onSaved: (id?: string) => void;
}) {
  const toast = useToast();
  const blank = { title: "", department_code: "", current_state: "", goal: "", unit: "", baseline: "", current_value: "", target: "", target_date: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setF(project ? {
      title: project.title, department_code: s(project.department_code), current_state: s(project.current_state), goal: s(project.goal),
      unit: s(project.unit), baseline: s(project.baseline), current_value: s(project.current_value), target: s(project.target), target_date: s(project.target_date),
    } : { ...blank, department_code: defaultDept ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, defaultDept]);

  const n = (v: string) => (v.trim() === "" || isNaN(Number(v)) ? null : Number(v));
  async function save() {
    if (!f.title.trim()) return;
    setBusy(true);
    const body = {
      title: f.title.trim(), department_code: f.department_code || null, current_state: f.current_state || null, goal: f.goal || null,
      unit: f.unit || null, baseline: n(f.baseline), current_value: n(f.current_value), target: n(f.target), target_date: f.target_date || null,
    };
    const res = project
      ? await supabase().from("projects").update(body).eq("id", project.id).select("id").single()
      : await supabase().from("projects").insert({ ...body, business_id: businessId, position: nextPosition }).select("id").single();
    setBusy(false);
    if (res.error) { toast("הפרויקט לא נשמר. נסו שוב."); return; }
    onSaved(res.data.id); onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={project ? "עריכת פרויקט" : "פרויקט חדש"}
      footer={<button className="btn w-full" disabled={busy || !f.title.trim()} onClick={save}>{busy ? "שומר…" : project ? "שמירה" : "יצירת פרויקט"}</button>}>
      <Field label="שם הפרויקט"><input className="input text-[17px]" autoFocus value={f.title} placeholder="למשל: מערכת תיעוד הכנסות" onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="מחלקה">
        <select className="input" value={f.department_code} onChange={(e) => setF({ ...f, department_code: e.target.value })}>
          <option value="">כללי</option>
          {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="המצב היום"><textarea className="input" value={f.current_state} placeholder="מה קורה עכשיו, בלי ייפוי" onChange={(e) => setF({ ...f, current_state: e.target.value })} /></Field>
      <Field label="היעד"><textarea className="input" value={f.goal} placeholder="איך ייראה הצלחה" onChange={(e) => setF({ ...f, goal: e.target.value })} /></Field>
      <div className="card p-4 space-y-3">
        <div><div className="font-semibold">יעד מספרי (לא חובה)</div><div className="caption">אם יש מספר שאפשר למדוד, האחוז יחושב ממנו. אחרת מתת-היעדים או מהמשימות.</div></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="יחידה"><input className="input" value={f.unit} placeholder="₪ / לקוחות / פניות" onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
          <Field label="תאריך יעד"><input type="date" className="input" value={f.target_date} onChange={(e) => setF({ ...f, target_date: e.target.value })} /></Field>
          <Field label="נקודת התחלה"><input inputMode="decimal" className="input num" value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} /></Field>
          <Field label="יעד"><input inputMode="decimal" className="input num" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
          <Field label="ערך נוכחי"><input inputMode="decimal" className="input num" value={f.current_value} onChange={(e) => setF({ ...f, current_value: e.target.value })} /></Field>
        </div>
      </div>
    </Sheet>
  );
}
