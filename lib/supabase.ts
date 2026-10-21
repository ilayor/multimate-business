import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Public values (the publishable key is meant for the browser; RLS enforces access).
// Env vars override them; the service-role key must never appear here.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mlchjmbbiwhpgbcjnlka.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_ZXqiyElMCs-45wbu6uYS7Q_YOGDdwSo";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) client = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return client;
}
