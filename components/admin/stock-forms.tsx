"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { adjustStock } from "@/lib/admin/catalogue-actions";
import { ADJUST_REASONS } from "@/lib/admin/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Stock adjustment.
 *
 * Direction and quantity are separate controls rather than one signed number.
 * "-3" typed into a box is one missed keystroke away from adding three plants
 * that do not exist, and nothing downstream would notice.
 *
 * A reason is mandatory because `adjust_stock()` refuses without one. Every
 * movement lands in the ledger with who made it.
 */
export function AdjustStockForm({
  variantId,
  sku,
  productName,
  onHand,
  reserved,
  compact = false,
}: {
  variantId: string;
  sku: string;
  productName: string;
  onHand: number;
  reserved: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!compact);
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState<string>(ADJUST_REASONS[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const amount = Number(qty);
  const delta = direction === "add" ? amount : -amount;
  const after = onHand + delta;
  const valid = Number.isInteger(amount) && amount > 0;
  // Mirrors the two refusals in adjust_stock(), so the button explains itself
  // rather than the database doing it after a round trip.
  const wouldGoNegative = valid && after < 0;
  const wouldBreakReservation = valid && after >= 0 && after < reserved;

  if (compact && !open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Adjust
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await adjustStock(variantId, delta, reason, note);
          if (result.ok) {
            setQty("1");
            setNote("");
            if (compact) setOpen(false);
            router.refresh();
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-3"
    >
      {compact ? (
        <p className="text-[12px] text-text-tertiary">
          {productName} · <span className="numeric">{sku}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px]">Direction</Label>
          <div className="flex gap-1">
            {(
              [
                { key: "add", label: "Add", Icon: Plus },
                { key: "remove", label: "Remove", Icon: Minus },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setDirection(key)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors",
                  direction === key
                    ? "border-ink-950 bg-ink-950 text-ink-50"
                    : "border-border-default text-text-secondary hover:border-border-strong",
                )}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`qty-${variantId}`} className="text-[11px]">
            How many
          </Label>
          <Input
            id={`qty-${variantId}`}
            type="number"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            className="numeric h-8 w-24 rounded-sm text-[13px]"
          />
        </div>

        <p className="pb-1.5 text-[12px] text-text-tertiary">
          <span className="numeric">{onHand}</span> →{" "}
          <span
            className={cn(
              "numeric font-medium",
              wouldGoNegative || wouldBreakReservation ? "text-danger" : "text-text-primary",
            )}
          >
            {valid ? after : onHand}
          </span>
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[11px]">Reason</Label>
        <div className="flex flex-wrap gap-1.5">
          {ADJUST_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] capitalize transition-colors",
                reason === r
                  ? "border-ink-950 bg-ink-950 text-ink-50"
                  : "border-border-default text-text-secondary hover:border-border-strong",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional) — invoice number, who counted, what happened"
        aria-label="Adjustment note"
        className="h-8 rounded-sm text-[13px]"
      />

      {wouldGoNegative ? (
        <p className="text-[12px] text-danger">That would take stock below zero.</p>
      ) : null}
      {wouldBreakReservation ? (
        <p className="text-[12px] text-danger">
          {reserved} {reserved === 1 ? "is" : "are"} already reserved by a checkout in
          flight. Going below that oversells someone who has their card out.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-[12px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={pending || !valid || wouldGoNegative || wouldBreakReservation}
        >
          {pending ? "Saving…" : "Record movement"}
        </Button>
        {compact ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
