"use client";
import { usePref, useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { Chips, Fab, PageTop, SwipeRow } from "@/components/crm/kit";
import { Check, DeptChip, Empty } from "@/components/ui";
import { DEPARTMENTS, relDay, todayISO, type Task } from "@/lib/domain";
import { live } from "@/lib/crm";

const COLS = [
  { value: "todo", label: "לביצוע" },
  { value: "in_progress", label: "בתהליך" },
  { value: "done", label: "בוצע" },
] as const;
type Col = (typeof COLS)[number]["value"];

export default function TasksPage() {
  const { data, update, archive } = useCrm();
  const open = useSheets();
  const [dept, setDept] = usePref<string>("tasks.dept", "all");
  const [status, setStatus] = usePref<Col>("tasks.status", "todo");
  const today = todayISO();
  const all = live(data.tasks).filter((t) => t.status !== "canceled" && (dept === "all" || (t.department_code ?? "") === dept));
  const colOf = (t: Task): Col => (t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : "todo");
  const sorted = (xs: Task[]) => xs.sort((a, b) => (a.due_on ?? "9").localeCompare(b.due_on ?? "9") || a.position - b.position);
  const inCol = (c: Col) => sorted(all.filter((t) => colOf(t) === c));
  const deptCount = (code: string) => live(data.tasks).filter((t) => t.status !== "done" && t.status !== "canceled" && (t.department_code ?? "") === code).length;
  const openCount = all.filter((t) => colOf(t) !== "done").length;

  const toggle = (t: Task) => update("tasks", t.id, { status: t.status === "done" ? "todo" : "done" });
  const row = (t: Task) => {
    const late = !!t.due_on && t.due_on < today && t.status !== "done";
    return (
      <SwipeRow key={t.id} onOpen={() => open({ kind: "task", task: t })} actions={[
        ...(t.status !== "in_progress" && t.status !== "done" ? [{ label: "בתהליך", icon: "clock", color: "var(--mark)", onClick: () => update("tasks", t.id, { status: "in_progress" }) }] : []),
        { label: "ארכיון", icon: "archive", color: "var(--muted)", onClick: () => archive("tasks", t.id, "משימה") },
      ]}>
        <Check done={t.status === "done"} onToggle={() => toggle(t)} label={t.status === "done" ? `החזרה לביצוע: ${t.title}` : `סימון כבוצע: ${t.title}`} />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold leading-snug ${t.status === "done" ? "line-through muted" : ""}`}>{t.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <DeptChip code={t.department_code} />
            {t.due_on && <span className={`caption num ${late ? "!text-[var(--bad)] font-bold" : ""}`}>{late ? "באיחור · " : ""}{relDay(t.due_on)}</span>}
            {t.assignee_name && t.assignee_name !== "אורית" && <span className="caption">{t.assignee_name}</span>}
          </div>
        </div>
      </SwipeRow>
    );
  };

  return (
    <div className="space-y-4">
      <PageTop title="משימות" sub={`${openCount} פתוחות`} action={<Fab label="משימה" onClick={() => open({ kind: "task", preset: { department_code: dept === "all" ? null : dept } })} />} />
      <Chips label="תחום" value={dept} onChange={setDept} options={[
        { value: "all", label: "הכול" }, ...DEPARTMENTS.map((d) => ({ value: d.code as string, label: d.name, count: deptCount(d.code) })),
        ...(deptCount("") ? [{ value: "", label: "כללי", count: deptCount("") }] : []),
      ]} />

      {/* phone: one status at a time */}
      <div className="md:hidden space-y-3">
        <div className="seg w-full" role="group" aria-label="סטטוס">
          {COLS.map((c) => (
            <button key={c.value} type="button" className="flex-1" aria-pressed={status === c.value} onClick={() => setStatus(c.value)}>
              {c.label} <span className="num opacity-60">{inCol(c.value).length}</span>
            </button>
          ))}
        </div>
        {inCol(status).length ? <div className="list-group">{inCol(status).map(row)}</div>
          : <Empty icon="check" title={status === "done" ? "עוד לא סומנו משימות כבוצעו" : "אין משימות כאן"}>{status === "todo" && "מוסיפים משימה בכפתור +."}</Empty>}
      </div>

      {/* desktop: board */}
      <div className="hidden md:grid grid-cols-3 gap-4 items-start">
        {COLS.map((c) => (
          <section key={c.value} className="space-y-2 min-w-0">
            <h2 className="text-[13px] font-bold muted px-1">{c.label} <span className="num opacity-70">{inCol(c.value).length}</span></h2>
            {inCol(c.value).length ? <div className="list-group">{inCol(c.value).map(row)}</div> : <div className="empty text-sm">ריק</div>}
          </section>
        ))}
      </div>
    </div>
  );
}
