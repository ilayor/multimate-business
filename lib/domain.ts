export const DEPARTMENTS = [
  { code: "marketing", name: "שיווק" },
  { code: "sales", name: "מכירות" },
  { code: "product", name: "מוצר" },
  { code: "service", name: "שירות לקוחות" },
  { code: "finance", name: "ניהול ופיננסים" },
] as const;

/** CSS colour token for a department, used by DeptChip. */
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

export const ASSIGNEES = ["אורית", "עילאי", "שנינו"] as const;

export type Task = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  department_code: string | null;
  assignee_name: string | null;
  due_on: string | null;
  priority: number;
  status: string;
  completed_at: string | null;
  archived_at: string | null;
  position: number;
  created_at: string;
};

export const isOpenTask = (t: Pick<Task, "status">) => t.status !== "done" && t.status !== "canceled";
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString("he-IL", opts);
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
export function relDay(iso: string) {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso), n = new Date();
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
