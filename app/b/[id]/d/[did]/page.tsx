"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell, SaveBadge } from "@/components/Shell";
import { useAutosave } from "@/components/useAutosave";
import { FindingForm } from "@/components/biz/FindingForm";
import { DEPARTMENTS } from "@/lib/domain";

type Snapshot = { department_code: string; type: string; prompt: string; options: string[] | null };
type Answer = { id: string; position: number; question_snapshot_json: Snapshot; answer_text: string | null; is_unknown: boolean };
type Diag = { id: string; template_title: string; state: string; business_id: string };

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
    window.scrollTo({ top: 0 });
  }

  async function toggleComplete() {
    if (!diag) return;
    const completed = diag.state !== "completed";
    const { error } = await supabase().from("diagnostics")
      .update({ state: completed ? "completed" : "in_progress", completed_at: completed ? new Date().toISOString() : null })
      .eq("id", did);
    if (!error) setDiag({ ...diag, state: completed ? "completed" : "in_progress" });
  }

  if (!user || !answers || !diag) return <Shell><p className="text-gray-500">טוען…</p></Shell>;

  const progress = (code: string) => {
    const list = answers.filter((a) => a.question_snapshot_json.department_code === code);
    const done = list.filter((a) => (a.answer_text ?? "").trim() || a.is_unknown).length;
    return `${done}/${list.length}`;
  };
  const visible = answers.filter((a) => a.question_snapshot_json.department_code === dept);
  const deptIdx = DEPARTMENTS.findIndex((d) => d.code === dept);

  return (
    <Shell crumbs={<Link href={`/b/${id}`} className="underline">חזרה לעסק</Link>}>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">{diag.template_title}</h1>
        {isConsultant && (
          <button className="btn-ghost" onClick={toggleComplete}>
            {diag.state === "completed" ? "פתיחה מחדש" : "סימון האבחון כהושלם ✓"}
          </button>
        )}
      </div>
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {DEPARTMENTS.map((d) => (
          <button key={d.code} onClick={() => pickDept(d.code)}
            className={`px-3 py-2 rounded-xl border whitespace-nowrap ${dept === d.code ? "bg-[var(--accent)] text-white border-transparent" : "bg-white border-[var(--line)]"}`}>
            {d.name} <span className="text-xs opacity-75">{progress(d.code)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {visible.map((a) => (
          <AnswerCard key={a.id} answer={a} businessId={id} diagnosticId={did} isConsultant={isConsultant}
            findingCount={findingCounts[a.id] ?? 0} onFinding={loadFindings}
            onLocalChange={(text, unknown) => setAnswers((prev) => prev!.map((x) => x.id === a.id ? { ...x, answer_text: text, is_unknown: unknown } : x))} />
        ))}
      </div>
      <div className="flex justify-between mt-6">
        <button className="btn-ghost" disabled={deptIdx <= 0} onClick={() => pickDept(DEPARTMENTS[deptIdx - 1].code)}>→ הקודם</button>
        <button className="btn" disabled={deptIdx >= DEPARTMENTS.length - 1} onClick={() => pickDept(DEPARTMENTS[deptIdx + 1].code)}>הבא ←</button>
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

  return (
    <div className="card">
      <div className="flex justify-between gap-3 mb-2">
        <label className="font-medium" htmlFor={`a-${answer.id}`}>{answer.position}. {q.prompt}</label>
        <SaveBadge state={state} />
      </div>
      {q.type === "single_select" && q.options ? (
        <div className="flex gap-2 flex-wrap">
          {q.options.map((o) => (
            <button key={o} type="button" onClick={() => setVal({ ...val, text: o })}
              className={`min-w-10 h-10 px-3 rounded-lg border ${val.text === o ? "bg-[var(--accent)] text-white" : "bg-white"}`}>{o}</button>
          ))}
        </div>
      ) : (
        <textarea id={`a-${answer.id}`} className="input" rows={q.type === "number" ? 1 : 3}
          inputMode={q.type === "number" ? "decimal" : undefined}
          value={val.text} onChange={(e) => setVal({ ...val, text: e.target.value })} />
      )}
      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={val.unknown} onChange={(e) => setVal({ ...val, unknown: e.target.checked })} />
          לא ידוע / צריך לבדוק
        </label>
        {props.isConsultant && (
          <button className="text-[var(--accent)] font-semibold" onClick={() => setShowFinding(true)}>+ ממצא מהתשובה</button>
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
