import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export type UpgradeSessionInput = {
  email: string;
  password: string;
};

export async function upgradeSession({
  email,
  password,
}: UpgradeSessionInput): Promise<User> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  if (!currentUser) {
    throw new Error("Cannot upgrade account without an active session");
  }

  if (!currentUser.is_anonymous) {
    return currentUser;
  }

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error || !data.user) {
    throw new Error(
      `Failed to upgrade anonymous session: ${error?.message ?? "Unknown error"}`,
    );
  }

  if (data.user.id !== currentUser.id) {
    throw new Error(
      "Account upgrade returned a different user_id. Session continuity was not preserved.",
    );
  }

  return data.user;
}
