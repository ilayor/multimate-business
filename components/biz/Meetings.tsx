"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutosave } from "@/components/useAutosave";
import { SaveBadge, Loading } from "@/components/Shell";

type Meeting = {
  id: string; scheduled_at: string; agenda: string | null; shared_summary: string | null; decisions: string | null;
  follow_up_questions: string | null; next_meeting_at: string | null; status: string;
};

export function Meetings({ businessId, isConsultant }: { businessId: string; isConsultant: boolean }) {
  const [list, setList] = useState<Meeting[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase().from("meetings").select("*").eq("business_id", businessId).order("scheduled_at", { ascending: false });
    setList((data as Meeting[]) ?? []);
  }
  useEffect(() => { load(); }, [businessId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function create() {
    const { data, error } = await supabase().from("meetings")
      .insert({ business_id: businessId, agenda: "1. אבחון ראשוני\n2. ממצאים עיקריים\n3. 1–3 משימות לשבוע הקרוב" })
      .select("id").single();
    if (!error && data) {
      await supabase().from("meeting_private_notes").insert({ meeting_id: data.id, business_id: businessId });
      setOpen(data.id);
      load();
    }
  }

  if (!list) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-bold">פגישות</h2><p className="text-sm muted mt-1">כל פגישה נסגרת בסיכום, החלטות ומועד המשך. בעלת העסק רואה רק מה ששותף.</p></div>
        {isConsultant && <button className="btn" onClick={create}>+ פגישה חדשה</button>}
      </div>
      {list.length === 0 && <div className="empty">{isConsultant ? "אין פגישות עדיין." : "עדיין לא שותף סיכום פגישה."}</div>}
      {list.map((m) => (
        <div key={m.id} className="card">
          <button className="w-full flex justify-between items-center" onClick={() => setOpen(open === m.id ? null : m.id)}>
            <span className="font-bold text-lg">{new Date(m.scheduled_at).toLocaleString("he-IL", { dateStyle: "medium", timeStyle: "short" })}</span>
            <span className={`chip ${m.status === "published" ? "" : "chip-plain"}`}>{m.status === "published" ? "שותף עם בעלת העסק" : "טיוטה"}</span>
          </button>
          {open === m.id && (isConsultant
            ? <MeetingEditor meeting={m} businessId={businessId} onChange={load} />
            : <MeetingView meeting={m} />)}
        </div>
      ))}
    </div>
  );
}

function MeetingView({ meeting: m }: { meeting: Meeting }) {
  return (
    <div className="mt-3 space-y-3 text-sm whitespace-pre-wrap">
      {m.shared_summary && <div><b>סיכום:</b>{"\n"}{m.shared_summary}</div>}
      {m.decisions && <div><b>החלטות:</b>{"\n"}{m.decisions}</div>}
      {m.follow_up_questions && <div><b>שאלות להמשך:</b>{"\n"}{m.follow_up_questions}</div>}
      {m.next_meeting_at && <div><b>הפגישה הבאה:</b> {new Date(m.next_meeting_at).toLocaleString("he-IL")}</div>}
    </div>
  );
}

function MeetingEditor({ meeting, businessId, onChange }: { meeting: Meeting; businessId: string; onChange: () => void }) {
  const [m, setM] = useState({
    agenda: meeting.agenda ?? "", shared_summary: meeting.shared_summary ?? "", decisions: meeting.decisions ?? "",
    follow_up_questions: meeting.follow_up_questions ?? "", next_meeting_at: meeting.next_meeting_at?.slice(0, 16) ?? "",
  });
  const [notes, setNotes] = useState<string | null>(null);

  useEffect(() => {
    supabase().from("meeting_private_notes").select("notes").eq("meeting_id", meeting.id).maybeSingle()
      .then(({ data }) => setNotes(data?.notes ?? ""));
  }, [meeting.id]);

  const state = useAutosave(m, async (v) => {
    const { error } = await supabase().from("meetings").update({
      ...v, next_meeting_at: v.next_meeting_at ? new Date(v.next_meeting_at).toISOString() : null,
    }).eq("id", meeting.id);
    return !error;
  });

  async function togglePublish() {
    await supabase().from("meetings").update({ status: meeting.status === "published" ? "draft" : "published" }).eq("id", meeting.id);
    onChange();
  }

  const field = (key: keyof typeof m, label: string, rows = 3) => (
    <div>
      <label className="label">{label}</label>
      <textarea className="input" rows={rows} value={m[key]} onChange={(e) => setM({ ...m, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="flex justify-end"><SaveBadge state={state} /></div>
      {field("agenda", "סדר יום")}
      {field("shared_summary", "סיכום משותף (יוצג לבעלת העסק לאחר שיתוף)", 4)}
      {field("decisions", "החלטות")}
      {field("follow_up_questions", "שאלות פתוחות להמשך")}
      <div>
        <label className="label">מועד הפגישה הבאה</label>
        <input type="datetime-local" className="input !w-auto" value={m.next_meeting_at} onChange={(e) => setM({ ...m, next_meeting_at: e.target.value })} />
      </div>
      {notes !== null && <PrivateNotes meetingId={meeting.id} businessId={businessId} initial={notes} />}
      <button className="btn" onClick={togglePublish}>{meeting.status === "published" ? "ביטול שיתוף" : "שיתוף הסיכום עם בעלת העסק"}</button>
    </div>
  );
}

function PrivateNotes({ meetingId, businessId, initial }: { meetingId: string; businessId: string; initial: string }) {
  const [notes, setNotes] = useState(initial);
  const state = useAutosave(notes, async (v) => {
    const { error } = await supabase().from("meeting_private_notes")
      .upsert({ meeting_id: meetingId, business_id: businessId, notes: v, updated_at: new Date().toISOString() });
    return !error;
  });
  return (
    <div className="rounded-xl p-3 border border-dashed border-[var(--mark)] bg-[var(--mark-soft)]">
      <div className="flex justify-between">
        <label className="label !text-[var(--mark)]">🔒 הערות פרטיות — לעולם לא מוצגות לבעלת העסק</label>
        <SaveBadge state={state} />
      </div>
      <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </div>
  );
}
