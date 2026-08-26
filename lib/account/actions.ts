"use server";

import { revalidatePath } from "next/cache";
import { getSessionCustomer } from "@/lib/account/session";
import { normalisePhone, passwordProblem, toAuthEmail } from "@/lib/account/phone";
import { createClient } from "@/lib/supabase/server";

/**
 * Customer sign up, sign in, sign out and profile.
 *
 * Phone rather than email because that is how this market works: a customer
 * gives you a number, expects to hear from you on WhatsApp, and may not have an
 * email they check.
 *
 * Supabase's own `phone` identity type is deliberately **not** used. It is tied
 * to the SMS subsystem — the Phone provider will not save without an SMS
 * provider configured, even with confirmations off and nothing ever sent. Since
 * this shop sends no codes, the number is carried as a synthetic address
 * (`toAuthEmail`) that nobody sees, and `customers.phone` holds the real E.164.
 * No SMS provider, no OTP, no unused third-party credentials in the config.
 *
 * **There is no OTP step, by design.** Signing up and signing in are the phone
 * number and a password, nothing else. That means the number is unverified —
 * anyone can register with anyone's number — which is why a new account is
 * never handed past guest orders on the strength of a matching number. Orders
 * are claimed by holding the receipt link instead, which is a real secret. See
 * ADR 0008.
 */

export type AuthResult = { ok: true } | { ok: false; error: string };

/** Vague on purpose: a precise error hands an attacker a list of real numbers. */
const MISMATCH = "That number and password do not match an account.";

export async function signUp(
  rawPhone: string,
  password: string,
  fullName: string,
): Promise<AuthResult> {
  const phone = normalisePhone(rawPhone);
  if (!phone) {
    return { ok: false, error: "Enter a Malaysian mobile number, like 012-345 6789." };
  }

  const weak = passwordProblem(password);
  if (weak) return { ok: false, error: weak };

  if (!fullName.trim()) {
    return { ok: false, error: "We need a name for the delivery label." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: toAuthEmail(phone),
    password,
    // The `customers` row is created by a database trigger on insert into
    // auth.users, which reads this metadata. Doing it here instead would leave
    // a half-made account behind whenever the second write failed.
    //
    // `phone` in the metadata is also what marks this as a shopping account:
    // staff are provisioned server-side without it and never get a customers
    // row. The trigger re-normalises it rather than trusting what arrives.
    options: { data: { full_name: fullName.trim(), phone } },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, error: "That number already has an account. Sign in instead." };
    }
    if (/signups? (are )?disabled|not enabled/i.test(error.message)) {
      // Only reachable if email signups are switched off in the dashboard.
      return {
        ok: false,
        error: "Accounts are not switched on yet. Please order as a guest for now.",
      };
    }
    return { ok: false, error: error.message };
  }

  // No session means Supabase is waiting on a confirmation it cannot deliver —
  // "Confirm email" is on in the dashboard, and these addresses are synthetic so
  // no message could ever arrive. Without this the account exists, the customer
  // is not signed in, and they get bounced between /account and /login with
  // nothing explaining why.
  if (!data.session) {
    return {
      ok: false,
      error:
        "Your account was created but could not be signed in. Confirmations need switching off in Supabase — ask us, or order as a guest for now.",
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signIn(rawPhone: string, password: string): Promise<AuthResult> {
  const phone = normalisePhone(rawPhone);
  // Deliberately the same message as a wrong password: distinguishing "no such
  // number" from "wrong password" tells an attacker which numbers are real.
  if (!phone) return { ok: false, error: MISMATCH };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(phone),
    password,
  });

  if (error) return { ok: false, error: MISMATCH };

  // Signing in is not the same as having a shopping account. A staff member
  // has no `customers` row, so the session is discarded rather than left
  // dangling on a page that would show them nothing.
  const customer = await getSessionCustomer();
  if (!customer) {
    await supabase.auth.signOut();
    return { ok: false, error: MISMATCH };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
}

export async function updateProfile(fullName: string): Promise<AuthResult> {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false, error: "You are not signed in." };

  if (!fullName.trim()) {
    return { ok: false, error: "We need a name for the delivery label." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ full_name: fullName.trim() })
    .eq("id", customer.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Attach a guest order to the signed-in account.
 *
 * The capability is the order id itself — 122 bits handed to one person at
 * checkout and never listed anywhere. Anyone holding it can already read the
 * order through the receipt page, so claiming grants nothing new; it only makes
 * that access survive losing the link.
 *
 * This is what replaces matching orders by phone number, which is not safe
 * without SMS verification and never will be, because verification is not being
 * added (ADR 0008).
 */
export async function claimOrder(orderId: string): Promise<AuthResult> {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false, error: "You are not signed in." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_order", { p_order_id: orderId });

  if (error) {
    return { ok: false, error: error.message.replace(/^.*?claim_order: /, "") };
  }

  // false means the order already belongs to a different account. Someone was
  // forwarded the link; it is not theirs to take.
  if (data !== true) {
    return { ok: false, error: "This order already belongs to another account." };
  }

  revalidatePath("/account");
  revalidatePath("/", "layout");
  return { ok: true };
}
