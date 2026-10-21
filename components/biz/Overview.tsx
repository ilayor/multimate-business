"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAutosave } from "@/components/useAutosave";
import { SaveBadge } from "@/components/Shell";

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
  if (!profile) return <p className="text-gray-500">טוען…</p>;
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
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">פרופיל העסק</h2>
        <SaveBadge state={state} />
      </div>
      {FIELDS.map((f) => (
        <div key={f.key}>
          <label className="label" htmlFor={f.key}>{f.label}</label>
          <textarea id={f.key} rows={2} className="input" readOnly={!canEdit}
            value={p[f.key] ?? ""} onChange={(e) => setP({ ...p, [f.key]: e.target.value })} />
        </div>
      ))}
    </div>
  );
}
