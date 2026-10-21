"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loading } from "@/components/Shell";
import { DEPARTMENTS, TASK_STATUS, deptName, isOpenTask, todayISO, type Task } from "@/lib/domain";

type Member = { user_id: string; role: string; profiles: { display_name: string | null } | null };

export function Tasks({ businessId, isConsultant, userId }: { businessId: string; isConsultant: boolean; userId: string }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [adding, setAdding] = useState(false);
  const [statusFilter, setStatusFilter] = useState("open");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase().from("tasks").select("*").eq("business_id", businessId).order("due_on", { nullsFirst: false });
    setTasks((data as Task[]) ?? []);
  }
  useEffect(() => {
    load();
    supabase().from("business_memberships").select("user_id,role,profiles(display_name)").eq("business_id", businessId)
      .then(({ data }) => setMembers((data as unknown as Member[]) ?? []));
  }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function update(id: string, patch: Partial<Task>) {
    setErr(null);
    if (patch.is_weekly_commitment && (tasks ?? []).filter((t) => t.is_weekly_commitment && t.status !== "done" && t.status !== "canceled").length >= 3) {
      setErr("עד 3 התחייבויות שבועיות בלבד");
      return;
    }
    const { error } = await supabase().from("tasks").update(patch).eq("id", id);
    if (error) setErr(error.message);
    load();
  }

  if (!tasks) return <Loading />;
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profiles?.display_name ?? "לא משויך";
  const isOpen = isOpenTask;
  const weekly = tasks.filter((t) => t.is_weekly_commitment && isOpen(t));
  const shown = tasks.filter((t) => statusFilter === "all" || (statusFilter === "open" ? isOpen(t) : t.status === statusFilter));
  const today = todayISO();
  const STATUS_TONE: Record<string, string> = { todo: "chip-plain", in_progress: "", blocked: "chip-bad", done: "chip-plain", canceled: "chip-plain" };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">השבוע</h2>
        <p className="text-sm muted mt-1">עד שלוש התחייבויות. כל אחת היא משימה אמיתית עם אחראית ותאריך.</p>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          {[0, 1, 2].map((i) => {
            const t = weekly[i];
            return t ? (
              <div key={t.id} className="rounded-xl p-4 bg-[var(--mark-soft)] border border-[var(--mark)]/40">
                <div className="num text-2xl font-extrabold text-[var(--mark)]">{i + 1}</div>
                <div className="font-bold mt-1">{t.title}</div>
                <div className="text-xs muted mt-1">{nameOf(t.assignee_id)}{t.due_on ? ` · עד ${new Date(t.due_on).toLocaleDateString("he-IL")}` : ""}</div>
              </div>
            ) : (
              <div key={i} className="rounded-xl p-4 border border-dashed border-[var(--line)] muted">
                <div className="num text-2xl font-extrabold opacity-40">{i + 1}</div>
                <div className="text-sm mt-1">{isConsultant ? "סמנו משימה למטה כ\"התחייבות השבוע\"" : "משבצת פנויה"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">כל המשימות</h3>
        <div className="flex gap-2">
          <select aria-label="סינון לפי סטטוס" className="input !w-auto !py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="open">פתוחות</option>
            <option value="all">הכול</option>
            {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          {isConsultant && <button className="btn" onClick={() => setAdding(true)}>+ משימה</button>}
        </div>
      </div>
      {err && <p className="text-[var(--bad)] text-sm" role="alert">{err}</p>}
      {adding && <NewTask businessId={businessId} members={members} onDone={() => { setAdding(false); load(); }} />}
      {shown.length === 0 && <div className="empty">{tasks.length === 0 ? "עוד אין משימות. הדרך הקצרה: ממצא ← \"הפיכה למשימה\"." : "אין משימות בסינון הזה."}</div>}
      <div className="space-y-3">
        {shown.map((t) => {
          const mine = t.assignee_id === userId;
          const canStatus = isConsultant || mine;
          const late = !!t.due_on && t.due_on < today && isOpen(t);
          return (
            <div key={t.id} className={`item ${!isOpen(t) ? "opacity-60" : ""}`} data-p={t.is_weekly_commitment && isOpen(t) ? 2 : undefined}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`chip ${STATUS_TONE[t.status]}`}>{TASK_STATUS[t.status]}</span>
                {t.is_weekly_commitment && isOpen(t) && <span className="chip chip-mark">השבוע</span>}
                {t.department_code && <span className="text-xs muted">{deptName(t.department_code)}</span>}
                <span className={`text-xs ms-auto num ${late ? "text-[var(--bad)] font-bold" : "muted"}`}>
                  {t.due_on ? `${late ? "באיחור · " : ""}עד ${new Date(t.due_on).toLocaleDateString("he-IL")}` : "ללא תאריך"}
                </span>
              </div>
              <div className={`font-bold text-[17px] ${t.status === "done" ? "line-through" : ""}`}>{t.title}</div>
              <div className="text-sm muted">{nameOf(t.assignee_id)}</div>
              {t.description && <p className="text-sm mt-1">{t.description}</p>}
              {t.done_definition && <p className="text-sm mt-1"><span className="muted">בוצעה כאשר: </span>{t.done_definition}</p>}
              <div className="flex flex-wrap gap-2 mt-3 items-center text-sm">
                <select aria-label="סטטוס" className="input !w-auto !py-1.5" disabled={!canStatus} value={t.status} onChange={(e) => update(t.id, { status: e.target.value })}>
                  {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {isConsultant && (
                  <>
                    <select aria-label="אחראי/ת" className="input !w-auto !py-1.5" value={t.assignee_id ?? ""} onChange={(e) => update(t.id, { assignee_id: e.target.value || null })}>
                      <option value="">לא משויך</option>
                      {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name ?? m.user_id.slice(0, 6)}</option>)}
                    </select>
                    {isOpen(t) && (
                      <button type="button" className="toggle" aria-pressed={t.is_weekly_commitment} onClick={() => update(t.id, { is_weekly_commitment: !t.is_weekly_commitment })}>
                        {t.is_weekly_commitment ? "✓ התחייבות השבוע" : "+ להתחייבות השבוע"}
                      </button>
                    )}
                  </>
                )}
                {t.completed_at && <span className="text-[var(--ok)] text-xs">הושלם {new Date(t.completed_at).toLocaleDateString("he-IL")}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewTask({ businessId, members, onDone }: { businessId: string; members: Member[]; onDone: () => void }) {
  const [f, setF] = useState({ title: "", description: "", done_definition: "", due_on: "", assignee_id: "", department_code: "", priority: 2 });
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    const { error } = await supabase().from("tasks").insert({
      business_id: businessId, title: f.title.trim(), description: f.description || null,
      done_definition: f.done_definition || null, due_on: f.due_on || null, assignee_id: f.assignee_id || null,
      department_code: f.department_code || null, priority: f.priority,
    });
    if (error) setErr(error.message); else onDone();
  }
  return (
    <div className="panel space-y-3">
      <div><label className="label">כותרת</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus /></div>
      <div><label className="label">תיאור</label><textarea className="input" rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div><label className="label">הגדרת "בוצע"</label><input className="input" value={f.done_definition} onChange={(e) => setF({ ...f, done_definition: e.target.value })} /></div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className="label">תאריך יעד</label><input type="date" className="input" value={f.due_on} onChange={(e) => setF({ ...f, due_on: e.target.value })} /></div>
        <div><label className="label">אחראי/ת</label>
          <select className="input" value={f.assignee_id} onChange={(e) => setF({ ...f, assignee_id: e.target.value })}>
            <option value="">לא משויך</option>
            {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name ?? m.user_id.slice(0, 6)}</option>)}
          </select></div>
        <div><label className="label">מחלקה</label>
          <select className="input" value={f.department_code} onChange={(e) => setF({ ...f, department_code: e.target.value })}>
            <option value="">—</option>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select></div>
      </div>
      {err && <p className="text-[var(--bad)] text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn" onClick={save} disabled={!f.title.trim()}>שמירה</button>
        <button className="btn-ghost" onClick={onDone}>ביטול</button>
      </div>
    </div>
  );
}
