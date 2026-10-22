export const DEPARTMENTS = [
  { code: "strategy", name: "אסטרטגיה" },
  { code: "finance", name: "כספים" },
  { code: "product", name: "מוצר ושירות" },
  { code: "marketing", name: "שיווק" },
  { code: "sales", name: "מכירות" },
  { code: "service", name: "שירות לקוחות" },
] as const;

/** CSS colour token for a department, used by DeptChip and project stripes. */
export const deptVar = (code: string | null | undefined) =>
  `var(--d-${DEPARTMENTS.some((d) => d.code === code) ? code : "general"})`;

export const deptName = (code: string | null | undefined) =>
  DEPARTMENTS.find((d) => d.code === code)?.name ?? "כללי";

export const TASK_STATUS: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  blocked: "תקוע",
  done: "בוצע",
  canceled: "בוטל",
};

export const ASSIGNEES = ["אורית", "עילאי", "שניהם"] as const;

export type Task = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  department_code: string | null;
  project_id: string | null;
  milestone_id: string | null;
  assignee_name: string | null;
  due_on: string | null;
  priority: number;
  status: string;
  is_weekly_commitment: boolean;
  completed_at: string | null;
  archived_at: string | null;
  position: number;
  created_at: string;
};

export type Project = {
  id: string;
  business_id: string;
  department_code: string | null;
  title: string;
  current_state: string | null;
  goal: string | null;
  unit: string | null;
  baseline: number | null;
  current_value: number | null;
  target: number | null;
  target_date: string | null;
  status: string;
  position: number;
  archived_at: string | null;
};

export type Milestone = { id: string; project_id: string; business_id: string; title: string; done: boolean; position: number };

export type Meeting = {
  id: string;
  business_id: string;
  title: string | null;
  scheduled_at: string;
  duration_minutes: number;
  location: string | null;
  notes_current: string | null;
  notes_last_week: string | null;
  notes_progress: string | null;
  notes_problems: string | null;
  notes_goals: string | null;
  completed_at: string | null;
  archived_at: string | null;
};

export type Business = {
  id: string;
  name: string;
  profession: string | null;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_path: string | null;
};

export const isOpenTask = (t: Pick<Task, "status">) => t.status !== "done" && t.status !== "canceled";
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * Progress toward a project's goal, 0–1, or null when it cannot be known.
 * A numeric goal (baseline → target, with a current value) wins; otherwise the share of
 * finished sub-goals, then of finished tasks. Never invents a 0 for missing data.
 */
export function projectProgress(p: Project, milestones: Milestone[], tasks: Task[]): number | null {
  const { baseline, target, current_value } = p;
  if (baseline != null && target != null && current_value != null && Number(target) !== Number(baseline)) {
    const v = (Number(current_value) - Number(baseline)) / (Number(target) - Number(baseline));
    return Math.max(0, Math.min(1, v));
  }
  const ms = milestones.filter((m) => m.project_id === p.id);
  if (ms.length) return ms.filter((m) => m.done).length / ms.length;
  const ts = tasks.filter((t) => t.project_id === p.id && t.status !== "canceled" && !t.archived_at);
  if (ts.length) return ts.filter((t) => t.status === "done").length / ts.length;
  return null;
}

export const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export function nextTaskOf(projectId: string, tasks: Task[]): Task | undefined {
  return tasks
    .filter((t) => t.project_id === projectId && isOpenTask(t) && !t.archived_at)
    .sort((a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") || a.position - b.position)[0];
}

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("he-IL", opts);
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
export function relDay(iso: string) {
  const d = new Date(iso), n = new Date();
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(n.toDateString()).getTime()) / 864e5);
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  if (days === -1) return "אתמול";
  return fmtDate(iso, { weekday: "short", day: "numeric", month: "short" });
}

// datetime-local wants local wall time
export function toLocalInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
