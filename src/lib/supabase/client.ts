"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createClientSupabaseClient() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createBrowserClient(url, anonKey);
}
