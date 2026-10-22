"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon, Seg } from "@/components/ui";
import { fmtTime } from "@/lib/domain";

export type CalItem = { id: string; businessId: string; businessName: string; at: string; title: string | null; done: boolean };
type View = "month" | "week" | "day" | "list";

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function Calendar({ items, onPickDay }: { items: CalItem[]; onPickDay: (d: Date) => void }) {
  const [view, setView] = useState<View>(() => {
    try { return (localStorage.getItem("mm:cal-view") as View) || "week"; } catch { return "week"; }
  });
  const [cursor, setCursor] = useState(() => new Date());
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    items.forEach((i) => { const k = dayKey(new Date(i.at)); m.set(k, [...(m.get(k) ?? []), i]); });
    m.forEach((v) => v.sort((a, b) => a.at.localeCompare(b.at)));
    return m;
  }, [items]);
  const today = dayKey(new Date());

  function choose(v: View) { setView(v); try { localStorage.setItem("mm:cal-view", v); } catch {} }
  function move(dir: 1 | -1) {
    const x = new Date(cursor);
    if (view === "month") x.setMonth(x.getMonth() + dir);
    else if (view === "week") x.setDate(x.getDate() + 7 * dir);
    else x.setDate(x.getDate() + dir);
    setCursor(x);
  }
  const heading = view === "month" ? cursor.toLocaleDateString("he-IL", { month: "long", year: "numeric" })
    : view === "week" ? `${startOfWeek(cursor).toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}`
    : view === "day" ? cursor.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) : "הפגישות הבאות";

  return (
    <div className="card p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Seg label="תצוגת לוח" value={view} onChange={choose}
          options={[{ value: "day", label: "יום" }, { value: "week", label: "שבוע" }, { value: "month", label: "חודש" }, { value: "list", label: "רשימה" }]} />
        {view !== "list" && (
          <div className="flex items-center">
            <button className="icon-btn" aria-label="הקודם" onClick={() => move(-1)}><Icon name="back" size={20} /></button>
            <button className="btn-plain text-sm" onClick={() => setCursor(new Date())}>היום</button>
            <button className="icon-btn" aria-label="הבא" onClick={() => move(1)}><Icon name="forward" size={20} /></button>
          </div>
        )}
      </div>
      <div className="font-bold px-1">{heading}</div>

      {view === "month" && <Month cursor={cursor} byDay={byDay} today={today} onPickDay={onPickDay} />}
      {view === "week" && (
        <div className="divide-y divide-[var(--line)]">
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(startOfWeek(cursor), i);
            return <DayRow key={i} d={d} items={byDay.get(dayKey(d)) ?? []} isToday={dayKey(d) === today} onPickDay={onPickDay} />;
          })}
        </div>
      )}
      {view === "day" && <DayRow d={cursor} items={byDay.get(dayKey(cursor)) ?? []} isToday={dayKey(cursor) === today} onPickDay={onPickDay} expanded />}
      {view === "list" && (
        <div className="space-y-1">
          {items.filter((i) => new Date(i.at) >= new Date(new Date().toDateString())).slice(0, 12).map((i) => <Item key={i.id} i={i} withDate />)}
          {!items.some((i) => new Date(i.at) >= new Date(new Date().toDateString())) && <div className="empty text-sm">אין פגישות קרובות</div>}
        </div>
      )}
    </div>
  );
}

function Month({ cursor, byDay, today, onPickDay }: { cursor: Date; byDay: Map<string, CalItem[]>; today: string; onPickDay: (d: Date) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const [sel, setSel] = useState<string | null>(null);
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(start, i));
  const selItems = sel ? byDay.get(sel) ?? [] : [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 text-center caption font-semibold">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const k = dayKey(d), its = byDay.get(k) ?? [], other = d.getMonth() !== cursor.getMonth();
          return (
            <button key={k} onClick={() => its.length ? setSel(sel === k ? null : k) : onPickDay(d)}
              className={`h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm num transition-colors ${sel === k ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"} ${other ? "opacity-35" : ""}`}>
              <span className={`w-7 h-7 grid place-items-center rounded-full ${k === today ? "bg-[var(--accent)] text-[var(--accent-ink)] font-bold" : ""}`}>{d.getDate()}</span>
              <span className="flex gap-0.5 h-1.5">{its.slice(0, 3).map((i) => <span key={i.id} className={`w-1.5 h-1.5 rounded-full ${i.done ? "bg-[var(--muted)]" : "bg-[var(--accent)]"}`} />)}</span>
            </button>
          );
        })}
      </div>
      {sel && <div className="space-y-1 pt-1">{selItems.map((i) => <Item key={i.id} i={i} />)}</div>}
    </div>
  );
}

function DayRow({ d, items, isToday, onPickDay, expanded }: { d: Date; items: CalItem[]; isToday: boolean; onPickDay: (d: Date) => void; expanded?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-xl px-2 py-1.5 ${isToday ? "bg-[var(--accent-soft)]/60" : ""}`}>
      <div className="w-11 shrink-0 text-center pt-1">
        <div className="caption">{WEEKDAYS[d.getDay()]}</div>
        <div className={`num font-bold ${isToday ? "text-[var(--accent)]" : ""}`}>{d.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-1 py-0.5">
        {items.map((i) => <Item key={i.id} i={i} />)}
        {expanded ? (
          <button onClick={() => onPickDay(d)} className="w-full text-start text-sm muted rounded-lg px-2 h-9 hover:bg-[var(--surface-2)]">+ קביעת פגישה ביום הזה</button>
        ) : items.length === 0 ? (
          <button onClick={() => onPickDay(d)} aria-label={`קביעת פגישה ב-${d.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}`}
            className="group w-full h-9 rounded-lg flex items-center justify-end px-2 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)]">
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity me-1">קביעה</span><Icon name="plus" size={16} className="opacity-50 group-hover:opacity-100" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Item({ i, withDate }: { i: CalItem; withDate?: boolean }) {
  return (
    <Link href={`/b/${i.businessId}/meetings/${i.id}`}
      className={`flex items-center justify-between gap-2 rounded-lg px-3 h-10 text-sm font-semibold ${i.done ? "bg-[var(--surface-2)] muted" : "bg-[var(--accent)] text-[var(--accent-ink)]"}`}>
      <span className="truncate">{i.businessName}</span>
      <span className="num shrink-0 opacity-90">{withDate ? `${new Date(i.at).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })} · ` : ""}{fmtTime(i.at)}</span>
    </Link>
  );
}
