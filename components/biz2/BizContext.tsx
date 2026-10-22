"use client";
import { createContext, useContext } from "react";
import type { Business } from "@/lib/domain";

export type BizCtx = { biz: Business; isConsultant: boolean; userId: string; refresh: () => void };
export const BizContext = createContext<BizCtx | null>(null);
export function useBiz() {
  const v = useContext(BizContext);
  if (!v) throw new Error("useBiz outside business layout");
  return v;
}
