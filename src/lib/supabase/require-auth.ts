import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RequireAuthSuccess = {
  ok: true;
  user: User;
};

type RequireAuthFailure = {
  ok: false;
  response: NextResponse;
};

export type RequireAuthResult = RequireAuthSuccess | RequireAuthFailure;

export async function requireAuth(): Promise<RequireAuthResult> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: errorResponse(401, "AUTH_REQUIRED", "Authentication required"),
    };
  }

  if (user.is_anonymous) {
    return {
      ok: false,
      response: errorResponse(403, "FORBIDDEN", "Account required", {
        reason: "ACCOUNT_UPGRADE_REQUIRED",
      }),
    };
  }

  return { ok: true, user };
}
