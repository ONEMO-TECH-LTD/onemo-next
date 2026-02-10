import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ASSET_VERIFICATION_FAILED"
  | "MODERATION_BLOCKED"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR";

export function okResponse<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  details: Record<string, unknown> = {},
) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}
