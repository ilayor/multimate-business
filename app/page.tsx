"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell, Loading } from "@/components/Shell";
import { isOpenTask, priorityLevel, todayISO, type Finding, type Task } from "@/lib/domain";

type Biz = { id: string; name: string; description: string | null };
type Status = {
  diag: { id: string; state: string } | null;
  answered: number;
  total: number;
  p1: number;
  openFindings: number;
  weekly: number;
  overdue: Task[];
  nextMeeting: string | null;
};
type Attention = { key: string; bizId: string; bizName: string; text: string; tone: "bad" | "mark" | "plain"; href: string };

const greeting = () => {
  const h = new Date().getHours();
  return h < 5 ? "לילה טוב" : h < 12 ? "בוקר טוב" : h < 17 ? "צהריים טובים" : h < 21 ? "ערב טוב" : "לילה טוב";
};
const dayLabel = (iso: string) => {
  const d = new Date(iso), now = new Date();
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 864e5);
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return `היום ${time}`;
  if (days === 1) return `מחר ${time}`;
  return `${d.toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "short" })} ${time}`;
};

export default function Home() {
  const user = useRequireUser();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [isConsultant, setIsConsultant] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const sb = supabase();
      const [{ data: biz }, { data: org }, { data: prof }, { data: mem }] = await Promise.all([
        sb.from("businesses").select("id,name,description").order("created_at"),
        sb.from("organizations").select("id,name"),
        sb.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        sb.from("business_memberships").select("business_id,role").eq("user_id", user.id),
      ]);
      const list = (biz as Biz[]) ?? [];
      const consultant = (mem ?? []).some((m: { role: string }) => m.role === "consultant");
      setOrgs(org ?? []);
      setName(prof?.display_name ?? "");
      setIsConsultant(consultant);
      // A business owner has one business and no consultant view: take them straight to it.
      if (!consultant && list.length === 1) { router.replace(`/b/${list[0].id}`); return; }
      setBusinesses(list);
      if (list.length) setStatus(await loadStatus(list.map((b) => b.id)));
    })();
  }, [user, router]);

  async function create() {
    if (!newName.trim() || !orgs[0]) return;
    const { data, error } = await supabase().rpc("create_business", { p_org: orgs[0].id, p_name: newName.trim() });
    if (!error && data) router.push(`/b/${data}`);
  }

  if (!user || businesses === null) return <Shell wide><Loading /></Shell>;

  const attention: Attention[] = businesses.flatMap((b) => {
    const s = status[b.id];
    if (!s) return [];
    const items: Attention[] = s.overdue.map((t) => ({ key: t.id, bizId: b.id, bizName: b.name, text: `באיחור: ${t.title}`, tone: "bad" as const, href: `/b/${b.id}#tasks` }));
    if (s.p1) items.push({ key: `${b.id}-p1`, bizId: b.id, bizName: b.name, text: s.p1 === 1 ? "ממצא דחוף (P1) פתוח" : `${s.p1} ממצאים דחופים (P1) פתוחים`, tone: "bad", href: `/b/${b.id}#findings` });
    if (!s.diag) items.push({ key: `${b.id}-d`, bizId: b.id, bizName: b.name, text: "עוד לא התחיל אבחון", tone: "mark", href: `/b/${b.id}#diagnostics` });
    else if (s.diag.state !== "completed" && s.answered < s.total)
      items.push({ key: `${b.id}-d`, bizId: b.id, bizName: b.name, text: `אבחון באמצע (${s.answered}/${s.total})`, tone: "mark", href: `/b/${b.id}/d/${s.diag.id}` });
    if (s.diag && s.weekly === 0) items.push({ key: `${b.id}-w`, bizId: b.id, bizName: b.name, text: "אין התחייבויות לשבוע", tone: "mark", href: `/b/${b.id}#tasks` });
    if (s.diag && !s.nextMeeting) items.push({ key: `${b.id}-m`, bizId: b.id, bizName: b.name, text: "לא נקבעה פגישה הבאה", tone: "plain", href: `/b/${b.id}#meetings` });
    return items;
  });
  const upcoming = businesses
    .map((b) => ({ b, at: status[b.id]?.nextMeeting }))
    .filter((x): x is { b: Biz; at: string } => !!x.at)
    .sort((a, b) => a.at.localeCompare(b.at));

  return (
    <Shell wide>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1 className="text-4xl font-bold mt-1">{greeting()}{name ? `, ${name}` : ""}</h1>
        </div>
        {isConsultant && orgs.length > 0 && !adding && <button className="btn-ghost" onClick={() => setAdding(true)}>+ עסק חדש</button>}
      </div>

      {adding && (
        <form className="panel mb-8 flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); create(); }}>
          <div className="flex-1 min-w-[220px]">
            <label className="label" htmlFor="newbiz">שם העסק</label>
            <input id="newbiz" className="input" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="למשל: הסטודיו של דנה" />
          </div>
          <button className="btn" disabled={!newName.trim()}>יצירה ומעבר לעסק</button>
          <button type="button" className="btn-ghost" onClick={() => { setAdding(false); setNewName(""); }}>ביטול</button>
        </form>
      )}

      {businesses.length === 0 ? (
        <div className="empty py-12">
          <p className="font-bold text-[var(--ink)] text-lg">עוד אין עסקים בליווי</p>
          <p className="mt-1">{isConsultant ? "התחילו ב\"+ עסק חדש\". כל עסק מקבל אבחון, ממצאים, משימות ופגישות משלו." : "אין עדיין עסק משויך לחשבון הזה. פנו ליועץ שהזמין אתכם."}</p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4 min-w-0">
            <h2 className="text-xl font-bold">העסקים בליווי <span className="num muted text-base font-normal font-[family-name:var(--font-body)]">{businesses.length}</span></h2>
            {businesses.map((b) => <BizCard key={b.id} biz={b} s={status[b.id]} />)}
          </section>

          <aside className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-3">דורש תשומת לב</h2>
              {Object.keys(status).length === 0 ? <div className="h-24 rounded-xl bg-[var(--surface-2)] animate-pulse" /> :
                attention.length === 0 ? <div className="empty text-sm">הכול מעודכן. אין משימות באיחור ואין ממצאים דחופים.</div> : (
                <ul className="card !p-0 divide-y divide-[var(--line)] overflow-hidden">
                  {attention.slice(0, 8).map((a) => (
                    <li key={a.key}>
                      <Link href={a.href} className="flex items-start gap-3 px-4 py-3 hover:bg-[var(--surface-2)]">
                        <span aria-hidden className={`mt-2 w-2 h-2 rounded-full shrink-0 ${a.tone === "bad" ? "bg-[var(--bad)]" : a.tone === "mark" ? "bg-[var(--mark)]" : "bg-[var(--muted)]"}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{a.text}</span>
                          {businesses.length > 1 && <span className="block text-xs muted">{a.bizName}</span>}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold mb-3">פגישות קרובות</h2>
              {upcoming.length === 0 ? <div className="empty text-sm">אין פגישות קבועות. את מועד הפגישה הבאה קובעים בסוף כל פגישה.</div> : (
                <ul className="space-y-2">
                  {upcoming.map(({ b, at }) => (
                    <li key={b.id}><Link href={`/b/${b.id}#meetings`} className="card !p-3 flex justify-between gap-3 hover:border-[var(--accent)]">
                      <span className="font-semibold">{b.name}</span><span className="text-sm muted num">{dayLabel(at)}</span>
                    </Link></li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </Shell>
  );
}

function BizCard({ biz, s }: { biz: Biz; s?: Status }) {
  const pct = s && s.total ? Math.round((s.answered / s.total) * 100) : 0;
  const stage = !s ? "" : !s.diag ? "לפני אבחון" : s.diag.state !== "completed" && s.answered < s.total ? "באבחון" : s.openFindings && !s.weekly ? "תעדוף ותכנון" : "ביצוע שבועי";
  return (
    <Link href={`/b/${biz.id}`} className="card group block hover:border-[var(--accent)] transition">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-2xl font-bold">{biz.name}</h3>
            {stage && <span className="chip">{stage}</span>}
          </div>
          {biz.description && <p className="text-sm muted mt-1 line-clamp-1">{biz.description}</p>}
        </div>
        <span aria-hidden className="text-[var(--accent)] text-xl transition group-hover:-translate-x-1">←</span>
      </div>
      {!s ? <div className="h-12 mt-4 rounded-lg bg-[var(--surface-2)] animate-pulse" /> : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
          <div>
            <dt className="eyebrow">אבחון</dt>
            <dd className="num font-bold text-lg">{s.diag ? `${s.answered}/${s.total}` : "—"}</dd>
            {s.diag && <div className="bar mt-1"><span style={{ width: `${pct}%` }} /></div>}
          </div>
          <div><dt className="eyebrow">ממצאים פתוחים</dt><dd className="num font-bold text-lg">{s.openFindings}{s.p1 > 0 && <span className="text-sm text-[var(--bad)] font-semibold"> · {s.p1} דחופים</span>}</dd></div>
          <div><dt className="eyebrow">השבוע</dt><dd className="num font-bold text-lg text-[var(--mark)]">{s.weekly}/3</dd></div>
          <div><dt className="eyebrow">פגישה הבאה</dt><dd className="font-bold text-sm mt-1">{s.nextMeeting ? dayLabel(s.nextMeeting) : <span className="muted font-normal">לא נקבעה</span>}</dd></div>
        </dl>
      )}
    </Link>
  );
}

async function loadStatus(ids: string[]): Promise<Record<string, Status>> {
  const sb = supabase();
  const [{ data: diags }, { data: findings }, { data: tasks }, { data: meetings }] = await Promise.all([
    sb.from("diagnostics").select("id,business_id,state,started_at").in("business_id", ids).order("started_at", { ascending: false }),
    sb.from("findings").select("*").in("business_id", ids).in("status", ["open", "in_progress"]),
    sb.from("tasks").select("*").in("business_id", ids),
    sb.from("meetings").select("business_id,next_meeting_at").in("business_id", ids),
  ]);
  const latest: Record<string, { id: string; state: string }> = {};
  (diags ?? []).forEach((d: { id: string; business_id: string; state: string }) => { if (!latest[d.business_id]) latest[d.business_id] = d; });
  const diagIds = Object.values(latest).map((d) => d.id);
  const { data: answers } = diagIds.length
    ? await sb.from("diagnostic_answers").select("diagnostic_id,answer_text,is_unknown").in("diagnostic_id", diagIds)
    : { data: [] };
  const now = new Date().toISOString();
  const out: Record<string, Status> = {};
  for (const id of ids) {
    const diag = latest[id] ?? null;
    const ans = (answers ?? []).filter((a: { diagnostic_id: string }) => diag && a.diagnostic_id === diag.id);
    const bf = ((findings as (Finding & { business_id: string })[]) ?? []).filter((f) => f.business_id === id);
    const bt = ((tasks as (Task & { business_id: string })[]) ?? []).filter((t) => t.business_id === id);
    const open = bt.filter(isOpenTask);
    out[id] = {
      diag,
      total: ans.length,
      answered: ans.filter((a: { answer_text: string | null; is_unknown: boolean }) => (a.answer_text ?? "").trim() || a.is_unknown).length,
      openFindings: bf.length,
      p1: bf.filter((f) => priorityLevel(f) === 1).length,
      weekly: open.filter((t) => t.is_weekly_commitment).length,
      overdue: open.filter((t) => t.due_on && t.due_on < todayISO()),
      nextMeeting: (meetings ?? []).filter((m: { business_id: string; next_meeting_at: string | null }) => m.business_id === id && m.next_meeting_at && m.next_meeting_at > now)
        .map((m: { next_meeting_at: string }) => m.next_meeting_at).sort()[0] ?? null,
    };
  }
  return out;
}
