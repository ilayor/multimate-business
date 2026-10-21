"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutosave } from "@/components/useAutosave";
import { SaveBadge, Loading } from "@/components/Shell";

const FIELDS = [
  { key: "description", label: "תיאור העסק" },
  { key: "offerings", label: "מה העסק מציע" },
  { key: "current_price", label: "מחיר נוכחי" },
  { key: "target_segments", label: "קהלי יעד" },
  { key: "vision", label: "חזון" },
  { key: "baseline_notes", label: "נתוני בסיס / הערות (מה מאומת ומה השערה)" },
] as const;
type Profile = Record<(typeof FIELDS)[number]["key"], string | null>;

export function Overview({ businessId, canEdit }: { businessId: string; canEdit: boolean }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    supabase().from("businesses").select(FIELDS.map((f) => f.key).join(",")).eq("id", businessId).single()
      .then(({ data }) => setProfile(data as unknown as Profile));
  }, [businessId]);
  if (!profile) return <Loading />;
  return <OverviewForm businessId={businessId} initial={profile} canEdit={canEdit} />;
}

function OverviewForm({ businessId, initial, canEdit }: { businessId: string; initial: Profile; canEdit: boolean }) {
  const [p, setP] = useState(initial);
  const state = useAutosave(p, async (v) => {
    if (!canEdit) return true;
    const { error } = await supabase().from("businesses").update({ ...v, updated_at: new Date().toISOString() }).eq("id", businessId);
    return !error;
  });
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end gap-3">
        <div><h2 className="text-2xl font-bold">פרופיל העסק</h2><p className="text-sm muted mt-1">מה שלא אומת — כתבו שהוא השערה. שום מספר לא נכנס כעובדה בלי מקור.</p></div>
        <SaveBadge state={state} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className={`card !p-4 ${f.key === "baseline_notes" || f.key === "description" ? "sm:col-span-2" : ""}`}>
            <label className="label" htmlFor={f.key}>{f.label}</label>
            <textarea id={f.key} rows={2} className="input resize-none !border-transparent !bg-transparent !px-0 focus:!border-[var(--accent)] focus:!px-3 focus:!bg-[var(--surface)]" readOnly={!canEdit}
              placeholder={canEdit ? "עוד לא מולא" : "—"}
              value={p[f.key] ?? ""} onChange={(e) => setP({ ...p, [f.key]: e.target.value })} />
          </div>
        ))}
      </div>
    </div>
  );
}
