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
 * Step 1 of anonymous → permanent upgrade: link an email identity.
 *
 * Calls updateUser({ email }) which triggers a verification email.
 * The user must click the link / enter OTP before a password can be set.
 * Uses updateUser() (NOT signUp()) to preserve the same user_id,
 * so all designs created during the anonymous session stay accessible
 * — RLS keys on auth.uid() = user_id.
 */
export async function linkEmail(email: string): Promise<SessionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.updateUser({ email });

  if (error) {
    throw new Error(`Unable to link email: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Email link succeeded but user is unavailable");
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    throw new Error(
      sessionError?.message ??
        "Email link succeeded but session is unavailable"
    );
  }

  return { user: data.user, session: sessionData.session };
}

/**
 * Step 2 of anonymous → permanent upgrade: set password.
 *
 * Must only be called AFTER the user has verified their email
 * (clicked link / entered OTP from Step 1).
 * Supabase requires email verification before a password can be set
 * on an anonymous-to-permanent upgrade.
 */
export async function setPassword(password: string): Promise<SessionResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw new Error(`Unable to set password: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("Password update succeeded but user is unavailable");
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !sessionData.session) {
    throw new Error(
      sessionError?.message ??
        "Password update succeeded but session is unavailable"
    );
  }

  return { user: data.user, session: sessionData.session };
}
