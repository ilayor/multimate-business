"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useCrm, type Table } from "@/components/crm/CrmContext";
import { PageTop, Section } from "@/components/crm/kit";
import { Field, Icon, SaveState, Seg, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/domain";
import { ils, type Template } from "@/lib/crm";

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      <PageTop title="הגדרות" />
      <Numbers />
      <Templates />
      <Archive />
      <Account />
    </div>
  );
}

function Numbers() {
  const { biz, setBiz } = useCrm();
  const toast = useToast();
  const [f, setF] = useState({ goal: biz.monthly_income_goal ? String(biz.monthly_income_goal) : "", price: String(biz.default_session_price), minutes: String(biz.default_session_minutes) });
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    const body = { monthly_income_goal: f.goal ? Number(f.goal) : null, default_session_price: Number(f.price) || 300, default_session_minutes: Number(f.minutes) || 60 };
    if (body.monthly_income_goal === (biz.monthly_income_goal ?? null) && body.default_session_price === Number(biz.default_session_price) && body.default_session_minutes === biz.default_session_minutes) return;
    setState("saving");
    const { error } = await supabase().from("businesses").update(body).eq("id", biz.id);
    if (error) { setState("error"); toast("ההגדרות לא נשמרו. נסו שוב."); return; }
    setBiz({ ...biz, ...body });
    setState("saved");
  }
  return (
    <Section title="העסק" action={<SaveState state={state} />}>
      <div className="card p-4 space-y-3">
        <Field label="יעד הכנסות חודשי (₪)">
          <input type="number" inputMode="numeric" className="input num" placeholder="למשל 6000" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} onBlur={save} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מחיר מפגש (₪)"><input type="number" inputMode="numeric" className="input num" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} onBlur={save} /></Field>
          <Field label="משך מפגש (דקות)"><input type="number" inputMode="numeric" className="input num" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} onBlur={save} /></Field>
        </div>
      </div>
    </Section>
  );
}

function Templates() {
  const { data, reload } = useCrm();
  return (
    <Section title="נוסחי וואטסאפ">
      <p className="caption px-1 -mt-1">המילים {"{שם}"} {"{יום}"} {"{שעה}"} {"{סכום}"} מתמלאות לבד.</p>
      <div className="space-y-3">
        {data.templates.map((t) => <TemplateCard key={t.id} t={t} onSaved={reload} />)}
      </div>
    </Section>
  );
}
function TemplateCard({ t, onSaved }: { t: Template; onSaved: () => void }) {
  const toast = useToast();
  const [body, setBody] = useState(t.body);
  useEffect(() => setBody(t.body), [t.body]);
  async function save() {
    if (body.trim() === t.body || !body.trim()) return;
    const { error } = await supabase().from("message_templates").update({ body: body.trim() }).eq("id", t.id);
    if (error) toast("הנוסח לא נשמר. נסו שוב."); else { toast("הנוסח נשמר"); onSaved(); }
  }
  return (
    <div className="card p-4"><Field label={t.title}><textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} onBlur={save} /></Field></div>
  );
}

type Kind = "clients" | "sessions" | "payments" | "tasks" | "packages";
function Archive() {
  const { data, update, reload } = useCrm();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("clients");
  const [armed, setArmed] = useState<string | null>(null);
  const name = (id: string) => data.clients.find((c) => c.id === id)?.full_name ?? "";
  const rows: { id: string; title: string; sub: string; at: string }[] = (() => {
    switch (kind) {
      case "clients": return data.clients.filter((x) => x.archived_at).map((x) => ({ id: x.id, title: x.full_name, sub: x.kind === "lead" ? `מתעניינת${x.lost_reason ? ` · ${x.lost_reason}` : ""}` : "מתאמנת", at: x.archived_at! }));
      case "sessions": return data.sessions.filter((x) => x.archived_at).map((x) => ({ id: x.id, title: `מפגש · ${name(x.client_id)}`, sub: fmtDate(x.starts_at), at: x.archived_at! }));
      case "payments": return data.payments.filter((x) => x.archived_at).map((x) => ({ id: x.id, title: `${ils(Number(x.amount))} · ${name(x.client_id)}`, sub: fmtDate(x.paid_on), at: x.archived_at! }));
      case "packages": return data.packages.filter((x) => x.archived_at).map((x) => ({ id: x.id, title: `${x.title} · ${name(x.client_id)}`, sub: fmtDate(x.purchased_on), at: x.archived_at! }));
      case "tasks": return data.tasks.filter((x) => x.archived_at).map((x) => ({ id: x.id, title: x.title, sub: "משימה", at: x.archived_at! }));
    }
  })().sort((a, b) => b.at.localeCompare(a.at));

  async function destroy(id: string) {
    // payments ask twice: first tap arms, second tap confirms
    if (armed !== id) { setArmed(id); setTimeout(() => setArmed((a) => (a === id ? null : a)), 4000); return; }
    const { error } = await supabase().from(kind as Table).delete().eq("id", id);
    setArmed(null);
    if (error) { toast("לא נמחק. נסו שוב."); return; }
    toast("נמחק לצמיתות");
    reload();
  }

  return (
    <Section title="ארכיון">
      <Seg label="סוג" value={kind} onChange={setKind} options={[
        { value: "clients", label: "לקוחות" }, { value: "sessions", label: "מפגשים" }, { value: "payments", label: "תשלומים" }, { value: "tasks", label: "משימות" }, { value: "packages", label: "חבילות" },
      ]} />
      {rows.length === 0 ? <div className="empty text-sm">הארכיון ריק.</div> : (
        <div className="list-group">
          {rows.map((r) => (
            <div key={r.id} className="row">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.title}</div>
                <div className="caption">{r.sub} · בארכיון מ-{fmtDate(r.at)}</div>
              </div>
              <button className="btn-tint !min-h-9 text-sm" onClick={async () => { if (await update(kind, r.id, { archived_at: null })) toast("שוחזר"); }}>
                <Icon name="restore" size={16} /> שחזור
              </button>
              <button className={`btn-danger !min-h-9 !px-3 text-sm ${armed === r.id ? "" : "!bg-transparent"}`} onClick={() => destroy(r.id)}>
                {armed === r.id ? (kind === "payments" ? "תשלום! למחוק?" : "בטוח?") : <Icon name="trash" size={16} />}
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="caption px-1">מחיקה לצמיתות דורשת לחיצה שנייה, ולא ניתן לבטל אותה.</p>
    </Section>
  );
}

function Account() {
  const router = useRouter();
  const { user } = useCrm();
  return (
    <Section title="חשבון">
      <div className="card p-4 flex items-center justify-between gap-3">
        <span className="text-sm truncate" dir="ltr">{user.email}</span>
        <button className="btn-tint" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}><Icon name="logout" size={18} /> יציאה</button>
      </div>
    </Section>
  );
}
