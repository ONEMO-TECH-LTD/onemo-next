import { NextResponse } from "next/server";

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
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

export function errorResponse(code: string, message: string, status: number) {
  const body: ErrorEnvelope = {
    ok: false,
    error: { code, message },
  };

  return NextResponse.json(body, { status });
}
