"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/ui";
import type { Task } from "@/lib/domain";
import type { Client, CrmBusiness, Package, Payment, Session, Template } from "@/lib/crm";

export type CrmData = { clients: Client[]; packages: Package[]; sessions: Session[]; payments: Payment[]; tasks: Task[]; templates: Template[] };
export type Table = "clients" | "packages" | "sessions" | "payments" | "tasks";

type Ctx = {
  user: User;
  biz: CrmBusiness;
  data: CrmData;
  reload: () => Promise<void>;
  setBiz: (b: CrmBusiness) => void;
  /** Optimistic patch; rolls back and reports if the write fails. */
  update: <T extends Table>(table: T, id: string, patch: Record<string, unknown>) => Promise<boolean>;
  insert: (table: Table, row: Record<string, unknown>) => Promise<{ id: string } | null>;
  /** Moves a row to the archive and offers undo. */
  archive: (table: Table, id: string, label: string) => Promise<void>;
  prefs: Record<string, unknown>;
  setPref: (key: string, value: unknown) => void;
};

const CrmCtx = createContext<Ctx | null>(null);
export function useCrm() {
  const v = useContext(CrmCtx);
  if (!v) throw new Error("useCrm outside the app shell");
  return v;
}

/** A remembered choice (filter, sort, view), synced through the account. */
export function usePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const { prefs, setPref } = useCrm();
  const v = (prefs[key] as T | undefined) ?? fallback;
  return [v, (x: T) => setPref(key, x)];
}

const EMPTY: CrmData = { clients: [], packages: [], sessions: [], payments: [], tasks: [], templates: [] };

export function CrmProvider({ user, children, fallback }: { user: User; children: React.ReactNode; fallback: React.ReactNode }) {
  const toast = useToast();
  const [biz, setBiz] = useState<CrmBusiness | null>(null);
  const [data, setData] = useState<CrmData | null>(null);
  const [missing, setMissing] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, unknown>>({});
  const prefsRef = useRef(prefs);
  const prefTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    const sb = supabase();
    let b = biz;
    if (!b) {
      const { data: m } = await sb.from("business_memberships").select("business_id").eq("user_id", user.id).limit(1).maybeSingle();
      if (!m) { setMissing(true); return; }
      const { data: bb } = await sb.from("businesses")
        .select("id,name,monthly_income_goal,default_session_price,default_session_minutes").eq("id", m.business_id).maybeSingle();
      if (!bb) { setMissing(true); return; }
      b = bb as CrmBusiness;
      setBiz(b);
      const { data: p } = await sb.from("user_prefs").select("prefs").eq("user_id", user.id).maybeSingle();
      if (p?.prefs) { setPrefs(p.prefs as Record<string, unknown>); prefsRef.current = p.prefs as Record<string, unknown>; }
    }
    const id = b.id;
    const [c, pk, s, pay, t, tpl] = await Promise.all([
      sb.from("clients").select("*").eq("business_id", id).order("created_at", { ascending: false }),
      sb.from("packages").select("*").eq("business_id", id).order("purchased_on"),
      sb.from("sessions").select("*").eq("business_id", id).order("starts_at"),
      sb.from("payments").select("*").eq("business_id", id).order("paid_on", { ascending: false }),
      sb.from("tasks").select("id,business_id,title,description,department_code,assignee_name,due_on,priority,status,completed_at,archived_at,position,created_at")
        .eq("business_id", id).order("position").order("created_at"),
      sb.from("message_templates").select("*").eq("business_id", id).order("position"),
    ]);
    if (c.error || s.error || pay.error) { toast("אין חיבור לשרת כרגע. בדקו את האינטרנט ורעננו."); }
    setData({
      clients: (c.data as Client[]) ?? [], packages: (pk.data as Package[]) ?? [], sessions: (s.data as Session[]) ?? [],
      payments: (pay.data as Payment[]) ?? [], tasks: (t.data as Task[]) ?? [], templates: (tpl.data as Template[]) ?? [],
    });
  }, [biz, user.id, toast]);

  useEffect(() => { reload(); /* first load only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchLocal = (table: Table, id: string, patch: Record<string, unknown>) =>
    setData((d) => d && { ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const update: Ctx["update"] = useCallback(async (table, id, patch) => {
    const before = (data?.[table] as { id: string }[] | undefined)?.find((r) => r.id === id);
    patchLocal(table, id, patch);
    const { error } = await supabase().from(table).update(patch).eq("id", id);
    if (error) {
      if (before) setData((d) => d && { ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? before : r)) });
      toast("השינוי לא נשמר. בדקו חיבור ונסו שוב.");
      return false;
    }
    return true;
  }, [data, toast]);

  const insert: Ctx["insert"] = useCallback(async (table, row) => {
    if (!biz) return null;
    const { data: r, error } = await supabase().from(table).insert({ ...row, business_id: biz.id }).select().single();
    if (error || !r) { toast("לא נשמר. בדקו חיבור ונסו שוב."); return null; }
    setData((d) => d && { ...d, [table]: [r, ...(d[table] as unknown[])] });
    return r as { id: string };
  }, [biz, toast]);

  const archive: Ctx["archive"] = useCallback(async (table, id, label) => {
    const ok = await update(table, id, { archived_at: new Date().toISOString() });
    if (ok) toast(`הועבר לארכיון: ${label}`, () => { update(table, id, { archived_at: null }); });
  }, [update, toast]);

  const setPref = useCallback((key: string, value: unknown) => {
    const next = { ...prefsRef.current, [key]: value };
    prefsRef.current = next;
    setPrefs(next);
    if (prefTimer.current) clearTimeout(prefTimer.current);
    prefTimer.current = setTimeout(() => {
      supabase().from("user_prefs").upsert({ user_id: user.id, prefs: prefsRef.current, updated_at: new Date().toISOString() }).then(() => {});
    }, 600);
  }, [user.id]);

  if (missing) return <div className="empty m-6">החשבון הזה עדיין לא מחובר לעסק. פנו לעילאי.</div>;
  if (!biz || !data) return <>{fallback}</>;
  return (
    <CrmCtx.Provider value={{ user, biz, data: data ?? EMPTY, reload, setBiz, update, insert, archive, prefs, setPref }}>
      {children}
    </CrmCtx.Provider>
  );
}
