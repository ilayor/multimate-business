"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon, Seg, useToast } from "@/components/ui";

type Mat = { id: string; kind: "link" | "file" | "note"; title: string; url: string | null; storage_path: string | null; body: string | null };

export function Materials({ businessId, meetingId }: { businessId: string; meetingId: string }) {
  const toast = useToast();
  const [items, setItems] = useState<Mat[]>([]);
  const [adding, setAdding] = useState<null | "link" | "note" | "file">(null);
  const [f, setF] = useState({ title: "", url: "", body: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().from("meeting_materials").select("*").eq("meeting_id", meetingId).order("created_at");
    setItems((data as Mat[]) ?? []);
  }, [meetingId]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (adding === "link" && f.url.trim()) {
      const url = /^https?:\/\//.test(f.url.trim()) ? f.url.trim() : `https://${f.url.trim()}`;
      await supabase().from("meeting_materials").insert({ meeting_id: meetingId, business_id: businessId, kind: "link", title: f.title.trim() || url, url });
    } else if (adding === "note" && (f.title.trim() || f.body.trim())) {
      await supabase().from("meeting_materials").insert({ meeting_id: meetingId, business_id: businessId, kind: "note", title: f.title.trim() || "הערה", body: f.body });
    }
    setF({ title: "", url: "", body: "" }); setAdding(null); load();
  }

  async function uploadFile(file: File) {
    setBusy(true);
    const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${businessId}/meetings/${meetingId}/files/${Date.now()}-${safe}`;
    const { error } = await supabase().storage.from("business-files").upload(path, file, { contentType: file.type || undefined });
    if (error) toast(`הקובץ לא הועלה: ${error.message}`);
    else await supabase().from("meeting_materials").insert({ meeting_id: meetingId, business_id: businessId, kind: "file", title: file.name, storage_path: path });
    setBusy(false); setAdding(null); load();
  }

  async function open(m: Mat) {
    if (m.kind === "link" && m.url) { window.open(m.url, "_blank", "noopener"); return; }
    if (m.kind === "file" && m.storage_path) {
      const { data } = await supabase().storage.from("business-files").createSignedUrl(m.storage_path, 600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    }
  }

  async function remove(m: Mat) {
    if (m.storage_path) await supabase().storage.from("business-files").remove([m.storage_path]);
    await supabase().from("meeting_materials").delete().eq("id", m.id);
    load(); toast("החומר נמחק");
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="group">
          {items.map((m) => (
            <div key={m.id} className="row">
              <span className="grid place-items-center w-9 h-9 rounded-lg bg-[var(--surface-2)] text-[var(--ink-2)]"><Icon name={m.kind === "link" ? "link" : m.kind === "file" ? "file" : "note"} size={18} /></span>
              {m.kind === "note" ? (
                <details className="flex-1 min-w-0"><summary className="font-semibold cursor-pointer truncate">{m.title}</summary><p className="whitespace-pre-wrap text-sm mt-1">{m.body}</p></details>
              ) : (
                <button className="flex-1 min-w-0 text-start font-semibold truncate text-[var(--accent)]" onClick={() => open(m)}>{m.title}</button>
              )}
              <button className="icon-btn !text-[var(--muted)]" aria-label={`מחיקת ${m.title}`} onClick={() => remove(m)}><Icon name="trash" size={18} /></button>
            </div>
          ))}
        </div>
      )}
      {!adding ? (
        <div className="flex flex-wrap gap-2">
          <button className="btn-tint" onClick={() => setAdding("link")}><Icon name="link" size={18} /> קישור</button>
          <button className="btn-tint" onClick={() => setAdding("note")}><Icon name="note" size={18} /> הערה</button>
          <button className="btn-tint" disabled={busy} onClick={() => fileRef.current?.click()}><Icon name="file" size={18} /> {busy ? "מעלה…" : "קובץ"}</button>
          <input ref={fileRef} type="file" hidden onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="card p-3 space-y-2">
          <Seg label="סוג" value={adding} onChange={setAdding} options={[{ value: "link", label: "קישור" }, { value: "note", label: "הערה" }]} />
          <input className="input" placeholder="כותרת" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          {adding === "link" && <input className="input" dir="ltr" placeholder="https://" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />}
          {adding === "note" && <textarea className="input" placeholder="תוכן" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}
          <div className="flex gap-2"><button className="btn flex-1" onClick={save}>הוספה</button><button className="btn-plain" onClick={() => setAdding(null)}>ביטול</button></div>
        </div>
      )}
    </div>
  );
}
