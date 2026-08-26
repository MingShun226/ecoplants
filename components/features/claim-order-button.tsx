"use client";

import { BookmarkCheck, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { claimOrder } from "@/lib/account/actions";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";

/**
 * "Save this order to my account", on the receipt.
 *
 * Shown only to a signed-in customer looking at an order that is not already
 * theirs. The order id in the URL is the proof — they can read this page, so
 * attaching it grants nothing they do not already have. It just means they stop
 * needing the link.
 */
export function ClaimOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations("receipt");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (claimed) {
    return (
      <p className="mt-8 flex items-center gap-2 rounded-lg border border-leaf-700/40 bg-leaf-50 px-5 py-4 text-[13px] leading-relaxed">
        <Check className="size-4 shrink-0" aria-hidden="true" />
        {t("claimed")}
      </p>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-border-subtle bg-surface px-5 py-4">
      <p className="text-[13px] leading-relaxed text-text-secondary">{t("claimLead")}</p>

      {error ? (
        <p role="alert" className="mt-3 text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <Button
        variant="outline"
        className="mt-4 gap-2"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await claimOrder(orderId);
            if (result.ok) {
              setClaimed(true);
              router.refresh();
            } else {
              setError(result.error);
            }
          });
        }}
      >
        <BookmarkCheck className="size-4" aria-hidden="true" />
        {pending ? t("claiming") : t("claim")}
      </Button>
    </div>
  );
}
