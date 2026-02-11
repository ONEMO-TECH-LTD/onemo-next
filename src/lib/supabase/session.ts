import type { Session, User } from "@supabase/supabase-js";

import { errorResponse } from "@/lib/api/response";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";

type SessionResult = {
  user: User;
  session: Session;
};

type RequireAuthSuccess = SessionResult & {
  response: null;
};

type RequireAuthFailure = {
  user: null;
  session: null;
  response: ReturnType<typeof errorResponse>;
};

export type RequireAuthResult = RequireAuthSuccess | RequireAuthFailure;

export async function ensureSession(): Promise<SessionResult> {
  const supabase = createBrowserClient();
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw new Error(`Failed to load auth session: ${error.message}`);
  }

  if (data.session?.user) {
    return { user: data.session.user, session: data.session };
  }

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

export async function upgradeSession(
  email: string,
  password: string
): Promise<SessionResult> {
  const supabase = createBrowserClient();
  const upgradeResult = await supabase.auth.signUp({ email, password });

  if (upgradeResult.error) {
    throw new Error(`Unable to upgrade session: ${upgradeResult.error.message}`);
  }

  if (upgradeResult.data.user && upgradeResult.data.session) {
    return {
      user: upgradeResult.data.user,
      session: upgradeResult.data.session,
    };
  }

  const currentSession = await supabase.auth.getSession();

  if (currentSession.error || !currentSession.data.session?.user) {
    throw new Error(
      currentSession.error?.message ??
        "Session upgrade succeeded but session is unavailable"
    );
  }

  return {
    user: currentSession.data.session.user,
    session: currentSession.data.session,
  };
}

export async function requireAuth(): Promise<RequireAuthResult> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session?.user) {
    return {
      user: null,
      session: null,
      response: errorResponse(
        "UNAUTHORIZED",
        "Authentication is required for this endpoint.",
        401
      ),
    };
  }

  return {
    user: data.session.user,
    session: data.session,
    response: null,
  };
}
