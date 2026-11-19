"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { Icon, Sheet, useToast } from "@/components/ui";
import { useCrm } from "@/components/crm/CrmContext";
import { fillTemplate, waLink, waNumber, type Client } from "@/lib/crm";

type Target = { client: Client; at?: string; amount?: number; prefer?: string };
const WaCtx = createContext<(t: Target) => void>(() => {});
export const useWhatsApp = () => useContext(WaCtx);

/** One sheet for every WhatsApp button: pick a template, see the filled text, open the chat. */
export function WhatsAppProvider({ children }: { children: React.ReactNode }) {
  const { data } = useCrm();
  const toast = useToast();
  const [t, setT] = useState<Target | null>(null);
  const open = useCallback((x: Target) => {
    if (!waNumber(x.client.phone)) { toast(`אין מספר טלפון ל${x.client.full_name}. אפשר להוסיף אותו בכרטיס.`); return; }
    setT(x);
  }, [toast]);
  const templates = t ? [...data.templates].sort((a, b) => (a.key === t.prefer ? -1 : b.key === t.prefer ? 1 : a.position - b.position)) : [];
  return (
    <WaCtx.Provider value={open}>
      {children}
      <Sheet open={!!t} onClose={() => setT(null)} title={t ? `וואטסאפ ל${t.client.full_name.split(" ")[0]}` : ""}>
        {t && (
          <div className="space-y-2">
            {templates.map((tpl) => {
              const text = fillTemplate(tpl.body, { name: t.client.full_name, at: t.at, amount: t.amount });
              return (
                <a key={tpl.id} href={waLink(t.client.phone, text) ?? "#"} target="_blank" rel="noreferrer" onClick={() => setT(null)}
                  className="block card p-3.5 space-y-1 active:scale-[.99] transition-transform">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{tpl.title}</span>
                    <Icon name="wa" size={18} className="text-[var(--done)]" />
                  </div>
                  <p className="text-sm text-[var(--ink-2)] leading-relaxed">{text}</p>
                </a>
              );
            })}
            <a href={`https://wa.me/${waNumber(t.client.phone)}`} target="_blank" rel="noreferrer" onClick={() => setT(null)}
              className="btn-tint w-full">פתיחת צ׳אט בלי הודעה</a>
            <p className="caption text-center">את הנוסחים אפשר לשנות בהגדרות.</p>
          </div>
        )}
      </Sheet>
    </WaCtx.Provider>
  );
}
