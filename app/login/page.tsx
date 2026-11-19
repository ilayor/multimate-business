"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BrandMark, Wordmark } from "@/components/ui";

const EMAIL_KEY = "orshina:last-email";

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
      const saved = localStorage.getItem(EMAIL_KEY) ?? localStorage.getItem("mm:last-email");
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
    <main className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      <section className="relative overflow-hidden bg-[var(--accent)] text-[var(--accent-ink)] px-6 pt-[calc(24px+env(safe-area-inset-top,0px))] pb-8 lg:p-14 flex flex-col lg:justify-between gap-6">
        <div aria-hidden className="absolute -bottom-24 -start-24 w-80 h-80 rounded-full border-[36px] border-white/10" />
        <div className="relative flex items-center gap-2.5">
          <BrandMark size={38} className="rounded-[10px] ring-2 ring-white/25" />
          <Wordmark className="!text-[17px]" />
        </div>
        <div className="relative">
          <h1 className="text-[32px] lg:text-6xl font-extrabold leading-[1.05] tracking-tight">כל המתאמנות,<br />במקום אחד.</h1>
          <p className="mt-3 lg:mt-5 max-w-md opacity-85 text-[17px] lg:text-lg">מפגשים, פולואפים, תשלומים ומשימות של אורשינא. מהטלפון, בכל רגע.</p>
        </div>
        <p className="relative text-sm opacity-70 hidden lg:block">אורשינא · אימון אישי</p>
      </section>

      <section className="flex items-start lg:items-center justify-center px-6 py-10 lg:py-12">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5" noValidate>
          <div>
            <h2 className="text-3xl font-bold">כניסה</h2>
            <p className="muted mt-1">ההתחברות נשמרת במכשיר, כך שמתחברים פעם אחת.</p>
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
        </form>
      </section>
    </main>
  );
}
