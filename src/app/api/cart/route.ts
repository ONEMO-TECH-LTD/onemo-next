import { NextResponse } from "next/server";

const stubResponse = { ok: true, data: { message: "stub" } };

export async function GET() {
  return NextResponse.json(stubResponse);
}

export async function POST() {
  return NextResponse.json(stubResponse);
}
