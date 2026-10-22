"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBiz } from "@/components/biz2/BizContext";
import { MeetingSheet } from "@/components/biz2/sheets";
import { Icon, Seg, Skeleton, useToast } from "@/components/ui";
import { fmtTime, relDay, type Meeting } from "@/lib/domain";

export default function MeetingsPage() {
  const { biz } = useBiz();
  const toast = useToast();
  const [view, setView] = useState<"history" | "archive">("history");
  const [list, setList] = useState<Meeting[] | null>(null);
  const [recCount, setRecCount] = useState<Record<string, number>>({});
  const [sheet, setSheet] = useState<{ open: boolean; meeting?: Meeting | null }>({ open: false });

  const load = useCallback(async () => {
    const q = supabase().from("meetings").select("*").eq("business_id", biz.id).order("scheduled_at", { ascending: false });
    const { data } = view === "archive" ? await q.not("archived_at", "is", null) : await q.is("archived_at", null);
    setList((data as Meeting[]) ?? []);
    const { data: r } = await supabase().from("meeting_recordings").select("meeting_id").eq("business_id", biz.id);
    const c: Record<string, number> = {};
    (r ?? []).forEach((x: { meeting_id: string }) => { c[x.meeting_id] = (c[x.meeting_id] ?? 0) + 1; });
    setRecCount(c);
  }, [biz.id, view]);
  useEffect(() => { load(); }, [load]);

  async function restore(m: Meeting) {
    await supabase().from("meetings").update({ archived_at: null }).eq("id", m.id);
    load(); toast("הפגישה שוחזרה");
  }

  const now = new Date().toISOString();
  const next = list && view === "history" ? [...list].reverse().find((m) => m.scheduled_at > now) : undefined;
  const rest = (list ?? []).filter((m) => m.id !== next?.id);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="large-title">פגישות</h1>
        <button className="btn" onClick={() => setSheet({ open: true, meeting: null })}><Icon name="plus" size={18} /> פגישה</button>
      </div>

      {view === "history" && list && (next ? (
        <div className="card p-5 space-y-4 bg-[var(--accent)] !text-[var(--accent-ink)]">
          <div className="text-sm font-semibold opacity-85">הפגישה הבאה</div>
          <div>
            <div className="text-3xl font-extrabold leading-tight">{relDay(next.scheduled_at)} · {fmtTime(next.scheduled_at)}</div>
            <div className="opacity-85 mt-1">{[next.title, next.location].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="flex gap-2">
            <Link href={`/b/${biz.id}/meetings/${next.id}`} className="btn !bg-[var(--accent-ink)] !text-[var(--accent)] flex-1">כניסה לפגישה</Link>
            <button className="btn !bg-white/15" onClick={() => setSheet({ open: true, meeting: next })}>עריכה</button>
          </div>
        </div>
      ) : (
        <div className="card p-4 flex items-center justify-between gap-3">
          <span className="muted">אין פגישה קרובה</span>
          <button className="btn-tint" onClick={() => setSheet({ open: true, meeting: null })}>לקביעת פגישה</button>
        </div>
      ))}

      <Seg label="תצוגה" value={view} onChange={setView} options={[{ value: "history", label: "היסטוריה" }, { value: "archive", label: "ארכיון" }]} />

      {!list ? <Skeleton h={64} /> : rest.length === 0 ? (
        <div className="empty">{view === "archive" ? "הארכיון ריק." : "עוד אין פגישות קודמות."}</div>
      ) : (
        <div className="group">
          {rest.map((m) => {
            const d = new Date(m.scheduled_at);
            const future = m.scheduled_at > now;
            return (
              <div key={m.id} className="row">
                <Link href={`/b/${biz.id}/meetings/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="w-12 shrink-0 text-center rounded-xl bg-[var(--surface-2)] py-1">
                    <span className="block num text-lg font-extrabold leading-tight">{d.getDate()}</span>
                    <span className="block caption leading-tight">{d.toLocaleDateString("he-IL", { month: "short" })}</span>
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate">{m.title || "פגישה"}</span>
                    <span className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="caption">{d.toLocaleDateString("he-IL", { weekday: "short" })} · {fmtTime(m.scheduled_at)}</span>
                      {future ? <span className="chip chip-accent">מתוכננת</span> : m.completed_at ? <span className="chip chip-done">תועדה</span> : <span className="chip chip-mark">לא תועדה</span>}
                      {recCount[m.id] ? <span className="chip"><Icon name="video" size={13} /> הוקלטה</span> : null}
                    </span>
                  </span>
                </Link>
                {view === "archive"
                  ? <button className="btn-plain text-sm" onClick={() => restore(m)}>שחזור</button>
                  : <button className="icon-btn" aria-label="עריכה" onClick={() => setSheet({ open: true, meeting: m })}><Icon name="edit" size={18} /></button>}
              </div>
            );
          })}
        </div>
      )}

      <MeetingSheet open={sheet.open} onClose={() => setSheet({ open: false })} businessId={biz.id} meeting={sheet.meeting} onSaved={load} />
    </div>
  );
}
