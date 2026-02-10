import { createClient } from "@supabase/supabase-js";

import {
  getSupabasePublicConfig,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/config";

export function createAdminSupabaseClient() {
  const { url } = getSupabasePublicConfig();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
