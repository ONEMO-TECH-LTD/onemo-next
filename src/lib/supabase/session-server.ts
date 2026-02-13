import type { User } from "@supabase/supabase-js";

import { errorResponse } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

type RequireAuthSuccess = {
  user: User;
  response: null;
};

type RequireAuthFailure = {
  user: null;
  response: ReturnType<typeof errorResponse>;
};

export type RequireAuthResult = RequireAuthSuccess | RequireAuthFailure;

/**
 * Server-side auth guard for API routes.
 * Uses getUser() (NOT getSession()) — getUser() makes a network call
 * to Supabase to validate the token, while getSession() only reads
 * the unverified cookie payload.
 */
export async function requireAuth(): Promise<RequireAuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      response: errorResponse(
        "AUTH_REQUIRED",
        "Authentication is required for this endpoint.",
        401
      ),
    };
  }

  return {
    user,
    response: null,
  };
}
