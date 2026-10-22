"use client";
import { Check, Icon } from "@/components/ui";
import { deptName, fmtDate, isOpenTask, todayISO, TASK_STATUS, type Project, type Task } from "@/lib/domain";

export function TaskRow({ t, projects, onToggle, onOpen, showWeekly = true }: {
  t: Task; projects: Project[]; onToggle: () => void; onOpen: () => void; showWeekly?: boolean;
}) {
  const done = t.status === "done";
  const late = !!t.due_on && t.due_on < todayISO() && isOpenTask(t);
  const project = projects.find((p) => p.id === t.project_id);
  return (
    <div className={`row cursor-pointer transition-colors ${done ? "bg-[var(--done-soft)]" : "hover:bg-[var(--surface-2)]"}`} onClick={onOpen}>
      <Check done={done} onToggle={onToggle} label={done ? `סמן כלא בוצע: ${t.title}` : `סמן כבוצע: ${t.title}`} />
      <div className="flex-1 min-w-0">
        <div className={`font-semibold leading-snug ${done ? "line-through text-[var(--done)]" : ""}`}>{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          <span className="chip">{deptName(t.department_code)}</span>
          {project && <span className="chip chip-accent max-w-[160px] truncate">{project.title}</span>}
          {t.status === "blocked" && <span className="chip chip-bad">{TASK_STATUS.blocked}</span>}
          {t.status === "in_progress" && <span className="chip chip-mark">{TASK_STATUS.in_progress}</span>}
          {t.due_on && <span className={`caption num ${late ? "!text-[var(--bad)] font-bold" : ""}`}>{late ? "באיחור · " : ""}{fmtDate(t.due_on)}</span>}
          {t.assignee_name && <span className="caption">{t.assignee_name}</span>}
        </div>
      </div>
      {showWeekly && t.is_weekly_commitment && !done && <Icon name="star" size={18} className="text-[var(--mark)]" />}
    </div>
  );
}
