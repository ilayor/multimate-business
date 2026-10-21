"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const CYCLE = ["אבחון", "ממצאים", "יעדים", "משימות", "ביצוע", "מדידה"];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError("האימייל או הסיסמה שגויים. נסו שוב.");
    else router.replace("/");
  }

  return (
    <main className="min-h-screen grid md:grid-cols-2">
      <section className="hidden md:flex flex-col justify-between p-12 bg-[var(--accent)] text-[var(--accent-ink)]">
        <div className="font-extrabold tracking-wide">Multimate Business</div>
        <div>
          <h1 className="text-5xl font-bold leading-tight">ליווי עסקי<br />שאפשר למדוד.</h1>
          <ol className="flex flex-wrap gap-2 mt-8 text-sm font-semibold">
            {CYCLE.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="rounded-full border border-current/40 px-3 py-1">{s}</span>
                {i < CYCLE.length - 1 && <span aria-hidden className="opacity-60">←</span>}
              </li>
            ))}
          </ol>
        </div>
        <p className="text-sm opacity-80">כל תשובה, ממצא ומשימה נשמרים — ושום דבר לא מוצג כעובדה לפני שאומת.</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <div className="md:hidden font-extrabold text-[var(--accent)] mb-6">Multimate Business</div>
            <h2 className="text-3xl font-bold">כניסה</h2>
            <p className="muted mt-1 text-sm">הכניסה בהזמנה בלבד.</p>
          </div>
          <div>
            <label className="label" htmlFor="email">אימייל</label>
            <input id="email" type="email" dir="ltr" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">סיסמה</label>
            <input id="password" type="password" dir="ltr" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-[var(--bad)]" role="alert">{error}</p>}
          <button className="btn w-full" disabled={busy}>{busy ? "מתחבר…" : "כניסה"}</button>
        </form>
      </section>
    </main>
  );
}
