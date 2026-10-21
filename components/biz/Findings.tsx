"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS, FINDING_STATUS, deptName, priorityScore, type Finding } from "@/lib/domain";
import { FindingForm } from "./FindingForm";

export function Findings({ businessId }: { businessId: string }) {
  const [list, setList] = useState<Finding[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [deptFilter, setDeptFilter] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [taskFor, setTaskFor] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase().from("findings").select("*").eq("business_id", businessId);
    setList((data as Finding[]) ?? []);
  }
  useEffect(() => { load(); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setStatus(id: string, status: string) {
    await supabase().from("findings").update({ status }).eq("id", id);
    load();
  }

  if (!list) return <p className="text-gray-500">טוען…</p>;
  const shown = list
    .filter((f) => !deptFilter || f.department_code === deptFilter)
    .filter((f) => showClosed || f.status === "open" || f.status === "in_progress")
    .sort((a, b) => priorityScore(b) - priorityScore(a));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn" onClick={() => setAdding(true)}>+ ממצא חדש</button>
        <select className="input w-auto" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">כל המחלקות</option>
          {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
        </select>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> הצגת סגורים
        </label>
      </div>
      <p className="text-xs text-gray-500">סדר העדיפות הוא היוריסטיקה (חוסמים קודם, ואז השפעה+דחיפות ביחס למאמץ) — לא דירוג אובייקטיבי.</p>
      {adding && <FindingForm businessId={businessId} onDone={() => { setAdding(false); load(); }} />}
      {shown.length === 0 && !adding && <div className="card text-gray-500">אין ממצאים פתוחים. ממצאים נוצרים מתוך תשובות האבחון.</div>}
      {shown.map((f) => (
        <div key={f.id} className="card">
          <div className="flex justify-between gap-2 flex-wrap">
            <div className="font-semibold">{f.is_blocker && <span className="text-red-600">⛔ </span>}{f.title}</div>
            <div className="flex gap-2 items-center text-xs">
              <span className="chip">{deptName(f.department_code)}</span>
              <span>השפעה {f.impact} · דחיפות {f.urgency} · מאמץ {f.effort}</span>
            </div>
          </div>
          {f.evidence && <p className="text-sm text-gray-600 mt-1">ראיה: {f.evidence}</p>}
          {f.rationale && <p className="text-sm text-gray-500 mt-1">נימוק: {f.rationale}</p>}
          <div className="flex gap-2 mt-3 items-center flex-wrap">
            <select className="input w-auto text-sm" value={f.status} onChange={(e) => setStatus(f.id, e.target.value)}>
              {Object.entries(FINDING_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button className="btn-ghost text-sm" onClick={() => setTaskFor(f.id)}>→ הפיכה למשימה</button>
          </div>
          {taskFor === f.id && (
            <QuickTask businessId={businessId} finding={f} onDone={() => { setTaskFor(null); setStatus(f.id, "in_progress"); }} />
          )}
        </div>
      ))}
    </div>
  );
}

function QuickTask({ businessId, finding, onDone }: { businessId: string; finding: Finding; onDone: () => void }) {
  const [title, setTitle] = useState(finding.title);
  const [due, setDue] = useState("");
  const [dod, setDod] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    const { error } = await supabase().from("tasks").insert({
      business_id: businessId, finding_id: finding.id, department_code: finding.department_code,
      title, due_on: due || null, done_definition: dod || null,
    });
    if (error) setErr(error.message); else onDone();
  }
  return (
    <div className="mt-3 border border-[var(--line)] rounded-xl p-3 space-y-2 bg-[#fbfaff]">
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid sm:grid-cols-2 gap-2">
        <div><label className="label">תאריך יעד</label><input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div><label className="label">הגדרת "בוצע"</label><input className="input" value={dod} onChange={(e) => setDod(e.target.value)} /></div>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <button className="btn" onClick={save} disabled={!title.trim()}>יצירת משימה</button>
    </div>
  );
}
