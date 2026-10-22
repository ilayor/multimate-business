"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon, useToast } from "@/components/ui";

type Rec = { id: string; storage_path: string; segment: number; duration_seconds: number | null; size_bytes: number | null; created_at: string };

// Recordings are cut into 5-minute files so each one stays under the storage per-file limit (50MB)
// and a crash mid-meeting loses at most the current segment.
const SEGMENT_MS = 5 * 60 * 1000;

function pickMime() {
  const opts = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"];
  return opts.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

export function Recorder({ businessId, meetingId }: { businessId: string; meetingId: string }) {
  const toast = useToast();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [state, setState] = useState<"idle" | "consent" | "starting" | "recording" | "finishing">("idle");
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const segment = useRef(0);
  const segStart = useRef(0);
  const started = useRef(0);
  const stopping = useRef(false);
  const rotateTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from("meeting_recordings").select("*").eq("meeting_id", meetingId).order("created_at");
    setRecs((data as Rec[]) ?? []);
  }, [meetingId]);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (state !== "recording") return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started.current) / 1000)), 500);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); if (rotateTimer.current) clearInterval(rotateTimer.current); }, []);

  async function upload(blob: Blob, seg: number, seconds: number, mime: string) {
    setUploading((n) => n + 1);
    const ext = mime.includes("mp4") ? "mp4" : "webm";
    const path = `${businessId}/meetings/${meetingId}/rec-${started.current}-${String(seg).padStart(2, "0")}.${ext}`;
    const { error } = await supabase().storage.from("business-files").upload(path, blob, { contentType: mime.split(";")[0], upsert: false });
    if (error) toast(`קטע ${seg} לא נשמר (${error.message}). ההקלטה ממשיכה.`);
    else {
      await supabase().from("meeting_recordings").insert({ meeting_id: meetingId, business_id: businessId, storage_path: path, segment: seg, duration_seconds: seconds, size_bytes: blob.size, mime_type: mime.split(";")[0] });
      load();
    }
    setUploading((n) => n - 1);
  }

  function startSegment(mime: string) {
    if (!stream.current) return;
    const r = new MediaRecorder(stream.current, { mimeType: mime || undefined, videoBitsPerSecond: 600_000, audioBitsPerSecond: 64_000 });
    const chunks: Blob[] = [];
    const seg = ++segment.current;
    segStart.current = Date.now();
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      const seconds = Math.round((Date.now() - segStart.current) / 1000);
      upload(new Blob(chunks, { type: r.mimeType || mime }), seg, seconds, r.mimeType || mime);
      if (!stopping.current) startSegment(mime);
    };
    r.start(1000);
    recorder.current = r;
  }

  async function start() {
    setState("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } }, audio: true });
      stream.current = s;
      if (preview.current) { preview.current.srcObject = s; preview.current.play().catch(() => {}); }
      const mime = pickMime();
      stopping.current = false;
      segment.current = recs.reduce((m, r) => Math.max(m, r.segment), 0);
      started.current = Date.now();
      setElapsed(0);
      startSegment(mime);
      rotateTimer.current = setInterval(() => recorder.current?.state === "recording" && recorder.current.stop(), SEGMENT_MS);
      setState("recording");
    } catch {
      setState("idle");
      toast("אין גישה למצלמה או למיקרופון. אשרו גישה בדפדפן ונסו שוב.");
    }
  }

  function stop() {
    setState("finishing");
    stopping.current = true;
    if (rotateTimer.current) clearInterval(rotateTimer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setTimeout(() => setState("idle"), 300);
  }

  async function play(r: Rec) {
    if (urls[r.id]) return;
    const { data } = await supabase().storage.from("business-files").createSignedUrl(r.storage_path, 3600);
    if (data?.signedUrl) setUrls((u) => ({ ...u, [r.id]: data.signedUrl }));
  }

  async function remove(r: Rec) {
    await supabase().storage.from("business-files").remove([r.storage_path]);
    await supabase().from("meeting_recordings").delete().eq("id", r.id);
    load();
    toast("ההקלטה נמחקה");
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const totalMin = Math.round(recs.reduce((a, r) => a + (r.duration_seconds ?? 0), 0) / 60);

  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`grid place-items-center w-11 h-11 rounded-xl ${state === "recording" ? "bg-[var(--bad)] text-white" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}><Icon name="video" size={22} /></span>
          <div className="min-w-0">
            <div className="font-bold">{state === "recording" ? <span className="num">מקליט · {mmss(elapsed)}</span> : "הקלטת הפגישה"}</div>
            <div className="caption">{uploading ? `שומר ${uploading} קטעים…` : recs.length ? `${recs.length} קטעים · כ-${totalMin} דקות` : "וידאו ושמע מהמחשב, נשמר בענן"}</div>
          </div>
        </div>
        {state === "idle" && <button className="btn" onClick={() => setState("consent")}><span className="w-2.5 h-2.5 rounded-full bg-current" /> הקלטה</button>}
        {state === "recording" && <button className="btn-danger" onClick={stop}><span className="w-3 h-3 rounded-sm bg-current" /> עצירה</button>}
        {(state === "starting" || state === "finishing") && <span className="caption">רגע…</span>}
      </div>

      {state === "consent" && (
        <div className="px-4 pb-4 space-y-3">
          <label className="flex items-start gap-3 rounded-xl bg-[var(--mark-soft)] p-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 w-5 h-5 accent-[var(--accent)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>כל המשתתפים יודעים שהפגישה מוקלטת ומסכימים. ההקלטה נשמרת באופן פרטי ורק אתה יכול לצפות בה.</span>
          </label>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={!consent} onClick={start}>התחלת הקלטה</button>
            <button className="btn-plain" onClick={() => setState("idle")}>ביטול</button>
          </div>
        </div>
      )}

      <video ref={preview} muted playsInline className={`w-full aspect-video bg-black ${state === "recording" || state === "starting" ? "" : "hidden"}`} />

      {recs.length > 0 && state !== "recording" && (
        <details className="border-t border-[var(--line)]">
          <summary className="px-4 py-3 cursor-pointer font-semibold text-[var(--accent)]">צפייה בהקלטות</summary>
          <div className="px-4 pb-4 space-y-3">
            {recs.map((r) => (
              <div key={r.id} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="num">קטע {r.segment} · {mmss(r.duration_seconds ?? 0)}{r.size_bytes ? ` · ${(r.size_bytes / 1048576).toFixed(1)}MB` : ""}</span>
                  <span className="flex gap-1">
                    {!urls[r.id] && <button className="btn-plain text-sm" onClick={() => play(r)}>הצגה</button>}
                    <button className="icon-btn !text-[var(--muted)]" aria-label={`מחיקת קטע ${r.segment}`} onClick={() => remove(r)}><Icon name="trash" size={18} /></button>
                  </span>
                </div>
                {urls[r.id] && <video src={urls[r.id]} controls playsInline className="w-full rounded-xl bg-black aspect-video" />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
