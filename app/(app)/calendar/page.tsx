"use client";
import { useMemo } from "react";
import { usePref, useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { Fab, PageTop } from "@/components/crm/kit";
import { Calendar, type CalItem, type CalView } from "@/components/crm/Calendar";
import { live, sameDay } from "@/lib/crm";

export default function CalendarPage() {
  const { data } = useCrm();
  const open = useSheets();
  const [view, setView] = usePref<CalView>("calendar.view", "week");
  const items: CalItem[] = useMemo(() => live(data.sessions).map((s) => {
    const name = data.clients.find((c) => c.id === s.client_id)?.full_name ?? "מפגש";
    const late = s.status === "scheduled" && new Date(s.starts_at).getTime() + s.duration_minutes * 60000 < Date.now();
    return {
      id: s.id, at: s.starts_at,
      title: s.status === "no_show" ? `${name} · לא הגיעה` : s.status === "cancelled" ? `${name} · בוטל` : late ? `${name} · לסגור` : name,
      tone: s.status === "done" ? "done" : s.status === "scheduled" ? (late ? "warn" : "scheduled") : "muted",
    };
  }), [data]);
  const thisWeek = live(data.sessions).filter((s) => s.status === "scheduled" && new Date(s.starts_at) >= new Date() && new Date(s.starts_at).getTime() - Date.now() < 7 * 864e5).length;
  const todayCount = live(data.sessions).filter((s) => s.status === "scheduled" && sameDay(new Date(s.starts_at), new Date())).length;

  return (
    <div className="space-y-5">
      <PageTop title="יומן" sub={`${todayCount ? `${todayCount} מפגשים היום · ` : ""}${thisWeek} מפגשים בשבוע הקרוב`}
        action={<Fab label="מפגש" onClick={() => open({ kind: "session" })} />} />
      <Calendar items={items} view={view} onView={setView}
        onPickDay={(d) => open({ kind: "session", preset: { at: d } })}
        onOpen={(id) => { const s = data.sessions.find((x) => x.id === id); if (s) open({ kind: "session", session: s }); }} />
    </div>
  );
}
