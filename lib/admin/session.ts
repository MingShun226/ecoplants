import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin session helpers.
 *
 * Every read goes through the user-scoped client, so RLS decides what comes
 * back. `getSessionAdmin` is a second gate on top of that, not a substitute for
 * it: if the policies were the only defence, one missing filter in a server
 * component would quietly expose customer addresses. The route guard and the
 * policies are meant to fail independently.
 */

export type AdminRole = "owner" | "manager" | "staff";

export interface AdminSession {
  id: string;
  authUserId: string;
  username: string;
  fullName: string;
  role: AdminRole;
}

/** The signed-in admin, or null. Never invents one. */
export async function getSessionAdmin(): Promise<AdminSession | null> {
  const supabase = await createClient();

  // getUser(), never getSession(): the latter reads a cookie the client can
  // forge and does not revalidate the token against the auth server.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("admin_users")
    .select("id, auth_user_id, username, full_name, role, is_active")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    authUserId: data.auth_user_id as string,
    username: data.username as string,
    fullName: data.full_name as string,
    role: data.role as AdminRole,
  };
}

const RANK: Record<AdminRole, number> = { staff: 1, manager: 2, owner: 3 };

export function hasRole(session: AdminSession | null, min: AdminRole): boolean {
  return session ? RANK[session.role] >= RANK[min] : false;
}
