"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Meeting, Milestone, Project, Task } from "@/lib/domain";

export type BizData = { tasks: Task[]; projects: Project[]; milestones: Milestone[]; meetings: Meeting[] };

/** Everything a business screen needs, loaded together; `reload` after any write. */
export function useBizData(businessId: string) {
  const [data, setData] = useState<BizData | null>(null);
  const reload = useCallback(async () => {
    const sb = supabase();
    const [{ data: t }, { data: p }, { data: ms }, { data: m }] = await Promise.all([
      sb.from("tasks").select("*").eq("business_id", businessId).is("archived_at", null).order("position").order("created_at"),
      sb.from("projects").select("*").eq("business_id", businessId).is("archived_at", null).order("position").order("created_at"),
      sb.from("project_milestones").select("*").eq("business_id", businessId).order("position").order("created_at"),
      sb.from("meetings").select("*").eq("business_id", businessId).is("archived_at", null).order("scheduled_at"),
    ]);
    setData({ tasks: (t as Task[]) ?? [], projects: (p as Project[]) ?? [], milestones: (ms as Milestone[]) ?? [], meetings: (m as Meeting[]) ?? [] });
  }, [businessId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, reload, setData };
}

/** Optimistic status toggle shared by every task list. */
export async function toggleDone(task: Task, setData: (fn: (d: BizData | null) => BizData | null) => void) {
  const status = task.status === "done" ? "todo" : "done";
  setData((d) => d && { ...d, tasks: d.tasks.map((t) => t.id === task.id ? { ...t, status, completed_at: status === "done" ? new Date().toISOString() : null } : t) });
  const { error } = await supabase().from("tasks").update({ status }).eq("id", task.id);
  if (error) setData((d) => d && { ...d, tasks: d.tasks.map((t) => t.id === task.id ? task : t) });
}
