"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loading } from "@/components/Shell";
import { DEPARTMENTS, FINDING_STATUS, deptName, priorityLevel, priorityScore, type Finding } from "@/lib/domain";
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

  if (!list) return <Loading />;
  const open = list.filter((f) => f.status === "open" || f.status === "in_progress");
  const shown = (showClosed ? list : open)
    .filter((f) => !deptFilter || f.department_code === deptFilter)
    .sort((a, b) => priorityScore(b) - priorityScore(a));
  const countIn = (code: string) => open.filter((f) => f.department_code === code).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">ממצאים</h2>
          <p className="text-sm muted mt-1">ממוינים לפי כלל אצבע: חוסמים קודם, ואז השפעה ודחיפות ביחס למאמץ. זה כלי לחשיבה, לא פסק דין.</p>
        </div>
        <button className="btn" onClick={() => setAdding(true)}>+ ממצא חדש</button>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button className={`toggle shrink-0 ${!deptFilter ? "!border-solid !border-[var(--accent)] !text-[var(--accent)]" : ""}`} onClick={() => setDeptFilter("")}>הכול <span className="num">{open.length}</span></button>
        {DEPARTMENTS.map((d) => (
          <button key={d.code} className={`toggle shrink-0 ${deptFilter === d.code ? "!border-solid !border-[var(--accent)] !text-[var(--accent)]" : ""}`}
            onClick={() => setDeptFilter(deptFilter === d.code ? "" : d.code)}>{d.name} <span className="num">{countIn(d.code)}</span></button>
        ))}
        <button className="toggle shrink-0" aria-pressed={showClosed} onClick={() => setShowClosed(!showClosed)}>כולל סגורים</button>
      </div>

      {adding && <FindingForm businessId={businessId} defaultDept={deptFilter || undefined} onDone={() => { setAdding(false); load(); }} />}
      {shown.length === 0 && !adding && (
        <div className="empty">{list.length === 0 ? "עוד אין ממצאים. הדרך הטובה ביותר: בזמן האבחון, לחצו \"+ ממצא\" ליד תשובה שמעוררת מחשבה." : "אין ממצאים פתוחים בסינון הזה."}</div>
      )}
      <div className="space-y-3">
        {shown.map((f) => {
          const p = priorityLevel(f);
          const closed = f.status === "resolved" || f.status === "dismissed";
          return (
            <div key={f.id} className={`item ${closed ? "opacity-60" : ""}`} data-p={p}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`chip ${p === 1 ? "chip-bad" : p === 2 ? "chip-mark" : "chip-plain"}`}>P{p}</span>
                {f.is_blocker && <span className="chip chip-bad">חוסם</span>}
                <span className="text-xs muted">{deptName(f.department_code)}</span>
                <span className="text-xs muted num ms-auto">השפעה {f.impact} · דחיפות {f.urgency} · מאמץ {f.effort}</span>
              </div>
              <div className="font-bold text-[17px]">{f.title}</div>
              {f.evidence && <blockquote className="text-sm muted mt-2 border-s-2 border-[var(--line)] ps-3">{f.evidence}</blockquote>}
              {f.rationale && <p className="text-sm mt-2"><span className="muted">נימוק: </span>{f.rationale}</p>}
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <select aria-label="סטטוס" className="input !w-auto !py-1.5 text-sm" value={f.status} onChange={(e) => setStatus(f.id, e.target.value)}>
                  {Object.entries(FINDING_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {!closed && <button className="btn-ghost text-sm" onClick={() => setTaskFor(taskFor === f.id ? null : f.id)}>הפיכה למשימה ←</button>}
              </div>
              {taskFor === f.id && (
                <QuickTask businessId={businessId} finding={f} onDone={() => { setTaskFor(null); setStatus(f.id, "in_progress"); }} />
              )}
            </div>
          );
        })}
      </div>
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
    <div className="panel mt-3 space-y-3">
      <div><label className="label" htmlFor={`qt-${finding.id}`}>המשימה</label><input id={`qt-${finding.id}`} className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label" htmlFor={`qd-${finding.id}`}>תאריך יעד</label><input id={`qd-${finding.id}`} type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div><label className="label" htmlFor={`qo-${finding.id}`}>מתי היא &quot;בוצעה&quot;?</label><input id={`qo-${finding.id}`} className="input" placeholder="למשל: יש טבלה עם 3 חודשים" value={dod} onChange={(e) => setDod(e.target.value)} /></div>
      </div>
      {err && <p className="text-[var(--bad)] text-sm">{err}</p>}
      <button className="btn" onClick={save} disabled={!title.trim()}>יצירת משימה</button>
    </div>
  );
}
