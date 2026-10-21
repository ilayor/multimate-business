"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
    if (error) setError("פרטי ההתחברות שגויים");
    else router.replace("/");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold">כניסה ל-Multimate Business</h1>
        <div>
          <label className="label" htmlFor="email">אימייל</label>
          <input id="email" type="email" dir="ltr" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="password">סיסמה</label>
          <input id="password" type="password" dir="ltr" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "מתחבר…" : "כניסה"}</button>
        <p className="text-xs text-gray-500">הכניסה בהזמנה בלבד.</p>
      </form>
    </main>
  );
}
