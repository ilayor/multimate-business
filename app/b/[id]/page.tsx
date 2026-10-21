"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell } from "@/components/Shell";
import { Overview } from "@/components/biz/Overview";
import { Diagnostics } from "@/components/biz/Diagnostics";
import { Findings } from "@/components/biz/Findings";
import { Tasks } from "@/components/biz/Tasks";
import { Meetings } from "@/components/biz/Meetings";

const TABS = [
  { key: "overview", label: "סקירה" },
  { key: "diagnostics", label: "אבחון" },
  { key: "findings", label: "ממצאים", consultantOnly: true },
  { key: "tasks", label: "משימות" },
  { key: "meetings", label: "פגישות" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireUser();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<"consultant" | "owner" | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.from("businesses").select("name").eq("id", id).maybeSingle().then(({ data }) => {
      if (!data) setNotFound(true);
      else setName(data.name);
    });
    sb.from("business_memberships").select("role").eq("business_id", id).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setRole((data?.role as "consultant" | "owner") ?? null));
    const saved = typeof window !== "undefined" ? (sessionStorage.getItem(`tab:${id}`) as TabKey | null) : null;
    if (saved) setTab(saved);
  }, [user, id]);

  function choose(t: TabKey) {
    setTab(t);
    try { sessionStorage.setItem(`tab:${id}`, t); } catch {}
  }

  if (notFound) return <Shell><p>העסק לא נמצא או שאין לך הרשאה.</p></Shell>;
  if (!user || !name || !role) return <Shell><p className="text-gray-500">טוען…</p></Shell>;

  const isConsultant = role === "consultant";
  return (
    <Shell crumbs={name}>
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold">{name}</h1>
        <span className="chip">{isConsultant ? "יועץ" : "בעלת העסק"}</span>
      </div>
      <nav className="flex gap-1 mb-5 border-b border-[var(--line)] overflow-x-auto">
        {TABS.filter((t) => isConsultant || !("consultantOnly" in t)).map((t) => (
          <button
            key={t.key}
            onClick={() => choose(t.key)}
            className={`px-4 py-2 -mb-px border-b-2 whitespace-nowrap ${tab === t.key ? "border-[var(--accent)] font-semibold" : "border-transparent text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "overview" && <Overview businessId={id} canEdit={isConsultant} />}
      {tab === "diagnostics" && <Diagnostics businessId={id} isConsultant={isConsultant} />}
      {tab === "findings" && isConsultant && <Findings businessId={id} />}
      {tab === "tasks" && <Tasks businessId={id} isConsultant={isConsultant} userId={user.id} />}
      {tab === "meetings" && <Meetings businessId={id} isConsultant={isConsultant} />}
    </Shell>
  );
}
