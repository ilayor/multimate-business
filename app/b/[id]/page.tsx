"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell, Loading } from "@/components/Shell";
import { Snapshot } from "@/components/biz/Snapshot";
import { Overview } from "@/components/biz/Overview";
import { Diagnostics } from "@/components/biz/Diagnostics";
import { Findings } from "@/components/biz/Findings";
import { Tasks } from "@/components/biz/Tasks";
import { Meetings } from "@/components/biz/Meetings";

const TABS = [
  { key: "snapshot", label: "תמונת מצב" },
  { key: "diagnostics", label: "אבחון" },
  { key: "findings", label: "ממצאים", consultantOnly: true },
  { key: "tasks", label: "משימות והשבוע" },
  { key: "meetings", label: "פגישות" },
  { key: "profile", label: "פרופיל העסק" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default function BusinessPage() {
  const { id } = useParams<{ id: string }>();
  const user = useRequireUser();
  const [name, setName] = useState<string | null>(null);
  const [role, setRole] = useState<"consultant" | "owner" | null>(null);
  const [tab, setTab] = useState<TabKey>("snapshot");
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
    const fromHash = window.location.hash.slice(1) as TabKey;
    if (TABS.some((t) => t.key === fromHash)) setTab(fromHash);
  }, [user, id]);

  function choose(t: TabKey) {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  }

  if (notFound) return <Shell><div className="empty">העסק לא נמצא, או שאין לך הרשאה לצפות בו.</div></Shell>;
  if (!user || !name || !role) return <Shell wide><Loading /></Shell>;

  const isConsultant = role === "consultant";
  const tabs = TABS.filter((t) => isConsultant || !("consultantOnly" in t));
  return (
    <Shell crumbs={name} wide>
      <div className="flex flex-wrap items-baseline gap-3 mb-5">
        <h1 className="text-3xl font-bold">{name}</h1>
        <span className="chip chip-plain">{isConsultant ? "מרחב יועץ" : "המרחב שלי"}</span>
      </div>
      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="אזורי העסק" className="flex md:flex-col gap-1 overflow-x-auto md:sticky md:top-20 md:self-start -mx-4 px-4 md:mx-0 md:px-0 pb-1">
          {tabs.map((t) => (
            <button key={t.key} className="navlink" aria-current={tab === t.key ? "page" : undefined} onClick={() => choose(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <section className="min-w-0">
          {tab === "snapshot" && <Snapshot businessId={id} isConsultant={isConsultant} go={choose} />}
          {tab === "diagnostics" && <Diagnostics businessId={id} isConsultant={isConsultant} />}
          {tab === "findings" && isConsultant && <Findings businessId={id} />}
          {tab === "tasks" && <Tasks businessId={id} isConsultant={isConsultant} userId={user.id} />}
          {tab === "meetings" && <Meetings businessId={id} isConsultant={isConsultant} />}
          {tab === "profile" && <Overview businessId={id} canEdit={isConsultant} />}
        </section>
      </div>
    </Shell>
  );
}
