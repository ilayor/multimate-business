"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS } from "@/lib/domain";

function Scale({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <button type="button" key={n} onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-lg border ${value === n ? "bg-[var(--accent)] text-white" : "bg-white"}`}>{n}</button>
        ))}
      </div>
    </div>
  );
}

export function FindingForm(props: {
  businessId: string;
  diagnosticId?: string;
  answerId?: string;
  defaultDept?: string;
  defaultEvidence?: string;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dept, setDept] = useState(props.defaultDept ?? "strategy");
  const [evidence, setEvidence] = useState(props.defaultEvidence ?? "");
  const [rationale, setRationale] = useState("");
  const [impact, setImpact] = useState(2);
  const [urgency, setUrgency] = useState(2);
  const [effort, setEffort] = useState(2);
  const [blocker, setBlocker] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) return;
    const { data: u } = await supabase().auth.getUser();
    const { error } = await supabase().from("findings").insert({
      business_id: props.businessId,
      diagnostic_id: props.diagnosticId ?? null,
      answer_id: props.answerId ?? null,
      department_code: dept,
      title: title.trim(),
      evidence: evidence || null,
      rationale: rationale || null,
      impact, urgency, effort,
      is_blocker: blocker,
      created_by: u.user?.id,
    });
    if (error) setErr(error.message);
    else props.onDone();
  }

  return (
    <div className="border border-[var(--line)] rounded-xl p-3 bg-[#fbfaff] space-y-3">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="label">ממצא (הפרשנות שלך)</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">מחלקה</label>
          <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">ראיה / ציטוט מהתשובה</label>
        <textarea className="input" rows={2} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
      </div>
      <div>
        <label className="label">נימוק (פרטי ליועץ)</label>
        <textarea className="input" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-5 items-end">
        <Scale label="השפעה" value={impact} onChange={setImpact} />
        <Scale label="דחיפות" value={urgency} onChange={setUrgency} />
        <Scale label="מאמץ" value={effort} onChange={setEffort} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={blocker} onChange={(e) => setBlocker(e.target.checked)} /> חוסם / רגולציה
        </label>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <div className="flex gap-2">
        <button className="btn" onClick={save} disabled={!title.trim()}>שמירת ממצא</button>
        <button className="btn-ghost" onClick={props.onDone}>ביטול</button>
      </div>
    </div>
  );
}
