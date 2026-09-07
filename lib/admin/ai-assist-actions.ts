"use server";

import { getSessionAdmin } from "@/lib/admin/session";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_MODEL,
  DRAFT_SCHEMA,
  buildPrompt,
  normaliseDraft,
  type PlantDraft,
} from "@/lib/admin/ai-assist";

/**
 * Draft a plant's listing from its photograph.
 *
 * Reads, never writes. The result goes into the operator's form fields and is
 * saved — or discarded — by the existing Save buttons, so a misidentified plant
 * costs a page reload rather than a correction in the shop. That is the whole
 * reason this returns a draft instead of updating the row itself.
 *
 * Like every other action here it re-checks the session, because a server
 * action is a public HTTP endpoint and the guarded layout protects the page,
 * not the endpoint. This one also spends money on each call, which makes the
 * check load-bearing rather than ceremonial.
 */

export type AssistResult =
  | { ok: true; draft: PlantDraft; usedPhoto: boolean }
  | { ok: false; error: string };

/** OpenAI accepts PNG, JPEG, WEBP and non-animated GIF. */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * The photo, as a data URL.
 *
 * Downloaded and inlined rather than passed as a link. The bucket is public
 * today, so a URL would work, but that couples "the AI can read this" to "the
 * whole internet can read this" — and the first time the bucket is locked down
 * the feature would fail with a message from OpenAI about a 400 on a URL,
 * which is nobody's idea of a clue.
 */
async function inlinePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<string | null> {
  const extension = storagePath.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_TYPES[extension];
  if (!mime) return null;

  const { data, error } = await supabase.storage.from("product-images").download(storagePath);
  if (error || !data) return null;

  const bytes = Buffer.from(await data.arrayBuffer());

  // Roughly 15MB of base64. Beyond this the request is likelier to time out
  // than to succeed, and the name alone gives a better answer than a failure.
  if (bytes.byteLength > 11_000_000) return null;

  return `data:${mime};base64,${bytes.toString("base64")}`;
}

export async function draftPlantDetails(productId: string): Promise<AssistResult> {
  const admin = await getSessionAdmin();
  if (!admin) return { ok: false, error: "Not signed in." };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "No OpenAI key is set. Add OPENAI_API_KEY to .env.local and restart the site.",
    };
  }

  const supabase = await createClient();

  const { data: row, error: readError } = await supabase
    .from("products")
    .select("name_botanical, product_translations ( locale, name ), product_images ( storage_path, is_primary, position )")
    .eq("id", productId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!row) return { ok: false, error: "That plant no longer exists." };

  const product = row as {
    name_botanical: string | null;
    product_translations: { locale: string; name: string }[] | null;
    product_images: { storage_path: string; is_primary: boolean; position: number }[] | null;
  };

  // English is the source locale, so it is the name the shop actually calls
  // this plant. Without it there is nothing to identify and nothing to write.
  const name = (product.product_translations ?? []).find((t) => t.locale === "en")?.name?.trim();
  if (!name) return { ok: false, error: "Give the plant an English name first." };

  // The cover shot, or failing that the first one. A lifestyle photo of a
  // styled shelf identifies a species far less well than the catalogue shot,
  // and the cover is the catalogue shot by definition.
  const images = [...(product.product_images ?? [])].sort(
    (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.position - b.position,
  );
  const photo = images[0] ? await inlinePhoto(supabase, images[0].storage_path) : null;

  const prompt = buildPrompt({
    name,
    botanical: product.name_botanical?.trim() ?? "",
    hasPhoto: photo !== null,
  });

  const content: Record<string, unknown>[] = [{ type: "input_text", text: prompt }];
  if (photo) content.push({ type: "input_image", image_url: photo, detail: "auto" });

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "plant_listing",
            strict: true,
            schema: DRAFT_SCHEMA,
          },
        },
      }),
      // A plant listing in three languages takes a while. Past this the
      // operator has given up anyway, and an abandoned request still bills.
      signal: AbortSignal.timeout(90_000),
    });
  } catch (cause) {
    const timedOut = cause instanceof Error && cause.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut
        ? "The AI took too long to answer. Try again."
        : "Could not reach OpenAI. Check the internet connection and try again.",
    };
  }

  if (!response.ok) {
    // The body carries the useful half — a bad key, an exhausted quota, a model
    // name that does not exist. Surfacing the status alone sends someone
    // hunting through dashboards for something the response already said.
    const detail = await response
      .json()
      .then((body) => (body as { error?: { message?: string } })?.error?.message ?? "")
      .catch(() => "");

    if (response.status === 401) return { ok: false, error: "OpenAI rejected the key. Check OPENAI_API_KEY." };
    if (response.status === 429) {
      return { ok: false, error: "OpenAI is rate-limiting or the account is out of credit." };
    }
    return { ok: false, error: detail || `OpenAI returned ${response.status}.` };
  }

  const body = (await response.json()) as {
    output_text?: string;
    output?: { content?: { type?: string; text?: string; refusal?: string }[] }[];
  };

  // `output_text` is the convenience field; the array is what it is derived
  // from, and it is the only place a refusal shows up.
  const parts = (body.output ?? []).flatMap((item) => item.content ?? []);
  const refusal = parts.find((p) => p.refusal)?.refusal;
  if (refusal) return { ok: false, error: `The AI declined: ${refusal}` };

  const text = body.output_text ?? parts.find((p) => p.type === "output_text")?.text ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "The AI replied in a form we could not read. Try again." };
  }

  const draft = normaliseDraft(parsed);
  if (!draft) {
    return { ok: false, error: "The AI did not identify the plant. Try a clearer photo." };
  }

  return { ok: true, draft, usedPhoto: photo !== null };
}
