"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const CYCLE = ["אבחון", "ממצאים", "תעדוף", "משימות", "ביצוע", "מדידה"];
const EMAIL_KEY = "mm:last-email";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase().auth.getSession().then(({ data }) => { if (data.session) router.replace("/"); });
    try {
      const saved = localStorage.getItem(EMAIL_KEY);
      if (saved) { setEmail(saved); document.getElementById("password")?.focus(); }
      else document.getElementById("email")?.focus();
    } catch {}
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setBusy(false);
      setError(error.status === 400 || /invalid/i.test(error.message)
        ? "האימייל או הסיסמה לא נכונים. שימו לב לאותיות גדולות וקטנות בסיסמה."
        : "אין חיבור לשרת כרגע. בדקו את האינטרנט ונסו שוב.");
      return;
    }
    try { localStorage.setItem(EMAIL_KEY, email.trim()); } catch {}
    router.replace("/");
  }

  return (
    <main className="min-h-screen grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative overflow-hidden bg-[var(--accent)] text-[var(--accent-ink)] px-6 py-6 lg:p-14 flex flex-col lg:justify-between gap-4 lg:gap-8">
        <div className="flex items-center gap-2 font-extrabold">
          <span aria-hidden className="grid place-items-center w-8 h-8 rounded-lg bg-[var(--accent-ink)] text-[var(--accent)]">M</span>
          Multimate Business
        </div>
        <div className="grid gap-10 lg:gap-14">
          <div>
            <h1 className="text-3xl lg:text-6xl font-bold leading-[1.05]">ליווי עסקי<br className="hidden lg:block" /> שאפשר למדוד.</h1>
            <p className="hidden lg:block mt-4 max-w-md opacity-85 text-lg">מהשיחה הראשונה ועד התוצאה: כל תשובה, ממצא ומשימה נשמרים במקום אחד — ושום מספר לא מוצג כעובדה לפני שאומת.</p>
          </div>
          <Cycle />
        </div>
        <p className="text-sm opacity-70 hidden lg:block">הכניסה בהזמנה בלבד · כל עסק רואה רק את המידע שלו</p>
      </section>

      <section className="flex items-start lg:items-center justify-center px-6 py-10 lg:py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <h2 className="text-3xl font-bold">כניסה</h2>
            <p className="muted mt-1">ברוכים השבים. התחברו כדי להמשיך מאיפה שעצרתם.</p>
          </div>
          <div>
            <label className="label" htmlFor="email">אימייל</label>
            <input id="email" type="email" dir="ltr" inputMode="email" autoComplete="email" className="input !py-3 text-left"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="password">סיסמה</label>
            <div className="relative">
              <input id="password" type={show ? "text" : "password"} dir="ltr" autoComplete="current-password" className="input !py-3 text-left pe-16"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShow(!show)} aria-pressed={show}
                className="absolute inset-y-0 end-0 px-3 text-sm font-semibold text-[var(--accent)]">{show ? "הסתרה" : "הצגה"}</button>
            </div>
          </div>
          {error && <p className="text-sm text-[var(--bad)] bg-[var(--bad-soft)] rounded-lg px-3 py-2" role="alert">{error}</p>}
          <button className="btn w-full !min-h-12 text-base" disabled={busy || !email.trim() || !password}>{busy ? "מתחבר…" : "כניסה"}</button>
          <p className="text-xs muted">שכחתם סיסמה או שעוד אין לכם חשבון? פנו ליועץ שהזמין אתכם.</p>
        </form>
      </section>
    </main>
  );
}

// The six stages placed on a ring, read clockwise from the top.
function Cycle() {
  const R = 42; // percent of the box
  return (
    <div className="relative w-full max-w-[340px] aspect-square mx-auto lg:mx-0 hidden lg:block" aria-label={`מחזור הליווי: ${CYCLE.join(", ")}`} role="img">
      <div aria-hidden className="absolute inset-[8%] rounded-full border-2 border-dashed border-current opacity-30" />
      <div aria-hidden className="absolute inset-0 grid place-items-center text-center">
        <div><div className="text-sm opacity-70">מחזור</div><div className="font-display text-2xl font-bold">שבועי</div></div>
      </div>
      {CYCLE.map((s, i) => {
        const a = (i / CYCLE.length) * 2 * Math.PI - Math.PI / 2;
        return (
          <span key={s} aria-hidden
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent-ink)] text-[var(--accent)] px-3 py-1 text-sm font-bold whitespace-nowrap shadow-sm"
            style={{ left: `${50 + R * Math.cos(a)}%`, top: `${50 + R * Math.sin(a)}%` }}>
            <span className="num opacity-60 me-1">{i + 1}</span>{s}
          </span>
        );
      })}
    </div>
  );
}
