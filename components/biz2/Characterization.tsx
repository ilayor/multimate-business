"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DEPARTMENTS, deptVar } from "@/lib/domain";
import { Empty, Icon, SaveState, Skeleton, useAutosave, useToast } from "@/components/ui";

type Snap = { department_code: string; type: string; prompt: string; options: string[] | null };
type Answer = { id: string; position: number; question_snapshot_json: Snap; answer_text: string | null; is_unknown: boolean };
const filled = (a: Answer) => !!(a.answer_text ?? "").trim() || a.is_unknown;

/**
 * The initial characterization questionnaire (stored as a diagnostic with snapshotted questions).
 * Shown in the business profile and inside the first meeting; both edit the same answers.
 */
export function Characterization({ businessId, canEdit, compact }: { businessId: string; canEdit: boolean; compact?: boolean }) {
  const toast = useToast();
  const [diagId, setDiagId] = useState<string | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [dept, setDept] = useState<string>("strategy");
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await supabase().from("diagnostics").select("id").eq("business_id", businessId).order("started_at", { ascending: false }).limit(1);
    const id = d?.[0]?.id ?? null;
    setDiagId(id);
    if (!id) return;
    const { data } = await supabase().from("diagnostic_answers").select("id,position,question_snapshot_json,answer_text,is_unknown").eq("diagnostic_id", id).order("position");
    setAnswers((data as Answer[]) ?? []);
  }, [businessId]);
  useEffect(() => { load(); }, [load]);

  async function start() {
    setStarting(true);
    const { data: t } = await supabase().from("questionnaire_templates").select("id").eq("active", true).order("created_at").limit(1);
    if (!t?.[0]) { toast("לא נמצא שאלון פעיל"); setStarting(false); return; }
    const { error } = await supabase().rpc("start_diagnostic", { p_business: businessId, p_template: t[0].id });
    setStarting(false);
    if (error) toast("לא הצלחנו להתחיל את האפיון. נסו שוב.");
    else load();
  }

  if (diagId === undefined) return <Skeleton h={70} n={2} />;
  if (diagId === null) return (
    <Empty icon="note" title="עוד לא מילאתם אפיון ראשוני">
      30 שאלות קצרות ב-6 תחומים: אסטרטגיה, כספים, מוצר, שיווק, מכירות ושירות. אפשר לעצור ולהמשיך בכל רגע.
      {canEdit && <div className="mt-3"><button className="btn" disabled={starting} onClick={start}>{starting ? "מתחיל…" : "התחלת אפיון"}</button></div>}
    </Empty>
  );

  const total = answers.length, done = answers.filter(filled).length, unknown = answers.filter((a) => a.is_unknown).length;
  const visible = answers.filter((a) => a.question_snapshot_json.department_code === dept);
  const idx = DEPARTMENTS.findIndex((d) => d.code === dept);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="ring" style={{ ["--p" as string]: total ? Math.round((done / total) * 100) : 0 }}><span>{total ? Math.round((done / total) * 100) : 0}%</span></div>
        <div className="min-w-0">
          <div className="font-bold num">{done} מתוך {total} שאלות</div>
          <div className="caption">{unknown ? `${unknown} סומנו "לא ידוע" — שווה לברר` : "כל תשובה נשמרת מיד"}</div>
        </div>
      </div>

      <div className={`flex gap-1.5 overflow-x-auto pb-1 ${compact ? "" : "-mx-1 px-1"}`} role="tablist" aria-label="תחומים">
        {DEPARTMENTS.map((d) => {
          const list = answers.filter((a) => a.question_snapshot_json.department_code === d.code);
          const n = list.filter(filled).length, on = dept === d.code, complete = n === list.length && list.length > 0;
          return (
            <button key={d.code} role="tab" aria-selected={on} onClick={() => setDept(d.code)}
              style={{ ["--c" as string]: deptVar(d.code) }}
              className={`shrink-0 h-9 px-3 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-colors ${on ? "bg-[var(--c)] text-white" : "bg-[var(--surface-2)] text-[var(--ink-2)]"}`}>
              {complete && !on ? <Icon name="check" size={14} /> : null}{d.name} <span className="num opacity-75 text-xs">{n}/{list.length}</span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {visible.map((a) => <Question key={a.id} a={a} canEdit={canEdit}
          onLocal={(text, unk) => setAnswers((prev) => prev.map((x) => x.id === a.id ? { ...x, answer_text: text, is_unknown: unk } : x))} />)}
      </div>

      <div className="flex justify-between pt-1">
        <button className="btn-plain text-sm" disabled={idx <= 0} onClick={() => setDept(DEPARTMENTS[idx - 1].code)}><Icon name="back" size={18} /> {idx > 0 ? DEPARTMENTS[idx - 1].name : ""}</button>
        <button className="btn-plain text-sm" disabled={idx >= DEPARTMENTS.length - 1} onClick={() => setDept(DEPARTMENTS[idx + 1].code)}>{idx < DEPARTMENTS.length - 1 ? DEPARTMENTS[idx + 1].name : ""} <Icon name="forward" size={18} /></button>
      </div>
    </div>
  );
}

function Question({ a, canEdit, onLocal }: { a: Answer; canEdit: boolean; onLocal: (text: string, unknown: boolean) => void }) {
  const q = a.question_snapshot_json;
  const [v, setV] = useState({ text: a.answer_text ?? "", unknown: a.is_unknown });
  const state = useAutosave(v, async (val) => {
    onLocal(val.text, val.unknown);
    const { error } = await supabase().from("diagnostic_answers").update({ answer_text: val.text || null, is_unknown: val.unknown }).eq("id", a.id);
    return !error;
  });
  const isFilled = !!v.text.trim() || v.unknown;
  return (
    <div className={`rounded-2xl p-3.5 space-y-2 transition-colors ${isFilled ? "bg-[var(--surface)] shadow-[var(--shadow)]" : "bg-[var(--surface-2)]"}`}>
      <div className="flex items-start justify-between gap-3">
        <label htmlFor={`q-${a.id}`} className="font-semibold leading-snug"><span className="num text-[var(--accent)] me-1.5">{a.position}</span>{q.prompt}</label>
        <SaveState state={state} />
      </div>
      {q.type === "single_select" && q.options ? (
        <div className="seg" role="radiogroup" aria-label={q.prompt}>
          {q.options.map((o) => <button key={o} type="button" disabled={!canEdit} aria-pressed={v.text === o} onClick={() => setV({ ...v, text: v.text === o ? "" : o })}>{o}</button>)}
        </div>
      ) : (
        <textarea id={`q-${a.id}`} className="input !min-h-[52px] !bg-[var(--surface)]" readOnly={!canEdit} rows={q.type === "number" ? 1 : 2}
          inputMode={q.type === "number" ? "decimal" : undefined} placeholder="התשובה…" value={v.text} onChange={(e) => setV({ ...v, text: e.target.value })} />
      )}
      {canEdit && (
        <button type="button" onClick={() => setV({ ...v, unknown: !v.unknown })} aria-pressed={v.unknown}
          className={`text-[13px] font-semibold rounded-full px-3 h-8 inline-flex items-center gap-1 ${v.unknown ? "bg-[var(--mark-soft)] text-[var(--mark)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)]"}`}>
          {v.unknown ? <Icon name="check" size={14} /> : null} לא ידוע / לבדוק
        </button>
      )}
    </div>
  );
}
