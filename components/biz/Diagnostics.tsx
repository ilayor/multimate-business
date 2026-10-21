"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loading } from "@/components/Shell";

type Diag = { id: string; template_title: string; state: string; started_at: string; completed_at: string | null };

export function Diagnostics({ businessId, isConsultant }: { businessId: string; isConsultant: boolean }) {
  const router = useRouter();
  const [diags, setDiags] = useState<Diag[] | null>(null);
  const [templates, setTemplates] = useState<{ id: string; title: string; version: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.from("diagnostics").select("id,template_title,state,started_at,completed_at").eq("business_id", businessId)
      .order("started_at", { ascending: false }).then(({ data }) => setDiags(data ?? []));
    if (isConsultant) sb.from("questionnaire_templates").select("id,title,version").eq("active", true)
      .then(({ data }) => setTemplates(data ?? []));
  }, [businessId, isConsultant]);

  async function start(templateId: string) {
    const { data, error } = await supabase().rpc("start_diagnostic", { p_business: businessId, p_template: templateId });
    if (error) setErr(error.message);
    else router.push(`/b/${businessId}/d/${data}`);
  }

  if (!diags) return <Loading />;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">אבחון</h2>
      {diags.length === 0 && (
        <div className="empty">
          <p className="font-bold text-[var(--ink)]">עוד לא בוצע אבחון</p>
          <p className="text-sm mt-1">האבחון הוא נקודת ההתחלה. עד שהוא מתקיים אין ציון ואין נתונים — וזה בסדר.</p>
        </div>
      )}
      {isConsultant && templates.map((t) => (
        <button key={t.id} className="btn" onClick={() => start(t.id)}>+ אבחון חדש: {t.title}</button>
      ))}
      {err && <p className="text-[var(--bad)] text-sm">{err}</p>}
      {diags.map((d) => (
        <Link key={d.id} href={`/b/${businessId}/d/${d.id}`} className="card block hover:border-[var(--accent)] transition">
          <div className="flex justify-between">
            <span className="font-bold text-lg">{d.template_title}</span>
            <span className={`chip ${d.state === "completed" ? "" : "chip-mark"}`}>{d.state === "completed" ? "הושלם" : "בתהליך — להמשך"}</span>
          </div>
          <div className="text-sm muted mt-1">התחיל: {new Date(d.started_at).toLocaleString("he-IL")}</div>
        </Link>
      ))}
    </div>
  );
}
