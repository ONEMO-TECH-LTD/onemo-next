import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function ensureSession(): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (currentUser) {
    return currentUser;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    throw new Error(
      `Failed to create anonymous session: ${error?.message ?? "Unknown error"}`,
    );
  }

  return data.user;
}
