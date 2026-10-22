"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useBiz } from "@/components/biz2/BizContext";
import { Field, Icon, PageHeader, SaveState, Skeleton, useAutosave, useToast } from "@/components/ui";
import { Characterization } from "@/components/biz2/Characterization";

type LinkItem = { label: string; url: string };
type Service = { name: string; price: string; note: string };
type Profile = {
  name: string; profession: string; owner_name: string; phone: string; email: string; description: string;
  target_segments: string; vision: string; baseline_notes: string; offerings: string;
  social_links: LinkItem[]; sites: LinkItem[]; services: Service[]; logo_path: string | null;
};
const COLS = "name,profession,owner_name,phone,email,description,target_segments,vision,baseline_notes,offerings,social_links,sites,services,logo_path";

export default function ProfilePage() {
  const { biz } = useBiz();
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => {
    supabase().from("businesses").select(COLS).eq("id", biz.id).single().then(({ data }) => {
      const d = data as Record<string, unknown>;
      const s = (k: string) => (d[k] as string | null) ?? "";
      setP({
        name: s("name"), profession: s("profession"), owner_name: s("owner_name"), phone: s("phone"), email: s("email"),
        description: s("description"), target_segments: s("target_segments"), vision: s("vision"), baseline_notes: s("baseline_notes"), offerings: s("offerings"),
        social_links: (d.social_links as LinkItem[]) ?? [], sites: (d.sites as LinkItem[]) ?? [], services: (d.services as Service[]) ?? [],
        logo_path: (d.logo_path as string | null) ?? null,
      });
    });
  }, [biz.id]);
  if (!p) return <Skeleton h={80} n={4} />;
  return <ProfileForm initial={p} />;
}

function ProfileForm({ initial }: { initial: Profile }) {
  const { biz, refresh, isConsultant } = useBiz();
  const toast = useToast();
  const [p, setP] = useState(initial);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const state = useAutosave(p, async (v) => {
    if (!isConsultant) return true;
    const { logo_path, ...rest } = v;
    void logo_path;
    const { error } = await supabase().from("businesses").update({ ...rest, name: rest.name.trim() || biz.name, updated_at: new Date().toISOString() }).eq("id", biz.id);
    if (!error && (rest.name !== biz.name || rest.profession !== (biz.profession ?? ""))) refresh();
    return !error;
  }, 800);

  useEffect(() => {
    if (!p.logo_path) { setLogoUrl(null); return; }
    supabase().storage.from("business-files").createSignedUrl(p.logo_path, 3600).then(({ data }) => setLogoUrl(data?.signedUrl ?? null));
  }, [p.logo_path]);

  async function uploadLogo(file: File) {
    if (!file.type.startsWith("image/")) { toast("צריך לבחור קובץ תמונה"); return; }
    const path = `${biz.id}/profile/logo-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase().storage.from("business-files").upload(path, file, { contentType: file.type });
    if (error) { toast(`התמונה לא הועלתה: ${error.message}`); return; }
    if (p.logo_path) await supabase().storage.from("business-files").remove([p.logo_path]);
    await supabase().from("businesses").update({ logo_path: path }).eq("id", biz.id);
    setP({ ...p, logo_path: path }); refresh();
  }

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP({ ...p, [k]: v });
  const digits = p.phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;

  return (
    <div className="space-y-6">
      <PageHeader title="פרופיל העסק" subtitle="כל הנתונים היבשים של העסק במקום אחד" actions={<SaveState state={state} />} />

      {/* identity */}
      <div className="card p-4 flex items-center gap-4">
        <button className="relative shrink-0 group" onClick={() => fileRef.current?.click()} aria-label="החלפת תמונה">
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoUrl} alt="" className="w-20 h-20 rounded-3xl object-cover" />
            : <span className="grid place-items-center w-20 h-20 rounded-3xl bg-[var(--accent-soft)] text-[var(--accent)] text-3xl font-extrabold">{p.name[0]}</span>}
          <span className="absolute -bottom-1 -end-1 grid place-items-center w-8 h-8 rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow"><Icon name="camera" size={16} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
        <div className="flex-1 min-w-0 space-y-2">
          <input className="input !text-xl !font-extrabold" value={p.name} onChange={(e) => set("name", e.target.value)} aria-label="שם העסק" />
          <input className="input" value={p.profession} placeholder="מקצוע / תחום" onChange={(e) => set("profession", e.target.value)} aria-label="מקצוע" />
        </div>
      </div>

      <Section title="בעל/ת העסק ופרטי קשר">
        <Field label="שם"><input className="input" value={p.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="טלפון"><input className="input" type="tel" dir="ltr" value={p.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
          <Field label="אימייל"><input className="input" type="email" dir="ltr" value={p.email} onChange={(e) => set("email", e.target.value)} /></Field>
        </div>
        {(digits || p.email) && (
          <div className="flex flex-wrap gap-2">
            {digits && <a className="btn-tint" href={`tel:${p.phone}`}><Icon name="phone" size={18} /> חיוג</a>}
            {digits && <a className="btn-tint" href={`https://wa.me/${intl}`} target="_blank" rel="noopener">וואטסאפ</a>}
            {p.email && <a className="btn-tint" href={`mailto:${p.email}`}><Icon name="mail" size={18} /> מייל</a>}
          </div>
        )}
      </Section>

      <Section title="על העסק">
        <Field label="תיאור חופשי"><textarea className="input" value={p.description} onChange={(e) => set("description", e.target.value)} placeholder="מה העסק עושה, למי, ואיך" /></Field>
        <Field label="קהל יעד"><textarea className="input" value={p.target_segments} onChange={(e) => set("target_segments", e.target.value)} /></Field>
        <Field label="חזון"><textarea className="input" value={p.vision} onChange={(e) => set("vision", e.target.value)} placeholder="איפה העסק בעוד שנה, ובעוד 3 שנים" /></Field>
      </Section>

      <Section title="אפיון ראשוני">
        <Characterization businessId={biz.id} canEdit={isConsultant} />
      </Section>

      <Section title="שירותים ומחירים">
        {p.services.map((s, i) => (
          <div key={i} className="rounded-xl bg-[var(--surface-2)] p-3 space-y-2">
            <div className="flex gap-2">
              <input className="input !bg-[var(--surface)] flex-1" placeholder="שם השירות" value={s.name} onChange={(e) => set("services", p.services.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} aria-label="שם השירות" />
              <input className="input !bg-[var(--surface)] w-28 num" placeholder="מחיר ₪" value={s.price} onChange={(e) => set("services", p.services.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} aria-label="מחיר" />
              <button className="icon-btn !text-[var(--muted)]" aria-label="הסרת שירות" onClick={() => set("services", p.services.filter((_, j) => j !== i))}><Icon name="close" size={18} /></button>
            </div>
            <input className="input !bg-[var(--surface)]" placeholder="פירוט (משך, מה כלול)" value={s.note} onChange={(e) => set("services", p.services.map((x, j) => j === i ? { ...x, note: e.target.value } : x))} aria-label="פירוט" />
          </div>
        ))}
        <button className="btn-tint" onClick={() => set("services", [...p.services, { name: "", price: "", note: "" }])}><Icon name="plus" size={18} /> שירות</button>
      </Section>

      <LinksSection title="רשתות חברתיות" items={p.social_links} onChange={(v) => set("social_links", v)} labelHint="פייסבוק / אינסטגרם / טיקטוק" />
      <LinksSection title="אתרים ודפי נחיתה" items={p.sites} onChange={(v) => set("sites", v)} labelHint="אתר / דף נחיתה" />

      <Section title="הערות ונתוני בסיס">
        <Field label="מה מאומת ומה עדיין השערה"><textarea className="input" value={p.baseline_notes} onChange={(e) => set("baseline_notes", e.target.value)} /></Field>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2"><h2 className="eyebrow px-1">{title}</h2><div className="card p-4 space-y-3">{children}</div></section>;
}

function LinksSection({ title, items, onChange, labelHint }: { title: string; items: LinkItem[]; onChange: (v: LinkItem[]) => void; labelHint: string }) {
  return (
    <Section title={title}>
      {items.map((l, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input className="input w-32 shrink-0" placeholder={labelHint.split(" / ")[0]} value={l.label} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} aria-label="שם" />
          <input className="input flex-1" dir="ltr" placeholder="https://" value={l.url} onChange={(e) => onChange(items.map((x, j) => j === i ? { ...x, url: e.target.value } : x))} aria-label="קישור" />
          {l.url && <a className="icon-btn" href={/^https?:/.test(l.url) ? l.url : `https://${l.url}`} target="_blank" rel="noopener" aria-label="פתיחה"><Icon name="link" size={18} /></a>}
          <button className="icon-btn !text-[var(--muted)]" aria-label="הסרה" onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="close" size={18} /></button>
        </div>
      ))}
      <button className="btn-tint" onClick={() => onChange([...items, { label: "", url: "" }])}><Icon name="plus" size={18} /> קישור</button>
    </Section>
  );
}
