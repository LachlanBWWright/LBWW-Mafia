/** A revoked JWT can still produce a session-shaped object with an empty subject. */
export function activeSession<T extends { user?: { id?: string } }>(
  session: T | null,
): T | null {
  return session?.user?.id ? session : null;
}
