"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell, Loading } from "@/components/Shell";

type Biz = { id: string; name: string; description: string | null; organization_id: string };

export default function Home() {
  const user = useRequireUser();
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Biz[] | null>(null);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!user) return;
    const sb = supabase();
    sb.from("businesses").select("id,name,description,organization_id").order("created_at").then(({ data }) => {
      setBusinesses(data ?? []);
    });
    sb.from("organizations").select("id,name").then(({ data }) => setOrgs(data ?? []));
  }, [user]);

  // a business owner with exactly one business goes straight to it
  useEffect(() => {
    if (businesses && businesses.length === 1 && orgs.length === 0) router.replace(`/b/${businesses[0].id}`);
  }, [businesses, orgs, router]);

  async function create() {
    if (!newName.trim() || !orgs[0]) return;
    const { data, error } = await supabase().rpc("create_business", { p_org: orgs[0].id, p_name: newName.trim() });
    if (!error && data) router.push(`/b/${data}`);
  }

  if (!user || businesses === null) return <Shell><Loading /></Shell>;

  return (
    <Shell>
      <div className="eyebrow">מרחב יועץ</div>
      <h1 className="text-3xl font-bold mt-1 mb-6">העסקים שאני מלווה</h1>
      {businesses.length === 0 && <div className="empty mb-4">אין עדיין עסקים משויכים אליך.</div>}
      <div className="grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => (
          <Link key={b.id} href={`/b/${b.id}`} className="card group flex items-center justify-between gap-4 hover:border-[var(--accent)] transition">
            <div className="min-w-0">
              <div className="font-display text-2xl font-bold">{b.name}</div>
              <div className="text-sm muted mt-1 line-clamp-2">{b.description}</div>
            </div>
            <span aria-hidden className="text-[var(--accent)] text-xl transition group-hover:-translate-x-1">←</span>
          </Link>
        ))}
      </div>
      {orgs.length > 0 && (
        <div className="panel mt-8 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="label" htmlFor="newbiz">עסק חדש</label>
            <input id="newbiz" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם העסק" />
          </div>
          <button className="btn" onClick={create} disabled={!newName.trim()}>יצירה</button>
        </div>
      )}
    </Shell>
  );
}
