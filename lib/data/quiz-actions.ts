"use server";

import { cookies } from "next/headers";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Recording what people tell the plant finder.
 *
 * The quiz has always computed its recommendations client-side and written
 * nothing, so the admin's "Quiz answers" screen has been showing an empty table
 * since it was built. This is the missing half.
 *
 * It is zero-party data — volunteered, not inferred — which is the only kind
 * worth having: "most people say low light and no time" is a buying decision,
 * where anything guessed from browsing behaviour is a hunch.
 */

/**
 * Groups a person's answers without identifying them.
 *
 * Not the cart cookie and not an auth session: a browser-scoped random id, so
 * retaking the quiz replaces rather than duplicates, and nothing here ties back
 * to a person. `customer_id` stays null even for a signed-in customer — the
 * value is in the aggregate, and an answer about someone's bedroom light is not
 * something to attach to their order history without asking.
 */
const SESSION_COOKIE = "ep_quiz";
const SESSION_MAX_AGE = 60 * 60 * 24 * 180;

export async function recordQuizResponse(
  answers: Record<string, string>,
  recommendedRefs: string[],
  locale: string,
): Promise<void> {
  // Deliberately returns nothing and throws nothing. A shopper finishing the
  // quiz must see their plants whether or not analytics wrote a row; this is
  // the least important thing happening on that screen.
  try {
    if (!answers || Object.keys(answers).length === 0) return;

    const jar = await cookies();
    let sessionId = jar.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      jar.set(SESSION_COOKIE, sessionId, {
        maxAge: SESSION_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }

    const supabase = createPublicClient();

    // Through record_quiz_response(), not a table write. An upsert needs
    // UPDATE, and an UPDATE policy loose enough for anon would let anyone
    // rewrite anyone else's answers — so the narrow permission lives in a
    // function that only ever touches the row for this session.
    await supabase.rpc("record_quiz_response", {
      p_session_id: sessionId,
      p_answers: answers,
      p_refs: recommendedRefs,
      p_locale: locale,
    });
  } catch {
    // Swallowed on purpose, per the note above.
  }
}
