"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useRequireUser } from "@/components/useAuth";
import { Shell } from "@/components/Shell";

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

  if (!user || businesses === null) return <Shell><p className="text-gray-500">טוען…</p></Shell>;

  return (
    <Shell>
      <h1 className="text-2xl font-bold mb-4">העסקים שלי</h1>
      {businesses.length === 0 && <p className="text-gray-500 mb-4">אין עדיין עסקים משויכים אליך.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {businesses.map((b) => (
          <Link key={b.id} href={`/b/${b.id}`} className="card hover:shadow-md transition">
            <div className="font-semibold text-lg">{b.name}</div>
            <div className="text-sm text-gray-500">{b.description}</div>
          </Link>
        ))}
      </div>
      {orgs.length > 0 && (
        <div className="card mt-6 flex gap-2 items-end">
          <div className="flex-1">
            <label className="label" htmlFor="newbiz">עסק חדש</label>
            <input id="newbiz" className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם העסק" />
          </div>
          <button className="btn" onClick={create} disabled={!newName.trim()}>יצירה</button>
        </div>
      )}
    </Shell>
  );
}
