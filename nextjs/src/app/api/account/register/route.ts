import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { userRoles, users } from "@mernmafia/db/schema";
import { db } from "~/server/db";
import { hashPassword } from "~/server/auth/password";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(255),
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(10).max(128),
});

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid name, handle, email, and 10+ character password." }, { status: 400 });
  }
  const { name, handle, email, password } = parsed.data;
  const existing = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.email, email), eq(users.handle, handle))).limit(1);
  if (existing.length) {
    return NextResponse.json({ error: "That email or handle is already registered." }, { status: 409 });
  }
  await db.transaction(async (tx) => {
    const [created] = await tx.insert(users).values({ name, handle, email, emailVerified: null, passwordHash: await hashPassword(password) }).returning({ id: users.id });
    if (!created) throw new Error("Account creation failed");
    await tx.insert(userRoles).values({ userId: created.id, role: "player" });
  });
  return NextResponse.json({ success: true }, { status: 201 });
}
