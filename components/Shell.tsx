"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function Shell({ children, crumbs, wide }: { children: React.ReactNode; crumbs?: React.ReactNode; wide?: boolean }) {
  const router = useRouter();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur">
        <div className={`${wide ? "max-w-6xl" : "max-w-4xl"} mx-auto px-4 h-14 flex items-center justify-between gap-3`}>
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center gap-2 font-bold shrink-0">
              <span aria-hidden className="grid place-items-center w-7 h-7 rounded-lg bg-[var(--accent)] text-[var(--accent-ink)] text-sm font-extrabold">M</span>
              <span className="hidden sm:inline">Multimate</span>
            </Link>
            {crumbs && <span className="text-sm muted truncate">/ {crumbs}</span>}
          </div>
          <button
            className="text-sm muted hover:text-[var(--ink)]"
            onClick={async () => {
              await supabase().auth.signOut();
              router.replace("/login");
            }}
          >
            יציאה
          </button>
        </div>
      </header>
      <main className={`${wide ? "max-w-6xl" : "max-w-4xl"} mx-auto px-4 py-6`}>{children}</main>
    </div>
  );
}

export function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const text = { idle: "", saving: "שומר…", saved: "נשמר", error: "לא נשמר — בדקו חיבור" }[state];
  const color = state === "error" ? "text-[var(--bad)] font-semibold" : state === "saved" ? "text-[var(--ok)]" : "muted";
  return <span aria-live="polite" className={`text-xs whitespace-nowrap ${color}`}>{state === "saved" ? "✓ " : ""}{text}</span>;
}

export function Loading() {
  return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-[var(--surface-2)] animate-pulse" />)}</div>;
}
