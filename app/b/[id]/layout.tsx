"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Icon, Skeleton } from "@/components/ui";
import { BizContext } from "@/components/biz2/BizContext";
import type { Business } from "@/lib/domain";

const NAV = [
  { href: "", label: "תמונת מצב", icon: "pulse" },
  { href: "/tasks", label: "משימות", icon: "list" },
  { href: "/projects", label: "פרויקטים", icon: "target" },
  { href: "/meetings", label: "פגישות", icon: "calendar" },
  { href: "/profile", label: "פרופיל", icon: "user" },
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const user = useRequireUser();
  const [biz, setBiz] = useState<Business | null>(null);
  const [isConsultant, setIsConsultant] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const sb = supabase();
    const [{ data: b }, { data: m }] = await Promise.all([
      sb.from("businesses").select("id,name,profession,owner_name,phone,email,description,logo_path").eq("id", id).maybeSingle(),
      sb.from("business_memberships").select("role").eq("business_id", id).eq("user_id", user.id).maybeSingle(),
    ]);
    if (!b) { setMissing(true); return; }
    setBiz(b as Business);
    setIsConsultant(m?.role === "consultant");
  }, [id, user]);
  useEffect(() => { load(); }, [load]);

  const base = `/b/${id}`;
  const active = (href: string) => href === "" ? pathname === base : pathname.startsWith(base + href);
  // Deep pages (a project, a meeting, the diagnostic) get a back button to their list.
  const segs = pathname.slice(base.length).split("/").filter(Boolean);
  const backHref = segs.length >= 2 ? base + "/" + (segs[0] === "d" ? "profile" : segs[0]) : null;

  if (missing) return <main className="p-6"><div className="empty">העסק לא נמצא, או שאין לך הרשאה לצפות בו. <Link className="btn-plain" href="/">חזרה למסך הראשי</Link></div></main>;

  return (
    <div className="min-h-dvh">
      {/* phone top bar */}
      <header className="md:hidden sticky top-0 z-30 chrome border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
        <div className="h-14 px-2 flex items-center justify-between gap-2">
          <button className="btn-plain" onClick={() => router.push(backHref ?? "/")}>
            <Icon name="back" size={20} /> {backHref ? "חזרה" : "ראשי"}
          </button>
          <div className="min-w-0 text-center">
            <div className="font-bold truncate leading-tight">{biz?.name ?? " "}</div>
            {biz?.profession && <div className="text-[11px] muted truncate leading-tight">{biz.profession}</div>}
          </div>
          <Link href="/" className="icon-btn" aria-label="מסך ראשי"><Icon name="home" size={20} /></Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto md:grid md:grid-cols-[248px_minmax(0,1fr)] md:gap-8 md:px-6">
        {/* desktop sidebar, on the right (start side) */}
        <aside className="hidden md:block">
          <div className="sticky top-6 pt-6 space-y-3">
            <Link href="/" className="btn-plain -ms-1.5 text-sm"><Icon name="back" size={18} /> כל העסקים</Link>
            <div className="card p-3 space-y-3">
              <div className="flex items-center gap-3 p-1">
                <Logo biz={biz} />
                <div className="min-w-0">
                  <div className="text-lg font-extrabold leading-tight truncate">{biz?.name ?? " "}</div>
                  {biz?.profession && <div className="text-[13px] muted truncate">{biz.profession}</div>}
                </div>
              </div>
              <nav aria-label="עמודי העסק" className="space-y-0.5 border-t border-[var(--line)] pt-3">
                {NAV.map((n) => (
                  <Link key={n.href} href={base + n.href} aria-current={active(n.href) ? "page" : undefined}
                    className={`flex items-center gap-3 px-3 h-11 rounded-xl font-semibold transition-colors ${active(n.href) ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>
                    <Icon name={n.icon} size={20} /> {n.label}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 md:px-0 pt-4 md:pt-12 pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-16">
          {backHref && (
            <button className="hidden md:inline-flex btn-plain -ms-1.5 mb-3 text-sm" onClick={() => router.push(backHref)}>
              <Icon name="back" size={18} /> חזרה
            </button>
          )}
          {!biz || !user ? <Skeleton /> : (
            <BizContext.Provider value={{ biz, isConsultant, userId: user.id, refresh: load }}>{children}</BizContext.Provider>
          )}
        </main>
      </div>

      {/* phone tab bar */}
      <nav aria-label="עמודי העסק" className="md:hidden fixed bottom-0 inset-x-0 z-30 chrome border-t border-[var(--line)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link key={n.href} href={base + n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-semibold ${active(n.href) ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
              <Icon name={n.icon} size={24} /> {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

function Logo({ biz }: { biz: Business | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!biz?.logo_path) { setUrl(null); return; }
    supabase().storage.from("business-files").createSignedUrl(biz.logo_path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [biz?.logo_path]);
  return url
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={url} alt="" className="w-12 h-12 rounded-2xl object-cover shrink-0" />
    : <span aria-hidden className="grid place-items-center w-12 h-12 rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] text-xl font-extrabold shrink-0">{biz?.name?.[0] ?? ""}</span>;
}
