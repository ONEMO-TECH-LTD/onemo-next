import { NextResponse } from "next/server";

import { okResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/supabase/session";

export async function GET() {
  return NextResponse.json(okResponse({ message: "stub" }));
}

export async function POST() {
  const auth = await requireAuth();

  if ("response" in auth) {
    return auth.response;
  }

  return NextResponse.json(
    okResponse({ message: "stub", userId: auth.user.id })
  );
}
