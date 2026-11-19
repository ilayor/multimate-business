"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCrm } from "@/components/crm/CrmContext";
import { useSheets } from "@/components/crm/sheets";
import { useWhatsApp } from "@/components/crm/WhatsApp";
import { Avatar, Fab, PageTop, Section, SwipeRow } from "@/components/crm/kit";
import { Icon } from "@/components/ui";
import { fmtDate } from "@/lib/domain";
import { ils, live, METHOD, monthKey, monthPayments, packageRemaining, sum, unpaidSessions, type Payment } from "@/lib/crm";

export default function PaymentsPage() {
  const { biz, data, archive } = useCrm();
  const open = useSheets();
  const wa = useWhatsApp();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const ym = monthKey(month);
  const isThisMonth = ym === monthKey();
  const pays = monthPayments(data.payments, ym);
  const total = sum(pays);
  const goal = Number(biz.monthly_income_goal) || 0;
  const byMethod = useMemo(() => {
    const m = new Map<Payment["method"], number>();
    pays.forEach((p) => m.set(p.method, (m.get(p.method) ?? 0) + Number(p.amount)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pays]);
  const unpaid = unpaidSessions(data.sessions, data.payments);
  const debt = unpaid.reduce((n, s) => n + Number(s.price), 0);
  const pkgs = live(data.packages).map((p) => ({ p, left: packageRemaining(p, data.sessions) })).filter((x) => x.left > 0);
  const client = (id: string) => data.clients.find((c) => c.id === id);
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <div className="space-y-6">
      <PageTop title="תשלומים" action={<Fab label="תשלום" onClick={() => open({ kind: "payment" })} />} />

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <button className="icon-btn" aria-label="החודש הקודם" onClick={() => shift(-1)}><Icon name="back" size={20} /></button>
          <span className="font-bold">{month.toLocaleDateString("he-IL", { month: "long", year: "numeric" })}</span>
          <button className="icon-btn" aria-label="החודש הבא" disabled={isThisMonth} onClick={() => shift(1)}><Icon name="forward" size={20} className={isThisMonth ? "opacity-30" : ""} /></button>
        </div>
        <div className="text-center">
          <div className="text-[40px] font-extrabold num tracking-tight leading-none">{ils(total)}</div>
          <div className="caption mt-1.5">{pays.length} תשלומים{goal ? ` · יעד ${ils(goal)}` : ""}</div>
        </div>
        {goal > 0 && <div className="bar !h-2"><span style={{ width: `${Math.min(100, (total / goal) * 100)}%` }} /></div>}
        {byMethod.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5">
            {byMethod.map(([m, v]) => <span key={m} className="chip num">{METHOD[m]} {ils(v)}</span>)}
          </div>
        )}
      </div>

      <Section title="לא שולם" count={unpaid.length} action={debt ? <span className="chip chip-bad num">{ils(debt)}</span> : undefined}>
        {unpaid.length === 0 ? <div className="empty text-sm">כל המפגשים שבוצעו שולמו.</div> : (
          <div className="list-group">
            {unpaid.map((s) => {
              const c = client(s.client_id);
              return (
                <div key={s.id} className="row">
                  <Avatar name={c?.full_name ?? "?"} />
                  <Link href={`/clients/${s.client_id}`} className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{c?.full_name}</div>
                    <div className="caption num">מפגש {fmtDate(s.starts_at)} · {ils(Number(s.price))}</div>
                  </Link>
                  {c && <button className="icon-btn" aria-label={`בקשת תשלום מ${c.full_name}`} onClick={() => wa({ client: c, amount: Number(s.price), prefer: "payment" })}><Icon name="wa" size={20} /></button>}
                  <button className="btn-tint !min-h-9 text-sm" onClick={() => open({ kind: "payment", preset: { client_id: s.client_id, session_id: s.id, amount: Number(s.price) } })}>שולם</button>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {pkgs.length > 0 && (
        <Section title="חבילות פעילות" count={pkgs.length}>
          <div className="list-group">
            {pkgs.map(({ p, left }) => (
              <Link key={p.id} href={`/clients/${p.client_id}`} className="row row-btn">
                <Icon name="package" size={20} className="text-[var(--accent)]" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{client(p.client_id)?.full_name}</div>
                  <div className="caption">{p.title} · {fmtDate(p.purchased_on)}</div>
                </div>
                <span className={`chip num ${left <= 1 ? "chip-mark" : "chip-accent"}`}>נשארו {left}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title={isThisMonth ? "התשלומים החודש" : "התשלומים בחודש"} count={pays.length}>
        {pays.length === 0 ? <div className="empty text-sm">אין תשלומים בחודש הזה.</div> : (
          <div className="list-group">
            {pays.map((p) => (
              <SwipeRow key={p.id} onOpen={() => open({ kind: "payment", payment: p })} actions={[
                { label: "ארכיון", icon: "archive", color: "var(--muted)", onClick: () => archive("payments", p.id, `תשלום ${ils(Number(p.amount))}`) },
              ]}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{client(p.client_id)?.full_name}</div>
                  <div className="caption">{fmtDate(p.paid_on)} · {METHOD[p.method]}{p.package_id ? " · חבילה" : ""}</div>
                </div>
                <span className="font-bold num">{ils(Number(p.amount))}</span>
              </SwipeRow>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
