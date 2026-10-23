import { NextResponse } from "next/server";
import { trpcServices } from "~/server/trpc/services";

export const dynamic = "force-dynamic";

export async function GET() {
  const room = await trpcServices.getCurrentRoom();
  return NextResponse.json(room);
}
