export const DEPARTMENTS = [
  { code: "strategy", name: "אסטרטגיה" },
  { code: "finance", name: "כספים ורגולציה" },
  { code: "product", name: "מוצר / שירות" },
  { code: "marketing", name: "שיווק" },
  { code: "sales", name: "מכירות" },
  { code: "service", name: "שירות ושימור" },
] as const;

export const deptName = (code: string | null | undefined) =>
  DEPARTMENTS.find((d) => d.code === code)?.name ?? "—";

export const TASK_STATUS: Record<string, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  blocked: "חסום",
  done: "בוצע",
  canceled: "בוטל",
};

export const FINDING_STATUS: Record<string, string> = {
  open: "פתוח",
  in_progress: "בטיפול",
  resolved: "נפתר",
  dismissed: "נדחה",
};

export type Finding = {
  id: string;
  title: string;
  department_code: string | null;
  evidence: string | null;
  rationale: string | null;
  impact: number;
  urgency: number;
  effort: number;
  is_blocker: boolean;
  priority_override: number | null;
  priority_override_reason: string | null;
  status: string;
  answer_id: string | null;
  created_at: string;
};

// Heuristic only (PRD 4.4): blockers first, then (impact + urgency) relative to effort.
// A manual override, which requires a reason, wins. Not an objective ranking.
export function priorityScore(f: Finding): number {
  if (f.priority_override != null) return f.priority_override;
  const base = (f.impact + f.urgency) / f.effort;
  return (f.is_blocker ? 100 : 0) + base;
}

export type Task = {
  id: string;
  title: string;
  description: string | null;
  done_definition: string | null;
  department_code: string | null;
  finding_id: string | null;
  assignee_id: string | null;
  due_on: string | null;
  priority: number;
  status: string;
  is_weekly_commitment: boolean;
  owner_comment: string | null;
  completed_at: string | null;
};
