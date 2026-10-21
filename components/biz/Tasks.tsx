"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS, TASK_STATUS, deptName, type Task } from "@/lib/domain";

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

  if (!tasks) return <p className="text-gray-500">טוען…</p>;
  const nameOf = (uid: string | null) => members.find((m) => m.user_id === uid)?.profiles?.display_name ?? "לא משויך";
  const isOpen = (t: Task) => t.status !== "done" && t.status !== "canceled";
  const weekly = tasks.filter((t) => t.is_weekly_commitment && isOpen(t));
  const shown = tasks.filter((t) => statusFilter === "all" || (statusFilter === "open" ? isOpen(t) : t.status === statusFilter));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="font-semibold mb-2">השבוע (עד 3 התחייבויות)</h2>
        {weekly.length === 0 ? <p className="text-sm text-gray-500">עוד לא נקבעו התחייבויות לשבוע.</p> : (
          <ol className="list-decimal pr-5 space-y-1">{weekly.map((t) => <li key={t.id}>{t.title} <span className="text-xs text-gray-500">({nameOf(t.assignee_id)}{t.due_on ? `, עד ${t.due_on}` : ""})</span></li>)}</ol>
        )}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        {isConsultant && <button className="btn" onClick={() => setAdding(true)}>+ משימה</button>}
        <select className="input w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="open">פתוחות</option>
          <option value="all">הכל</option>
          {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {adding && <NewTask businessId={businessId} members={members} onDone={() => { setAdding(false); load(); }} />}
      {shown.length === 0 && <div className="card text-gray-500">אין משימות להצגה.</div>}
      {shown.map((t) => {
        const mine = t.assignee_id === userId;
        const canStatus = isConsultant || mine;
        return (
          <div key={t.id} className="card">
            <div className="flex justify-between gap-2 flex-wrap">
              <div className="font-semibold">{t.title}</div>
              <div className="flex gap-2 text-xs items-center">
                {t.department_code && <span className="chip">{deptName(t.department_code)}</span>}
                <span className={t.due_on && t.due_on < today && isOpen(t) ? "text-red-600 font-semibold" : ""}>{t.due_on ? `יעד: ${t.due_on}` : "ללא תאריך"}</span>
                <span>· {nameOf(t.assignee_id)}</span>
              </div>
            </div>
            {t.description && <p className="text-sm text-gray-600 mt-1">{t.description}</p>}
            {t.done_definition && <p className="text-sm mt-1"><b>בוצע כאשר:</b> {t.done_definition}</p>}
            <div className="flex gap-3 mt-3 items-center flex-wrap text-sm">
              <select className="input w-auto" disabled={!canStatus} value={t.status} onChange={(e) => update(t.id, { status: e.target.value })}>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {isConsultant && (
                <>
                  <select className="input w-auto" value={t.assignee_id ?? ""} onChange={(e) => update(t.id, { assignee_id: e.target.value || null })}>
                    <option value="">לא משויך</option>
                    {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.profiles?.display_name ?? m.user_id.slice(0, 6)}</option>)}
                  </select>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={t.is_weekly_commitment} onChange={(e) => update(t.id, { is_weekly_commitment: e.target.checked })} /> התחייבות השבוע
                  </label>
                </>
              )}
              {t.completed_at && <span className="text-green-700 text-xs">הושלם {new Date(t.completed_at).toLocaleDateString("he-IL")}</span>}
            </div>
          </div>
        );
      })}
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
    <div className="card space-y-3 bg-[#fbfaff]">
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
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn" onClick={save} disabled={!f.title.trim()}>שמירה</button>
        <button className="btn-ghost" onClick={onDone}>ביטול</button>
      </div>
    </div>
  );
}
