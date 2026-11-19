"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRequireUser } from "@/components/useAuth";
import { BrandMark, Icon, Skeleton, Wordmark } from "@/components/ui";
import { CrmProvider } from "@/components/crm/CrmContext";
import { SheetsProvider } from "@/components/crm/sheets";
import { WhatsAppProvider } from "@/components/crm/WhatsApp";

const NAV = [
  { href: "/", label: "היום", icon: "sun" },
  { href: "/calendar", label: "יומן", icon: "calendar" },
  { href: "/clients", label: "לקוחות", icon: "users" },
  { href: "/payments", label: "תשלומים", icon: "wallet" },
  { href: "/tasks", label: "משימות", icon: "list" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useRequireUser();
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const shell = (content: React.ReactNode) => (
    <div className="min-h-dvh">
      {/* phone top bar */}
      <header className="md:hidden sticky top-0 z-30 chrome border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
        <div className="h-12 px-4 flex items-center justify-between gap-2">
          <Link href="/" className="flex items-center gap-2" aria-label="ORSHINA CRM, מסך היום"><BrandMark size={26} /><Wordmark /></Link>
          <Link href="/settings" className="icon-btn" aria-label="הגדרות"><Icon name="sliders" size={21} /></Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto md:grid md:grid-cols-[232px_minmax(0,1fr)] md:gap-8 md:px-6">
        {/* desktop sidebar, on the right */}
        <aside className="hidden md:block">
          <div className="sticky top-6 pt-6 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 px-2"><BrandMark size={34} /><Wordmark /></Link>
            <nav aria-label="ניווט ראשי" className="space-y-0.5">
              {[...NAV, { href: "/settings", label: "הגדרות", icon: "sliders" }].map((n) => (
                <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 h-11 rounded-xl font-semibold transition-colors ${active(n.href) ? "bg-[var(--accent)] text-[var(--accent-ink)] shadow-sm" : "text-[var(--ink-2)] hover:bg-[var(--surface-2)]"}`}>
                  <Icon name={n.icon} size={20} /> {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 px-4 md:px-0 pt-4 md:pt-10 pb-[calc(150px+env(safe-area-inset-bottom,0px))] md:pb-16">{content}</main>
      </div>

      {/* phone tab bar */}
      <nav aria-label="ניווט ראשי" className="md:hidden fixed bottom-0 inset-x-0 z-30 chrome border-t border-[var(--line)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-semibold ${active(n.href) ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>
              <Icon name={n.icon} size={24} /> {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );

  if (!user) return shell(<Skeleton />);
  return (
    <CrmProvider user={user} fallback={shell(<Skeleton />)}>
      <WhatsAppProvider>
        <SheetsProvider>{shell(children)}</SheetsProvider>
      </WhatsAppProvider>
    </CrmProvider>
  );
}
