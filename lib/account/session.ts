import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in customer.
 *
 * Mirrors `lib/admin/session.ts` and for the same reasons: `getUser()` rather
 * than `getSession()`, because the latter reads a cookie the client can forge
 * and does not revalidate the token against the auth server.
 *
 * A customer is an auth user **with a row in `customers`**, exactly as an admin
 * is one with a row in `admin_users`. The two are separate identities against
 * the same provider: a staff member signing in must not acquire a shopping
 * account, and a customer must never reach the panel (ADR 0006).
 */

export interface CustomerSession {
  id: string;
  phone: string;
  fullName: string | null;
}

async function fetchCustomer(): Promise<CustomerSession | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;

  const row = data as { id: string; full_name: string | null; phone: string | null };
  return {
    id: row.id,
    // customers.phone carries the +; auth.users.phone does not.
    phone: row.phone ?? (user.phone ? `+${user.phone}` : ""),
    fullName: row.full_name,
  };
}

/**
 * Deduped per render pass. The header asks whether anyone is signed in on every
 * page; without this, a page that also renders the account area would verify
 * the same token twice against the auth server.
 */
export const getSessionCustomer = cache(fetchCustomer);
