import type { Session, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { errorResponse } from "@/lib/api/response";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { createClient as createServerClient } from "@/lib/supabase/server";

type SessionResult = {
  session: Session;
  user: User;
};

export async function ensureSession(): Promise<SessionResult> {
  const supabase = createBrowserClient();

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (session?.user) {
    return { session, user: session.user };
  }

  const {
    data: { session: anonymousSession, user },
    error: signInError,
  } = await supabase.auth.signInAnonymously();

  if (signInError) {
    throw signInError;
  }

  if (!anonymousSession || !user) {
    throw new Error("Failed to create anonymous session");
  }

  return { session: anonymousSession, user };
}

export async function upgradeSession(
  email: string,
  password: string
): Promise<SessionResult> {
  const supabase = createBrowserClient();

  const {
    data: { session, user },
    error,
  } = await supabase.auth.signUp({ email, password });

  if (error) {
    throw error;
  }

  if (!session || !user) {
    throw new Error("Failed to upgrade anonymous session");
  }

  return { session, user };
}

export async function requireAuth(): Promise<
  | SessionResult
  | {
      response: NextResponse;
    }
> {
  const supabase = await createServerClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.user) {
    return {
      response: NextResponse.json(
        errorResponse("UNAUTHORIZED", "Authentication required", 401),
        { status: 401 }
      ),
    };
  }

  return { session, user: session.user };
}
