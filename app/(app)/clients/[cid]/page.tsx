"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { useWhatsApp } from "@/components/crm/WhatsApp";
import { Chips, Section } from "@/components/crm/kit";
import { Empty, Field, Icon, Seg, useToast } from "@/components/ui";
import { fmtDate, fmtTime, relDay, todayISO } from "@/lib/domain";
import {
  addDaysISO, clientDebt, CLIENT_STATUS, ils, initials, isPaid, LEAD_STAGE, live, METHOD, packageRemaining, packageUsed,
  SESSION_STATUS, SOURCES, waNumber, type Client,
} from "@/lib/crm";

export default function ClientPage() {
  const { cid } = useParams<{ cid: string }>();
  const router = useRouter();
  const { data, update, archive } = useCrm();
  const open = useSheets();
  const wa = useWhatsApp();
  const toast = useToast();
  const c = data.clients.find((x) => x.id === cid);
  if (!c) return <Empty icon="users" title="הכרטיס לא נמצא"><Link href="/clients" className="btn-plain">חזרה ללקוחות</Link></Empty>;
  const isLead = c.kind === "lead";

  const sessions = live(data.sessions).filter((s) => s.client_id === c.id).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const upcoming = sessions.filter((s) => s.status === "scheduled").reverse();
  const past = sessions.filter((s) => s.status !== "scheduled");
  const packages = live(data.packages).filter((p) => p.client_id === c.id);
  const payments = live(data.payments).filter((p) => p.client_id === c.id);
  const debt = clientDebt(c.id, data.sessions, data.payments);
  const left = packages.reduce((n, p) => n + packageRemaining(p, data.sessions), 0);

  async function becomeClient() {
    if (!c) return;
    await update("clients", c.id, { kind: "client", lead_stage: "won", client_status: "active", became_client_at: new Date().toISOString(), next_follow_up: null });
    toast(`${c.full_name.split(" ")[0]} עכשיו מתאמנת 🎉`, () => { update("clients", c.id, { kind: "lead", lead_stage: c.lead_stage, became_client_at: null, next_follow_up: c.next_follow_up }); });
  }

  return (
    <div className="space-y-6">
      <Link href={`/clients${isLead ? "?tab=leads" : ""}`} className="btn-plain -ms-1.5 text-sm"><Icon name="back" size={18} /> {isLead ? "מתעניינות" : "מתאמנות"}</Link>

      <header className="flex items-center gap-4">
        <span className="avatar !w-16 !h-16 !text-2xl" style={isLead ? { background: "var(--mark-soft)", color: "var(--mark)" } : undefined} aria-hidden>{initials(c.full_name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-extrabold leading-tight truncate">{c.full_name}</h1>
          <div className="caption">{isLead ? `מתעניינת · ${LEAD_STAGE[c.lead_stage]}` : `מתאמנת · ${CLIENT_STATUS[c.client_status]}`}{c.source ? ` · הגיעה מ${c.source}` : ""}</div>
        </div>
      </header>

      {/* quick actions */}
      <div className="grid grid-cols-4 gap-2">
        <Quick icon="wa" label="וואטסאפ" onClick={() => wa({ client: c, at: upcoming[0]?.starts_at, amount: debt || undefined, prefer: isLead ? "follow_up" : debt ? "payment" : upcoming[0] ? "reminder" : undefined })} />
        {waNumber(c.phone) ? <Quick icon="phone" label="חיוג" href={`tel:${c.phone}`} /> : <Quick icon="phone" label="חיוג" disabled />}
        {isLead ? <Quick icon="star" label="נרשמה" onClick={becomeClient} tone="accent" />
          : <Quick icon="calendar" label="מפגש" onClick={() => open({ kind: "session", preset: { client_id: c.id } })} tone="accent" />}
        <Quick icon="wallet" label="תשלום" onClick={() => open({ kind: "payment", preset: { client_id: c.id, amount: debt || undefined } })} />
      </div>

      {isLead ? <LeadPanel c={c} onWon={becomeClient} onLost={async (reason) => {
        await update("clients", c.id, { lead_stage: "lost", lost_reason: reason || null });
        await archive("clients", c.id, c.full_name);
        router.push("/clients?tab=leads");
      }} /> : (
        <>
          <Seg label="סטטוס" value={c.client_status} onChange={(client_status) => update("clients", c.id, { client_status })}
            options={(Object.keys(CLIENT_STATUS) as Client["client_status"][]).map((v) => ({ value: v, label: CLIENT_STATUS[v] }))} />
          <div className="grid grid-cols-3 gap-2">
            <div className="stat !p-3"><span className="l">מפגשים</span><span className="v !text-[22px]">{past.filter((s) => s.status === "done").length}</span></div>
            <div className="stat !p-3"><span className="l">נשארו בחבילה</span><span className="v !text-[22px]">{packages.length ? left : "—"}</span></div>
            <div className="stat !p-3"><span className="l">חוב</span><span className={`v !text-[22px] ${debt ? "text-[var(--bad)]" : ""}`}>{ils(debt)}</span></div>
          </div>
        </>
      )}

      <Details c={c} />

      {!isLead && (
        <>
          <Section title="מפגשים" count={sessions.length} action={<button className="btn-plain text-sm" onClick={() => open({ kind: "session", preset: { client_id: c.id } })}><Icon name="plus" size={16} /> מפגש</button>}>
            {sessions.length === 0 ? <div className="empty text-sm">עוד אין מפגשים. קובעים את הראשון בכפתור "מפגש".</div> : (
              <div className="list-group">
                {[...upcoming, ...past].map((s) => {
                  const unpaid = s.status === "done" && !isPaid(s, data.payments);
                  return (
                    <button key={s.id} className="row row-btn items-start" onClick={() => open({ kind: "session", session: s })}>
                      <span className={`dot mt-2 ${s.status === "scheduled" ? "!bg-[var(--accent)]" : s.status === "done" ? "!bg-[var(--done)]" : ""}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold num">{relDay(s.starts_at)} · {fmtTime(s.starts_at)}</span>
                          {s.status !== "done" && s.status !== "scheduled" && <span className="chip">{SESSION_STATUS[s.status]}</span>}
                          {s.package_id && <span className="chip chip-accent">חבילה</span>}
                          {unpaid && <span className="chip chip-bad">לא שולם</span>}
                        </div>
                        {s.summary && <p className="text-sm text-[var(--ink-2)] mt-0.5 line-clamp-2">{s.summary}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          <Section title="חבילות" count={packages.length} action={<button className="btn-plain text-sm" onClick={() => open({ kind: "package", preset: { client_id: c.id } })}><Icon name="plus" size={16} /> חבילה</button>}>
            {packages.length === 0 ? <div className="empty text-sm">אין חבילה. כל מפגש מחויב בנפרד.</div> : (
              <div className="list-group">
                {packages.map((p) => {
                  const used = packageUsed(p, data.sessions);
                  return (
                    <div key={p.id} className="row">
                      <Icon name="package" size={20} className="text-[var(--accent)]" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{p.title} <span className="caption">· {fmtDate(p.purchased_on)} · {ils(Number(p.price))}</span></div>
                        <div className="bar mt-1.5"><span style={{ width: `${(used / p.sessions_total) * 100}%` }} /></div>
                      </div>
                      <span className="num font-bold text-sm whitespace-nowrap">{p.sessions_total - used} מתוך {p.sessions_total}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </>
      )}

      <Section title="תשלומים" count={payments.length} action={<button className="btn-plain text-sm" onClick={() => open({ kind: "payment", preset: { client_id: c.id } })}><Icon name="plus" size={16} /> תשלום</button>}>
        {payments.length === 0 ? <div className="empty text-sm">עוד לא נרשמו תשלומים.</div> : (
          <div className="list-group">
            {payments.map((p) => (
              <button key={p.id} className="row row-btn" onClick={() => open({ kind: "payment", payment: p })}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold num">{ils(Number(p.amount))}</div>
                  <div className="caption">{fmtDate(p.paid_on)} · {METHOD[p.method]}{p.package_id ? " · חבילה" : p.session_id ? " · מפגש" : ""}{p.note ? ` · ${p.note}` : ""}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <button type="button" className="btn-danger w-full !bg-transparent" onClick={async () => { await archive("clients", c.id, c.full_name); router.push(isLead ? "/clients?tab=leads" : "/clients"); }}>
        <Icon name="archive" size={18} /> העברה לארכיון
      </button>
    </div>
  );
}

function Quick({ icon, label, onClick, href, tone, disabled }: { icon: string; label: string; onClick?: () => void; href?: string; tone?: "accent"; disabled?: boolean }) {
  const cls = `flex flex-col items-center justify-center gap-1 h-[68px] rounded-2xl text-[13px] font-bold transition-transform active:scale-95 ${tone === "accent" ? "bg-[var(--accent)] text-[var(--accent-ink)]" : "bg-[var(--surface)] text-[var(--accent)] shadow-[var(--shadow)]"} ${disabled ? "opacity-40 pointer-events-none" : ""}`;
  return href ? <a href={href} className={cls}><Icon name={icon} size={22} />{label}</a>
    : <button type="button" className={cls} onClick={onClick} disabled={disabled}><Icon name={icon} size={22} />{label}</button>;
}

function LeadPanel({ c, onWon, onLost }: { c: Client; onWon: () => void; onLost: (reason: string) => void }) {
  const { update } = useCrm();
  const toast = useToast();
  const [note, setNote] = useState(c.follow_up_note ?? "");
  const [lost, setLost] = useState<string | null>(null);
  useEffect(() => setNote(c.follow_up_note ?? ""), [c.follow_up_note]);
  const today = todayISO();
  const late = !!c.next_follow_up && c.next_follow_up < today;
  return (
    <div className="space-y-3">
      <Chips label="שלב" value={c.lead_stage} onChange={(lead_stage) => update("clients", c.id, { lead_stage })}
        options={(["new", "contacted", "intro_call"] as const).map((v) => ({ value: v, label: LEAD_STAGE[v] }))} />
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">פולואפ</span>
          {late && <span className="chip chip-accent">באיחור</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="לחזור אליה ב">
            <input type="date" className="input" value={c.next_follow_up ?? ""} onChange={(e) => update("clients", c.id, { next_follow_up: e.target.value || null })} />
          </Field>
          <div className="field"><span>&nbsp;</span>
            <button type="button" className="btn-tint !min-h-11" onClick={() => {
              const next = addDaysISO(today, 3);
              update("clients", c.id, { next_follow_up: next, lead_stage: c.lead_stage === "new" ? "contacted" : c.lead_stage });
              toast(`נרשם · הפולואפ הבא ב-${fmtDate(next)}`);
            }}><Icon name="check" size={18} /> חזרתי אליה</button>
          </div>
        </div>
        <Field label="מה לומר / מה סיכמנו">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (c.follow_up_note ?? "") && update("clients", c.id, { follow_up_note: note.trim() || null })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn !bg-[var(--done)]" onClick={onWon}>נרשמה, הופכת למתאמנת</button>
        <button type="button" className="btn-tint" onClick={() => setLost(lost === null ? "" : null)}>לא רלוונטית</button>
      </div>
      {lost !== null && (
        <div className="card p-3 flex gap-2">
          <input className="input" autoFocus placeholder="למה? (לא חובה)" value={lost} onChange={(e) => setLost(e.target.value)} />
          <button type="button" className="btn-danger shrink-0" onClick={() => onLost(lost)}>לארכיון</button>
        </div>
      )}
    </div>
  );
}

/** Contact details, edited in place and saved when leaving each field. */
function Details({ c }: { c: Client }) {
  const { update } = useCrm();
  const [f, setF] = useState({ full_name: c.full_name, phone: c.phone ?? "", email: c.email ?? "", source: c.source ?? "", goal: c.goal ?? "", notes: c.notes ?? "" });
  useEffect(() => setF({ full_name: c.full_name, phone: c.phone ?? "", email: c.email ?? "", source: c.source ?? "", goal: c.goal ?? "", notes: c.notes ?? "" }), [c]);
  const save = (k: keyof typeof f, v = f[k]) => {
    const cur = (c[k] ?? "") as string;
    if (v.trim() === cur) return;
    if (k === "full_name" && !v.trim()) { setF({ ...f, full_name: c.full_name }); return; }
    update("clients", c.id, { [k]: v.trim() || null });
  };
  return (
    <Section title="פרטים">
      <div className="card p-4 space-y-3">
        <Field label="שם"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} onBlur={() => save("full_name")} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="טלפון"><input className="input text-left" dir="ltr" type="tel" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} onBlur={() => save("phone")} /></Field>
          <Field label="איך הגיעה?">
            <select className="input" value={f.source} onChange={(e) => { setF({ ...f, source: e.target.value }); save("source", e.target.value); }}>
              <option value="">לא ידוע</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </Field>
        </div>
        <Field label="אימייל"><input className="input text-left" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} onBlur={() => save("email")} /></Field>
        <Field label="מטרת האימון"><textarea className="input" placeholder="מה היא רוצה להשיג?" value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} onBlur={() => save("goal")} /></Field>
        <Field label="הערות"><textarea className="input" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} onBlur={() => save("notes")} /></Field>
      </div>
    </Section>
  );
}
