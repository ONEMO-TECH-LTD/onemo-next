import { okResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/supabase/session";

export async function GET() {
  return okResponse({ message: "stub" });
}

export async function POST() {
  const authResult = await requireAuth();

  if (authResult.response) {
    return authResult.response;
  }

  return okResponse({
    message: "stub",
    userId: authResult.user.id,
  });
}
