"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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

  if (!diags) return <p className="text-gray-500">טוען…</p>;
  return (
    <div className="space-y-4">
      {diags.length === 0 && (
        <div className="card text-center py-8">
          <p className="mb-1 font-semibold">עוד לא בוצע אבחון</p>
          <p className="text-sm text-gray-500 mb-4">האבחון הראשוני הוא נקודת ההתחלה — אין עדיין ציון או נתונים להציג.</p>
        </div>
      )}
      {isConsultant && templates.map((t) => (
        <button key={t.id} className="btn" onClick={() => start(t.id)}>+ התחלת אבחון: {t.title} (v{t.version})</button>
      ))}
      {err && <p className="text-red-600 text-sm">{err}</p>}
      {diags.map((d) => (
        <Link key={d.id} href={`/b/${businessId}/d/${d.id}`} className="card block hover:shadow-md">
          <div className="flex justify-between">
            <span className="font-semibold">{d.template_title}</span>
            <span className="chip">{d.state === "completed" ? "הושלם" : "בתהליך"}</span>
          </div>
          <div className="text-sm text-gray-500">התחיל: {new Date(d.started_at).toLocaleString("he-IL")}</div>
        </Link>
      ))}
    </div>
  );
}
