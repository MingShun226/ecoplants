"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionAdmin } from "@/lib/admin/session";
import type { OrderStatus } from "@/lib/admin/orders";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin mutations.
 *
 * Every one re-checks the session. A server action is a public HTTP endpoint —
 * being rendered behind a guarded layout protects the page, not the action, and
 * anyone can POST to it directly.
 *
 * That check is still not the enforcement. `transition_order()` refuses
 * non-admins at the database and RLS refuses the writes, so this is the outer
 * of three independent layers.
 */

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  note?: string,
): Promise<ActionResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order", {
    p_order_id: orderId,
    p_to: to,
    p_note: note?.trim() || null,
  });

  if (error) {
    // The database's own message is the useful one — "shipped -> cancelled is
    // not a legal transition" tells the operator exactly what happened.
    return { ok: false, error: error.message.replace(/^.*transition_order: /, "") };
  }

  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function updateFulfilment(
  orderId: string,
  courier: string,
  trackingNo: string,
): Promise<ActionResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("orders")
    .update({
      courier: courier.trim() || null,
      tracking_no: trackingNo.trim() || null,
    })
    .eq("id", orderId);

  if (error) return { ok: false, error: error.message };

  // Fulfilment edits belong on the timeline too: "which courier did we use" is
  // a question someone asks three weeks later.
  await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: admin.id,
    actor_name: admin.fullName,
    kind: "fulfilment",
    note: courier.trim()
      ? `Courier set to ${courier.trim()}${trackingNo.trim() ? ` · ${trackingNo.trim()}` : ""}`
      : "Courier cleared",
  });

  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function addOrderNote(orderId: string, note: string): Promise<ActionResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };

  const text = note.trim();
  if (!text) return { ok: false, error: "Note is empty." };

  const supabase = await createClient();
  const { error } = await supabase.from("order_events").insert({
    order_id: orderId,
    actor_id: admin.id,
    actor_name: admin.fullName,
    kind: "note",
    note: text,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/orders");
  return { ok: true };
}

/**
 * Staff sign in with a **username**. Not an email address.
 *
 * Supabase Auth needs a unique string to key an identity on, so the username is
 * carried as one: `admin` becomes `admin@staff.ecoplants.my`. That address is
 * never shown, never typed, and cannot be a real inbox — which is the point.
 * The shop's own domain is left free for actual mailboxes, and a customer
 * account (carried on `@phone.ecoplants.my`) can never collide with a staff one.
 *
 * `admin_users.username` is the real, unique, validated column; this only
 * derives the key from it. Same shape as customer phone numbers (ADR 0008).
 */
const STAFF_DOMAIN = "staff.ecoplants.my";

/** Mirrors the `admin_users_username_format` check constraint. */
const USERNAME = /^[a-z][a-z0-9._-]{2,29}$/;

function toEmail(username: string): string | null {
  const id = username.trim().toLowerCase();
  // An address typed in full is refused rather than passed through. Accepting
  // it would make this an email login wearing a username label, and would let
  // someone target an account on a domain we do not control.
  return USERNAME.test(id) ? `${id}@${STAFF_DOMAIN}` : null;
}

export async function signIn(username: string, password: string): Promise<ActionResult> {
  const email = toEmail(username);
  // Deliberately the same message as a wrong password: telling someone their
  // username was merely malformed still tells them it was not a real account.
  if (!email) return { ok: false, error: "Those details did not match an account." };

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Deliberately vague: distinguishing "no such account" from "wrong
    // password" hands an attacker a list of valid admin emails.
    return { ok: false, error: "Those details did not match an account." };
  }

  // Signing in is not the same as having panel access. A customer account with
  // valid credentials must not land here, so the session is discarded rather
  // than left dangling with nowhere to go.
  const admin = await getSessionAdmin();
  if (!admin) {
    await supabase.auth.signOut();
    return { ok: false, error: "That account does not have panel access." };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/**
 * Change your own password.
 *
 * The current password is re-checked here even though the caller is already
 * signed in. A live session is not proof of knowing the password — it is proof
 * of holding a cookie — and without this step a borrowed laptop or a stolen
 * session token becomes permanent ownership of the account. Supabase can
 * enforce the same rule server-side (`secure_password_change`), but that is a
 * project setting someone can switch off; this is in the code path.
 *
 * There is deliberately no "change someone else's password" here. An admin who
 * can reset a colleague's credentials can lock the owner out of their own shop,
 * and the panel has no second channel to recover from that.
 */
const MIN_PASSWORD = 12;

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string,
): Promise<ActionResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };

  if (newPassword.length < MIN_PASSWORD) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD} characters.` };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "That is the password you already have." };
  }

  const supabase = await createClient();
  const email = toEmail(admin.username);
  if (!email) return { ok: false, error: "This account cannot change its own password." };

  // Re-authenticate. Unlike sign-in, being specific is safe: whoever is asking
  // is already inside, so "wrong password" tells them nothing they could not
  // find out by trying again.
  const { error: reauth } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauth) return { ok: false, error: "That is not your current password." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
