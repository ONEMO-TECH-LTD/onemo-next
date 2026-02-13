import { NextResponse } from "next/server";

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

type SuccessEnvelope<T> = {
  ok: true;
  data: T;
};

export function okResponse<T>(data: T, status = 200) {
  const body: SuccessEnvelope<T> = { ok: true, data };
  return NextResponse.json(body, { status });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  const body: ErrorEnvelope = {
    ok: false,
    error: { code, message, ...(details !== undefined && { details }) },
  };

  return NextResponse.json(body, { status });
}
