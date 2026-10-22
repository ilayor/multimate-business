"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell, SaveBadge, Loading } from "@/components/Shell";
import { useAutosave } from "@/components/useAutosave";
import { FindingForm } from "@/components/biz/FindingForm";
import { DEPARTMENTS } from "@/lib/domain";

type Snapshot = { department_code: string; type: string; prompt: string; options: string[] | null };
type Answer = { id: string; position: number; question_snapshot_json: Snapshot; answer_text: string | null; is_unknown: boolean };
type Diag = { id: string; template_title: string; state: string; business_id: string };

const filled = (a: Answer) => !!(a.answer_text ?? "").trim() || a.is_unknown;

export default function DiagnosticPage() {
  const { id, did } = useParams<{ id: string; did: string }>();
  const user = useRequireUser();
  const [diag, setDiag] = useState<Diag | null>(null);
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [isConsultant, setIsConsultant] = useState(false);
  const [dept, setDept] = useState<string>("strategy");
  const [findingCounts, setFindingCounts] = useState<Record<string, number>>({});

  async function loadFindings() {
    const { data } = await supabase().from("findings").select("answer_id").eq("diagnostic_id", did);
    const c: Record<string, number> = {};
    (data ?? []).forEach((f: { answer_id: string | null }) => { if (f.answer_id) c[f.answer_id] = (c[f.answer_id] ?? 0) + 1; });
    setFindingCounts(c);
  }

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.from("diagnostics").select("id,template_title,state,business_id").eq("id", did).eq("business_id", id).maybeSingle()
      .then(({ data }) => setDiag(data));
    sb.from("diagnostic_answers").select("id,position,question_snapshot_json,answer_text,is_unknown").eq("diagnostic_id", did)
      .order("position").then(({ data }) => setAnswers((data as Answer[]) ?? []));
    sb.from("business_memberships").select("role").eq("business_id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setIsConsultant(data?.role === "consultant"));
    loadFindings();
    try { const s = sessionStorage.getItem(`dept:${did}`); if (s) setDept(s); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id, did]);

  function pickDept(code: string) {
    setDept(code);
    try { sessionStorage.setItem(`dept:${did}`, code); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleComplete() {
    if (!diag) return;
    const completed = diag.state !== "completed";
    const { error } = await supabase().from("diagnostics")
      .update({ state: completed ? "completed" : "in_progress", completed_at: completed ? new Date().toISOString() : null })
      .eq("id", did);
    if (!error) setDiag({ ...diag, state: completed ? "completed" : "in_progress" });
  }

  if (!user || !answers || !diag) return <Shell><Loading /></Shell>;

  const deptAnswers = (code: string) => answers.filter((a) => a.question_snapshot_json.department_code === code);
  const total = answers.length;
  const done = answers.filter(filled).length;
  const unknowns = answers.filter((a) => a.is_unknown).length;
  const visible = deptAnswers(dept);
  const deptIdx = DEPARTMENTS.findIndex((d) => d.code === dept);
  const isLast = deptIdx === DEPARTMENTS.length - 1;

  return (
    <Shell crumbs={<Link href={`/b/${id}#diagnostics`} className="underline">חזרה לעסק</Link>}>
      <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 z-10 -mx-4 px-4 pt-3 pb-3 chrome border-b border-[var(--line)] mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{diag.template_title}</h1>
            <div className="text-xs muted num">{done}/{total} נענו · {unknowns} "לא ידוע"{diag.state === "completed" ? " · הושלם" : ""}</div>
          </div>
          {isConsultant && (
            <button className="btn-ghost text-sm" onClick={toggleComplete}>
              {diag.state === "completed" ? "פתיחה מחדש" : "סימון כהושלם"}
            </button>
          )}
        </div>
        <div className="bar mb-3"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist">
          {DEPARTMENTS.map((d) => {
            const list = deptAnswers(d.code);
            const n = list.filter(filled).length;
            const complete = n === list.length && list.length > 0;
            return (
              <button key={d.code} role="tab" aria-selected={dept === d.code} onClick={() => pickDept(d.code)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-semibold border transition ${dept === d.code ? "bg-[var(--accent)] text-[var(--accent-ink)] border-transparent" : "bg-[var(--surface)] border-[var(--line)]"}`}>
                {complete && dept !== d.code ? "✓ " : ""}{d.name} <span className="num opacity-70 text-xs">{n}/{list.length}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {visible.map((a) => (
          <AnswerCard key={a.id} answer={a} businessId={id} diagnosticId={did} isConsultant={isConsultant}
            findingCount={findingCounts[a.id] ?? 0} onFinding={loadFindings}
            onLocalChange={(text, unknown) => setAnswers((prev) => prev!.map((x) => x.id === a.id ? { ...x, answer_text: text, is_unknown: unknown } : x))} />
        ))}
      </div>

      {isLast && (
        <div className="panel mt-8 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold">מה צריך לברר</h2>
            <span className="text-sm muted num">{unknowns} סומנו &quot;לא ידוע&quot; · {total - done} בלי תשובה</span>
          </div>
          {done === total && unknowns === 0 && <p className="text-sm muted">כל השאלות נענו. זה הזמן לנסח ממצאים.</p>}
          {unknowns > 0 && (
            <ul className="space-y-1.5">
              {answers.filter((a) => a.is_unknown).map((a) => (
                <li key={a.id}>
                  <button className="text-start text-sm flex gap-2 hover:text-[var(--accent)]" onClick={() => pickDept(a.question_snapshot_json.department_code)}>
                    <span className="chip chip-mark shrink-0">לא ידוע</span>
                    <span><span className="num muted">{a.position}.</span> {a.question_snapshot_json.prompt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {done < total && (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-sm muted self-center">בלי תשובה:</span>
              {DEPARTMENTS.map((d) => ({ d, n: deptAnswers(d.code).filter((a) => !filled(a)).length })).filter((x) => x.n > 0).map(({ d, n }) => (
                <button key={d.code} className="toggle" onClick={() => pickDept(d.code)}>{d.name} <span className="num">{n}</span></button>
              ))}
            </div>
          )}
          <p className="text-xs muted">כל &quot;לא ידוע&quot; הוא ממצא פוטנציאלי — למשל, אין נתוני הכנסות זה בעצמו משהו לטפל בו.</p>
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <button className="btn-ghost" disabled={deptIdx <= 0} onClick={() => pickDept(DEPARTMENTS[deptIdx - 1].code)}>→ {deptIdx > 0 ? DEPARTMENTS[deptIdx - 1].name : "הקודם"}</button>
        {isLast
          ? <Link className="btn" href={`/b/${id}/profile`}>סיום וחזרה לפרופיל ←</Link>
          : <button className="btn" onClick={() => pickDept(DEPARTMENTS[deptIdx + 1].code)}>{DEPARTMENTS[deptIdx + 1].name} ←</button>}
      </div>
    </Shell>
  );
}

function AnswerCard(props: {
  answer: Answer; businessId: string; diagnosticId: string; isConsultant: boolean; findingCount: number;
  onFinding: () => void; onLocalChange: (text: string, unknown: boolean) => void;
}) {
  const { answer } = props;
  const q = answer.question_snapshot_json;
  const [val, setVal] = useState({ text: answer.answer_text ?? "", unknown: answer.is_unknown });
  const [showFinding, setShowFinding] = useState(false);
  const state = useAutosave(val, async (v) => {
    props.onLocalChange(v.text, v.unknown);
    const { error } = await supabase().from("diagnostic_answers")
      .update({ answer_text: v.text || null, is_unknown: v.unknown }).eq("id", answer.id);
    return !error;
  });
  const isFilled = !!val.text.trim() || val.unknown;

  return (
    <div className={`card p-4 transition ${isFilled ? "" : "border-dashed"} focus-within:border-[var(--accent)]`}>
      <div className="flex justify-between gap-3 mb-3">
        <label className="font-semibold text-[17px] leading-snug" htmlFor={`a-${answer.id}`}>
          <span className="num text-[var(--accent)] me-2">{answer.position}</span>{q.prompt}
        </label>
        <SaveBadge state={state} />
      </div>
      {q.type === "single_select" && q.options ? (
        <div className="seg" role="radiogroup">
          {q.options.map((o) => (
            <button key={o} type="button" role="radio" aria-checked={val.text === o} aria-pressed={val.text === o}
              onClick={() => setVal({ ...val, text: val.text === o ? "" : o })}>{o}</button>
          ))}
        </div>
      ) : (
        <textarea id={`a-${answer.id}`} className="input" rows={q.type === "number" ? 1 : 3}
          inputMode={q.type === "number" ? "decimal" : undefined} placeholder={q.type === "number" ? "מספר" : "התשובה במילים שלה…"}
          value={val.text} onChange={(e) => setVal({ ...val, text: e.target.value })} />
      )}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button type="button" className="toggle" aria-pressed={val.unknown} onClick={() => setVal({ ...val, unknown: !val.unknown })}>
          {val.unknown ? "✓ " : ""}לא ידוע / לבדוק
        </button>
        {props.isConsultant && !showFinding && (
          <button className="toggle" onClick={() => setShowFinding(true)}>+ ממצא</button>
        )}
        {props.findingCount > 0 && <span className="chip">{props.findingCount} ממצאים</span>}
      </div>
      {showFinding && (
        <div className="mt-3">
          <FindingForm businessId={props.businessId} diagnosticId={props.diagnosticId} answerId={answer.id}
            defaultDept={q.department_code} defaultEvidence={val.text}
            onDone={() => { setShowFinding(false); props.onFinding(); }} />
        </div>
      )}
    </div>
  );
}
