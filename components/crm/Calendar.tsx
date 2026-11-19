"use client";
import { useMemo, useState } from "react";
import { Icon, Seg } from "@/components/ui";
import { fmtTime } from "@/lib/domain";

export type CalItem = { id: string; at: string; title: string; tone: "scheduled" | "done" | "muted" | "warn" };
export type CalView = "month" | "week" | "day" | "list";

const WEEKDAYS = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const startOfWeek = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const TONE: Record<CalItem["tone"], string> = {
  scheduled: "bg-[var(--accent)] text-[var(--accent-ink)]",
  done: "bg-[var(--done-soft)] text-[var(--done)]",
  warn: "bg-[var(--mark-soft)] text-[var(--mark)]",
  muted: "bg-[var(--surface-2)] muted line-through",
};

export function Calendar({ items, view, onView, onPickDay, onOpen }: {
  items: CalItem[]; view: CalView; onView: (v: CalView) => void; onPickDay: (d: Date) => void; onOpen: (id: string) => void;
}) {
  const [cursor, setCursor] = useState(() => new Date());
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    items.forEach((i) => { const k = dayKey(new Date(i.at)); m.set(k, [...(m.get(k) ?? []), i]); });
    m.forEach((v) => v.sort((a, b) => a.at.localeCompare(b.at)));
    return m;
  }, [items]);
  const today = dayKey(new Date());

  function move(dir: 1 | -1) {
    const x = new Date(cursor);
    if (view === "month") x.setMonth(x.getMonth() + dir);
    else if (view === "week") x.setDate(x.getDate() + 7 * dir);
    else x.setDate(x.getDate() + dir);
    setCursor(x);
  }
  const heading = view === "month" ? cursor.toLocaleDateString("he-IL", { month: "long", year: "numeric" })
    : view === "week" ? `${startOfWeek(cursor).toLocaleDateString("he-IL", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(cursor), 6).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}`
    : view === "day" ? cursor.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) : "המפגשים הקרובים";
  const upcoming = items.filter((i) => new Date(i.at) >= new Date(new Date().toDateString()) && i.tone !== "muted");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Seg label="תצוגת יומן" value={view} onChange={onView}
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

      <div className="card p-2">
        {view === "month" && <Month cursor={cursor} byDay={byDay} today={today} onPickDay={onPickDay} onOpen={onOpen} />}
        {view === "week" && (
          <div className="divide-y divide-[var(--line)]">
            {Array.from({ length: 7 }).map((_, i) => {
              const d = addDays(startOfWeek(cursor), i);
              return <DayRow key={i} d={d} items={byDay.get(dayKey(d)) ?? []} isToday={dayKey(d) === today} onPickDay={onPickDay} onOpen={onOpen} />;
            })}
          </div>
        )}
        {view === "day" && <DayRow d={cursor} items={byDay.get(dayKey(cursor)) ?? []} isToday={dayKey(cursor) === today} onPickDay={onPickDay} onOpen={onOpen} expanded />}
        {view === "list" && (
          <div className="space-y-1 p-1">
            {upcoming.slice(0, 30).map((i) => <Item key={i.id} i={i} onOpen={onOpen} withDate />)}
            {!upcoming.length && <div className="empty text-sm">אין מפגשים קרובים. הקישו על + כדי לקבוע.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function Month({ cursor, byDay, today, onPickDay, onOpen }: { cursor: Date; byDay: Map<string, CalItem[]>; today: string; onPickDay: (d: Date) => void; onOpen: (id: string) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = startOfWeek(first);
  const [sel, setSel] = useState<string | null>(null);
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(start, i));
  const selItems = sel ? byDay.get(sel) ?? [] : [];
  const selDate = sel ? cells.find((d) => dayKey(d) === sel) : null;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 text-center caption font-semibold pt-1">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d) => {
          const k = dayKey(d), its = byDay.get(k) ?? [], other = d.getMonth() !== cursor.getMonth();
          return (
            <button key={k} onClick={() => setSel(sel === k ? null : k)}
              className={`h-12 rounded-lg flex flex-col items-center justify-center gap-0.5 text-sm num transition-colors ${sel === k ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"} ${other ? "opacity-35" : ""}`}>
              <span className={`w-7 h-7 grid place-items-center rounded-full ${k === today ? "bg-[var(--accent)] text-[var(--accent-ink)] font-bold" : ""}`}>{d.getDate()}</span>
              <span className="flex gap-0.5 h-1.5">{its.slice(0, 4).map((i) => <span key={i.id} className={`w-1.5 h-1.5 rounded-full ${i.tone === "scheduled" ? "bg-[var(--accent)]" : i.tone === "done" ? "bg-[var(--done)]" : "bg-[var(--muted)]"}`} />)}</span>
            </button>
          );
        })}
      </div>
      {sel && selDate && (
        <div className="space-y-1 pt-1 px-1">
          {selItems.map((i) => <Item key={i.id} i={i} onOpen={onOpen} />)}
          <button onClick={() => onPickDay(selDate)} className="w-full text-start text-sm muted rounded-lg px-2 h-9 hover:bg-[var(--surface-2)]">+ מפגש ב-{selDate.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}</button>
        </div>
      )}
    </div>
  );
}

function DayRow({ d, items, isToday, onPickDay, onOpen, expanded }: { d: Date; items: CalItem[]; isToday: boolean; onPickDay: (d: Date) => void; onOpen: (id: string) => void; expanded?: boolean }) {
  return (
    <div className={`flex gap-3 rounded-xl px-2 py-1.5 ${isToday ? "bg-[var(--accent-soft)]/60" : ""}`}>
      <div className="w-11 shrink-0 text-center pt-1">
        <div className="caption">{WEEKDAYS[d.getDay()]}</div>
        <div className={`num font-bold ${isToday ? "text-[var(--accent)]" : ""}`}>{d.getDate()}</div>
      </div>
      <div className="flex-1 min-w-0 space-y-1 py-0.5">
        {items.map((i) => <Item key={i.id} i={i} onOpen={onOpen} />)}
        {expanded || items.length === 0 ? (
          <button onClick={() => onPickDay(d)} aria-label={`מפגש חדש ב-${d.toLocaleDateString("he-IL", { day: "numeric", month: "long" })}`}
            className="w-full h-9 rounded-lg flex items-center gap-1 px-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--accent)]">
            <Icon name="plus" size={16} className="opacity-60" />{expanded ? "מפגש חדש ביום הזה" : ""}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Item({ i, withDate, onOpen }: { i: CalItem; withDate?: boolean; onOpen: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onOpen(i.id)}
      className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 h-10 text-sm font-semibold text-start active:scale-[.99] transition-transform ${TONE[i.tone]}`}>
      <span className="truncate">{i.title}</span>
      <span className="num shrink-0 opacity-90">{withDate ? `${new Date(i.at).toLocaleDateString("he-IL", { weekday: "short", day: "numeric", month: "numeric" })} · ` : ""}{fmtTime(i.at)}</span>
    </button>
  );
}
