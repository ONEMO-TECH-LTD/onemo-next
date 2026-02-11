import type { Session, User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

type SessionResult = {
  user: User;
  session: Session;
};

/**
 * Ensure an authenticated session exists in the browser.
 * If no session, creates an anonymous one automatically.
 * Used on /create to bootstrap the design session.
 */
export async function ensureSession(): Promise<SessionResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to load auth session: ${error.message}`);
  }

  if (data.session?.user) {
    return { user: data.session.user, session: data.session };
  }

  // No existing session — create anonymous
  const anonymousAuth = await supabase.auth.signInAnonymously();

  if (
    anonymousAuth.error ||
    !anonymousAuth.data.session ||
    !anonymousAuth.data.user
  ) {
    throw new Error(
      anonymousAuth.error?.message ?? "Unable to create anonymous session"
    );
  }

  return {
    user: anonymousAuth.data.user,
    session: anonymousAuth.data.session,
  };
}

/**
 * Upgrade an anonymous session to a permanent account.
 * Uses updateUser() (NOT signUp()) to preserve the same user_id.
 * This ensures all designs created during the anonymous session
 * remain accessible after upgrade — RLS keys on auth.uid() = user_id.
 */
export async function upgradeSession(
  email: string,
  password: string
): Promise<SessionResult> {
  const supabase = createClient();

  // updateUser() promotes the anonymous user in-place.
  // The user_id stays the same — no data migration needed.
  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
  });

  if (error) {
    throw new Error(`Unable to upgrade session: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Session upgrade succeeded but user is unavailable");
  }

  // Fetch the refreshed session after upgrade
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    throw new Error(
      sessionError?.message ??
        "Session upgrade succeeded but session is unavailable"
    );
  }

  return {
    user: data.user,
    session: sessionData.session,
  };
}
