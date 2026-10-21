"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function Shell({ children, crumbs }: { children: React.ReactNode; crumbs?: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="max-w-5xl mx-auto px-4 py-4">
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-bold text-lg">Multimate Business</Link>
          {crumbs && <span className="text-sm text-gray-500">/ {crumbs}</span>}
        </div>
        <button
          className="btn-ghost text-sm"
          onClick={async () => {
            await supabase().auth.signOut();
            router.replace("/login");
          }}
        >
          יציאה
        </button>
      </header>
      {children}
    </div>
  );
}

export function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  const text = { idle: "", saving: "שומר…", saved: "נשמר ✓", error: "שגיאה בשמירה!" }[state];
  const color = state === "error" ? "text-red-600" : state === "saved" ? "text-green-700" : "text-gray-500";
  return <span className={`text-xs ${color}`}>{text}</span>;
}
