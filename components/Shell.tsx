"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Icon, Skeleton } from "@/components/ui";

/** Top bar used outside a business: home is always one tap away. */
export function AppHeader({ right }: { right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 chrome border-b border-[var(--line)] pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-extrabold" aria-label="מסך ראשי">
          <span aria-hidden className="grid place-items-center w-8 h-8 rounded-[9px] bg-[var(--accent)] text-[var(--accent-ink)] text-sm">M</span>
          <span>Multimate</span>
        </Link>
        <div className="flex items-center gap-1">
          {right}
          <button className="icon-btn" aria-label="יציאה" title="יציאה"
            onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>
            <Icon name="logout" size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}

/* Kept for the diagnostic screen, which now renders inside the business layout. */
export function Shell({ children }: { children: React.ReactNode; crumbs?: React.ReactNode; wide?: boolean }) {
  return <>{children}</>;
}
export function Loading() { return <Skeleton />; }
export function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const text = { idle: "", saving: "שומר…", saved: "נשמר", error: "לא נשמר" }[state];
  return <span aria-live="polite" className={`text-xs ${state === "error" ? "text-[var(--bad)]" : state === "saved" ? "text-[var(--done)]" : "muted"}`}>{text}</span>;
}
