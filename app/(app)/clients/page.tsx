"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { usePref, useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { useWhatsApp } from "@/components/crm/WhatsApp";
import { Avatar, Chips, Fab, PageTop, SearchBar, SortSelect, SwipeRow } from "@/components/crm/kit";
import { Empty, Seg, useToast } from "@/components/ui";
import { fmtDate, relDay, fmtTime, todayISO } from "@/lib/domain";
import {
  activePackage, addDaysISO, clientDebt, CLIENT_STATUS, ils, LEAD_STAGE, live, nextSession, OPEN_STAGES, packageRemaining, type Client,
} from "@/lib/crm";

type Tab = "clients" | "leads";

export default function ClientsPage() {
  return <Suspense><Clients /></Suspense>;
}

function Clients() {
  const params = useSearchParams();
  const [tab, setTab] = usePref<Tab>("clients.tab", "clients");
  const [q, setQ] = useState("");
  const open = useSheets();
  useEffect(() => { const t = params.get("tab"); if (t === "leads" || t === "clients") setTab(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  return (
    <div className="space-y-4">
      <PageTop title="לקוחות" action={<Fab label={tab === "leads" ? "מתעניינת" : "מתאמנת"} onClick={() => open({ kind: "client", preset: { kind: tab === "leads" ? "lead" : "client" } })} />} />
      <Seg label="סוג" value={tab} onChange={setTab} options={[{ value: "clients", label: "מתאמנות" }, { value: "leads", label: "מתעניינות" }]} />
      <SearchBar value={q} onChange={setQ} placeholder="חיפוש לפי שם או טלפון" />
      {tab === "clients" ? <ClientList q={q} /> : <LeadList q={q} />}
    </div>
  );
}

const match = (c: Client, q: string) => {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return c.full_name.toLowerCase().includes(s) || (c.phone ?? "").replace(/\D/g, "").includes(s.replace(/\D/g, "") || "~");
};

function ClientList({ q }: { q: string }) {
  const { data, archive } = useCrm();
  const wa = useWhatsApp();
  const [filter, setFilter] = usePref<"active" | "paused" | "done" | "all">("clients.filter", "active");
  const [sort, setSort] = usePref<"name" | "next" | "recent">("clients.sort", "next");
  const all = live(data.clients).filter((c) => c.kind === "client");
  const count = (s: Client["client_status"]) => all.filter((c) => c.client_status === s).length;
  const rows = useMemo(() => {
    const list = all.filter((c) => (filter === "all" || c.client_status === filter) && match(c, q))
      .map((c) => ({ c, next: nextSession(c.id, data.sessions), pkg: activePackage(c.id, data.packages, data.sessions), debt: clientDebt(c.id, data.sessions, data.payments) }));
    if (sort === "name") list.sort((a, b) => a.c.full_name.localeCompare(b.c.full_name, "he"));
    if (sort === "recent") list.sort((a, b) => (b.c.became_client_at ?? b.c.created_at).localeCompare(a.c.became_client_at ?? a.c.created_at));
    if (sort === "next") list.sort((a, b) => (a.next?.starts_at ?? "9").localeCompare(b.next?.starts_at ?? "9"));
    return list;
  }, [all, filter, q, sort, data]);

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Chips label="סינון מתאמנות" value={filter} onChange={setFilter} options={[
          { value: "active", label: "פעילות", count: count("active") }, { value: "paused", label: "בהפסקה", count: count("paused") },
          { value: "done", label: "סיימו", count: count("done") }, { value: "all", label: "הכול", count: all.length },
        ]} />
      </div>
      <div className="flex justify-end -my-2"><SortSelect value={sort} onChange={setSort} options={[{ value: "next", label: "לפי המפגש הבא" }, { value: "name", label: "לפי שם" }, { value: "recent", label: "הצטרפו לאחרונה" }]} /></div>
      {rows.length === 0 ? (
        <Empty icon="users" title={q ? "לא נמצאה מתאמנת בשם הזה" : all.length ? "אין מתאמנות בסינון הזה" : "עוד אין מתאמנות"}>
          {!all.length && "מוסיפים מתאמנת בכפתור +, או הופכים מתעניינת למתאמנת כשהיא נרשמת."}
        </Empty>
      ) : (
        <div className="list-group">
          {rows.map(({ c, next, pkg, debt }) => (
            <SwipeRow key={c.id} href={`/clients/${c.id}`} actions={[
              { label: "וואטסאפ", icon: "wa", color: "var(--done)", onClick: () => wa({ client: c, at: next?.starts_at, prefer: next ? "reminder" : undefined }) },
              { label: "ארכיון", icon: "archive", color: "var(--muted)", onClick: () => archive("clients", c.id, c.full_name) },
            ]}>
              <Avatar name={c.full_name} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.full_name}</div>
                <div className="caption truncate num">{next ? `${relDay(next.starts_at)} · ${fmtTime(next.starts_at)}` : c.client_status === "active" ? "אין מפגש קבוע" : CLIENT_STATUS[c.client_status]}</div>
              </div>
              {debt > 0 ? <span className="chip chip-bad num">חוב {ils(debt)}</span>
                : pkg ? <span className="chip chip-accent num">נשארו {packageRemaining(pkg, data.sessions)}</span> : null}
            </SwipeRow>
          ))}
        </div>
      )}
    </>
  );
}

function LeadList({ q }: { q: string }) {
  const { data, archive, update } = useCrm();
  const wa = useWhatsApp();
  const toast = useToast();
  const [stage, setStage] = usePref<"open" | Client["lead_stage"]>("leads.filter", "open");
  const [sort, setSort] = usePref<"follow" | "recent">("leads.sort", "follow");
  const today = todayISO();
  const all = live(data.clients).filter((c) => c.kind === "lead" && (OPEN_STAGES as readonly string[]).includes(c.lead_stage));
  const rows = all.filter((c) => (stage === "open" || c.lead_stage === stage) && match(c, q))
    .sort(sort === "recent" ? (a, b) => b.created_at.localeCompare(a.created_at) : (a, b) => (a.next_follow_up ?? "9").localeCompare(b.next_follow_up ?? "9"));
  const count = (s: string) => all.filter((c) => c.lead_stage === s).length;

  async function followedUp(c: Client) {
    const next = addDaysISO(today, 3);
    await update("clients", c.id, { next_follow_up: next, lead_stage: c.lead_stage === "new" ? "contacted" : c.lead_stage });
    toast(`פולואפ נרשם · הבא ב-${fmtDate(next)}`, () => { update("clients", c.id, { next_follow_up: c.next_follow_up, lead_stage: c.lead_stage }); });
  }

  return (
    <>
      <Chips label="שלב" value={stage} onChange={setStage} options={[
        { value: "open", label: "הכול", count: all.length }, { value: "new", label: LEAD_STAGE.new, count: count("new") },
        { value: "contacted", label: LEAD_STAGE.contacted, count: count("contacted") }, { value: "intro_call", label: LEAD_STAGE.intro_call, count: count("intro_call") },
      ]} />
      <div className="flex justify-end -my-2"><SortSelect value={sort} onChange={setSort} options={[{ value: "follow", label: "לפי פולואפ קרוב" }, { value: "recent", label: "חדשות קודם" }]} /></div>
      {rows.length === 0 ? (
        <Empty icon="users" title={q ? "לא נמצאה מתעניינת בשם הזה" : "אין מתעניינות פתוחות"}>
          {!q && "כל פנייה חדשה נכנסת כאן, עם תאריך לחזור אליה. מוסיפים בכפתור +."}
        </Empty>
      ) : (
        <div className="list-group">
          {rows.map((c) => {
            const late = !!c.next_follow_up && c.next_follow_up < today, due = c.next_follow_up === today;
            return (
              <SwipeRow key={c.id} href={`/clients/${c.id}`} actions={[
                { label: "וואטסאפ", icon: "wa", color: "var(--done)", onClick: () => wa({ client: c, prefer: "follow_up" }) },
                { label: "חזרתי", icon: "check", color: "var(--accent)", onClick: () => followedUp(c) },
                { label: "ארכיון", icon: "archive", color: "var(--muted)", onClick: () => archive("clients", c.id, c.full_name) },
              ]}>
                <Avatar name={c.full_name} tone="lead" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{c.full_name}</div>
                  <div className="caption truncate">{LEAD_STAGE[c.lead_stage]}{c.source ? ` · ${c.source}` : ""}{c.follow_up_note ? ` · ${c.follow_up_note}` : ""}</div>
                </div>
                {c.next_follow_up && (
                  <span className={`chip num ${late ? "chip-accent" : due ? "chip-mark" : ""}`}>{late ? "באיחור" : relDay(c.next_follow_up)}</span>
                )}
              </SwipeRow>
            );
          })}
        </div>
      )}
    </>
  );
}
