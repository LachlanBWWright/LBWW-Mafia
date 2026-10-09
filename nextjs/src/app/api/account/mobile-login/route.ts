import { NextResponse } from "next/server";
export function POST() {
  return NextResponse.json(
    { error: "Use Google to sign in." },
    { status: 410 },
  );
}
