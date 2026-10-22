"use client";
import Link from "next/link";
import { useState } from "react";
import { useBiz } from "@/components/biz2/BizContext";
import { useBizData } from "@/components/biz2/useBizData";
import { ProjectSheet } from "@/components/biz2/sheets";
import { Icon, Skeleton } from "@/components/ui";
import { DEPARTMENTS, deptName, isOpenTask, nextTaskOf, pct, projectProgress, fmtDate } from "@/lib/domain";

export default function ProjectsPage() {
  const { biz } = useBiz();
  const { data, reload } = useBizData(biz.id);
  const [sheet, setSheet] = useState<{ open: boolean; dept?: string }>({ open: false });
  if (!data) return <Skeleton h={110} />;

  const byDept = [...DEPARTMENTS.map((d) => d.code as string), ""].map((code) => ({
    code, name: code ? deptName(code) : "כללי",
    items: data.projects.filter((p) => (p.department_code ?? "") === code),
  }));
  const used = byDept.filter((g) => g.items.length);
  const unused = byDept.filter((g) => !g.items.length && g.code);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="large-title">פרויקטים</h1>
          <p className="caption mt-1">לכל מחלקה: מאיפה מתחילים, לאן רוצים להגיע, ואילו צעדים בדרך.</p>
        </div>
        <button className="btn shrink-0" onClick={() => setSheet({ open: true })}><Icon name="plus" size={18} /> פרויקט</button>
      </div>

      {data.projects.length === 0 && (
        <div className="empty">
          <div className="font-bold text-[var(--ink)]">עוד אין פרויקטים</div>
          <div className="text-sm mt-1">פרויקט הוא שינוי אחד שרוצים להשיג, למשל "לבנות תהליך מכירה מסודר". בחרו מחלקה כדי להתחיל.</div>
        </div>
      )}

      {used.map((g) => (
        <section key={g.code || "general"} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="eyebrow">{g.name}</h2>
            <button className="btn-plain text-sm" onClick={() => setSheet({ open: true, dept: g.code })}>+ בתחום הזה</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((p) => {
              const prog = projectProgress(p, data.milestones, data.tasks);
              const next = nextTaskOf(p.id, data.tasks);
              const ms = data.milestones.filter((m) => m.project_id === p.id);
              const open = data.tasks.filter((t) => t.project_id === p.id && isOpenTask(t)).length;
              return (
                <Link key={p.id} href={`/b/${biz.id}/projects/${p.id}`} className="card p-4 space-y-3 active:scale-[.99] transition-transform">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-[17px] leading-snug">{p.title}</div>
                      {p.goal && <div className="caption line-clamp-2 mt-0.5">{p.goal}</div>}
                    </div>
                    <div className={`num text-2xl font-extrabold shrink-0 ${prog === 1 ? "text-[var(--done)]" : ""}`}>{pct(prog)}</div>
                  </div>
                  <div className={`bar ${prog === 1 ? "done" : ""}`}><span style={{ width: `${(prog ?? 0) * 100}%` }} /></div>
                  <div className="flex flex-wrap gap-2 caption">
                    {ms.length > 0 && <span>{ms.filter((m) => m.done).length}/{ms.length} תת-יעדים</span>}
                    <span>{open} משימות פתוחות</span>
                    {p.target_date && <span>יעד: {fmtDate(p.target_date)}</span>}
                  </div>
                  {next && <div className="text-sm border-t border-[var(--line)] pt-2"><span className="muted">הבא: </span><span className="font-semibold">{next.title}</span></div>}
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      {unused.length > 0 && (
        <section className="space-y-2">
          <h2 className="eyebrow px-1">מחלקות בלי פרויקט</h2>
          <div className="flex flex-wrap gap-2">
            {unused.map((g) => <button key={g.code} className="btn-tint" onClick={() => setSheet({ open: true, dept: g.code })}><Icon name="plus" size={16} /> {g.name}</button>)}
          </div>
        </section>
      )}

      <ProjectSheet open={sheet.open} onClose={() => setSheet({ open: false })} businessId={biz.id} defaultDept={sheet.dept}
        nextPosition={data.projects.length} onSaved={reload} />
    </div>
  );
}
