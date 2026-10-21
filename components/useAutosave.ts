"use client";
import { useEffect, useRef, useState } from "react";

// Debounced autosave with visible status and a beforeunload guard while unsaved.
export function useAutosave<T>(value: T, save: (v: T) => Promise<boolean>, delay = 800) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const first = useRef(true);
  const dirty = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    dirty.current = true;
    setState("saving");
    const t = setTimeout(async () => {
      const ok = await saveRef.current(value);
      dirty.current = !ok;
      setState(ok ? "saved" : "error");
    }, delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  return state;
}
