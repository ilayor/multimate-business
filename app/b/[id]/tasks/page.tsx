"use client";
import { useEffect, useMemo, useState } from "react";
import { useBiz } from "@/components/biz2/BizContext";
import { useBizData, toggleDone } from "@/components/biz2/useBizData";
import { TaskRow } from "@/components/biz2/TaskRow";
import { TaskSheet } from "@/components/biz2/sheets";
import { Empty, Icon, PageHeader, Seg, Skeleton } from "@/components/ui";
import { DEPARTMENTS, TASK_STATUS, deptName, isOpenTask, type Task } from "@/lib/domain";

type Show = "open" | "week" | "all" | "done";
type Sort = "due" | "created" | "title" | "dept";
type Group = "none" | "dept" | "status" | "project" | "assignee";
const PREF = "mm:tasks-view";

export default function TasksPage() {
  const { biz } = useBiz();
  const { data, reload, setData } = useBizData(biz.id);
  const [show, setShow] = useState<Show>("open");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("due");
  const [group, setGroup] = useState<Group>("dept");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<{ open: boolean; task?: Task | null }>({ open: false });
  const [options, setOptions] = useState(false);

  useEffect(() => {
    try { const p = JSON.parse(localStorage.getItem(PREF) || "{}"); if (p.sort) setSort(p.sort); if (p.group) setGroup(p.group); if (p.show) setShow(p.show); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(PREF, JSON.stringify({ sort, group, show })); } catch {} }, [sort, group, show]);

  const groups = useMemo(() => {
    if (!data) return [];
    let list = data.tasks.filter((t) =>
      (show === "all" || (show === "open" ? isOpenTask(t) : show === "done" ? t.status === "done" : t.is_weekly_commitment && t.status !== "canceled")) &&
      (!dept || (t.department_code ?? "") === dept) && (!status || t.status === status) &&
      (!q.trim() || t.title.includes(q.trim())));
    const cmp: Record<Sort, (a: Task, b: Task) => number> = {
      due: (a, b) => (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999"),
      created: (a, b) => b.created_at.localeCompare(a.created_at),
      title: (a, b) => a.title.localeCompare(b.title, "he"),
      dept: (a, b) => deptName(a.department_code).localeCompare(deptName(b.department_code), "he"),
    };
    list = [...list].sort(cmp[sort]);
    if (group === "none") return [{ key: "all", title: "", items: list }];
    const keyOf = (t: Task) => group === "dept" ? deptName(t.department_code) : group === "status" ? TASK_STATUS[t.status]
      : group === "project" ? (data.projects.find((p) => p.id === t.project_id)?.title ?? "ללא פרויקט") : (t.assignee_name || "לא נקבע");
    const map = new Map<string, Task[]>();
    list.forEach((t) => map.set(keyOf(t), [...(map.get(keyOf(t)) ?? []), t]));
    return [...map.entries()].map(([title, items]) => ({ key: title, title, items }));
  }, [data, show, dept, status, sort, group, q]);

  if (!data) return <Skeleton h={60} n={5} />;
  const count = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="משימות" subtitle={`${data.tasks.filter(isOpenTask).length} פתוחות · ${data.tasks.filter((t) => t.is_weekly_commitment && isOpenTask(t)).length} בשבוע הזה`}
        actions={<button className="btn hidden md:inline-flex" onClick={() => setSheet({ open: true, task: null })}><Icon name="plus" size={18} /> משימה חדשה</button>} />

      <div className="space-y-2">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <Seg label="אילו משימות" value={show} onChange={setShow}
            options={[{ value: "open", label: "פתוחות" }, { value: "week", label: "השבוע" }, { value: "done", label: "בוצעו" }, { value: "all", label: "הכול" }]} />
        </div>
        <div className="flex gap-2">
          <input className="input flex-1 !min-h-10" type="search" placeholder="חיפוש משימה" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש" />
          <button className={`btn-tint shrink-0 ${options ? "!bg-[var(--accent)] !text-[var(--accent-ink)]" : ""}`} onClick={() => setOptions(!options)} aria-expanded={options}>
            <Icon name="sliders" size={18} /> תצוגה
          </button>
        </div>
        {options && (
          <div className="card p-3 grid gap-3 sm:grid-cols-2">
            <label className="field"><span>מחלקה</span>
              <select className="input" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">כל המחלקות</option>
                {DEPARTMENTS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </label>
            <label className="field"><span>סטטוס</span>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">כל הסטטוסים</option>
                {Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="field"><span>מיון</span>
              <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="due">לפי תאריך יעד</option><option value="created">החדשות קודם</option>
                <option value="title">א–ת</option><option value="dept">לפי מחלקה</option>
              </select>
            </label>
            <label className="field"><span>קיבוץ</span>
              <select className="input" value={group} onChange={(e) => setGroup(e.target.value as Group)}>
                <option value="none">בלי קיבוץ</option><option value="dept">מחלקה</option><option value="status">סטטוס</option>
                <option value="project">פרויקט</option><option value="assignee">אחראי</option>
              </select>
            </label>
            {(dept || status) && <button className="btn-plain text-sm sm:col-span-2 justify-self-start" onClick={() => { setDept(""); setStatus(""); }}>ניקוי סינון</button>}
          </div>
        )}
      </div>

      {count === 0 ? (
        <Empty icon="list" title={data.tasks.length === 0 ? "עוד אין משימות" : "אין משימות שמתאימות לסינון"}>{data.tasks.length === 0 ? "לחצו + כדי להוסיף את הראשונה." : "נסו לשנות את הסינון."}</Empty>
      ) : groups.map((g) => (
        <section key={g.key} className="space-y-2">
          {g.title && <h2 className="eyebrow px-1 flex justify-between"><span>{g.title}</span><span className="num">{g.items.length}</span></h2>}
          <div className="list-group">
            {g.items.map((t) => <TaskRow key={t.id} t={t} projects={data.projects} onToggle={() => toggleDone(t, setData)} onOpen={() => setSheet({ open: true, task: t })} />)}
          </div>
        </section>
      ))}

      {/* floating add on phones, above the tab bar */}
      <button className="md:hidden fixed z-20 end-4 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] grid place-items-center shadow-lg active:scale-95 transition-transform"
        aria-label="משימה חדשה" onClick={() => setSheet({ open: true, task: null })}><Icon name="plus" size={26} /></button>

      <TaskSheet open={sheet.open} onClose={() => setSheet({ open: false })} businessId={biz.id} task={sheet.task}
        preset={{ department_code: dept || null, is_weekly_commitment: show === "week" }} projects={data.projects} onSaved={reload} />
    </div>
  );
}
