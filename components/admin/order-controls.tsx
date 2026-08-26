"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addOrderNote, transitionOrder, updateFulfilment } from "@/lib/admin/actions";
import { STATUS_LABEL } from "@/components/admin/order-status-badge";
import type { OrderStatus } from "@/lib/admin/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * The buttons that move an order.
 *
 * Two rules the UI enforces on top of the database:
 *
 *  1. Destructive moves — cancel and refund — are visually separated and ask
 *     for a reason. An order cancelled without a note is an argument three
 *     weeks later that nobody can settle.
 *  2. Errors are shown verbatim from Postgres. "shipped -> cancelled is not a
 *     legal transition" tells an operator exactly what happened; "Something
 *     went wrong" tells them to file a ticket.
 */
const DESTRUCTIVE: OrderStatus[] = ["cancelled", "refunded"];

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  paid: "Mark paid",
  packing: "Start packing",
  shipped: "Mark shipped",
  delivered: "Mark delivered",
  cancelled: "Cancel order",
  refunded: "Mark refunded",
};

export function TransitionControls({
  orderId,
  status,
  next,
}: {
  orderId: string;
  status: OrderStatus;
  next: OrderStatus[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");

  const forward = next.filter((s) => !DESTRUCTIVE.includes(s));
  const destructive = next.filter((s) => DESTRUCTIVE.includes(s));

  const run = (to: OrderStatus, withNote?: string) => {
    setError(null);
    start(async () => {
      const result = await transitionOrder(orderId, to, withNote);
      if (result.ok) {
        setConfirming(null);
        setNote("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-text-secondary">
        Currently <span className="font-medium text-text-primary">{STATUS_LABEL[status]}</span>.
      </p>

      {forward.length > 0 ? (
        <div className="flex flex-col gap-2">
          {forward.map((to) => (
            <Button
              key={to}
              disabled={pending}
              onClick={() => run(to)}
              className="w-full justify-center"
            >
              {ACTION_LABEL[to] ?? STATUS_LABEL[to]}
            </Button>
          ))}
        </div>
      ) : null}

      {destructive.length > 0 ? (
        <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
          {destructive.map((to) => (
            <div key={to}>
              {confirming === to ? (
                <div className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger-soft p-3">
                  <Label htmlFor={`reason-${to}`} className="text-[12px]">
                    Why? This goes on the timeline.
                  </Label>
                  <Input
                    id={`reason-${to}`}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Customer changed their mind"
                    className="h-8 rounded-sm bg-surface text-[13px]"
                  />
                  {to === "cancelled" ? (
                    <p className="text-[11px] leading-relaxed text-text-secondary">
                      Cancelling returns every line to stock.
                    </p>
                  ) : null}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={pending || !note.trim()}
                      onClick={() => run(to, note)}
                      className="flex-1"
                    >
                      {pending ? "Working…" : `Confirm ${STATUS_LABEL[to].toLowerCase()}`}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        setConfirming(null);
                        setNote("");
                      }}
                    >
                      Keep
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirming(to)}
                  className={cn(
                    "w-full rounded-full border border-border-default px-4 py-2 text-[13px] text-text-secondary",
                    "transition-colors hover:border-danger hover:text-danger disabled:opacity-50",
                  )}
                >
                  {ACTION_LABEL[to] ?? STATUS_LABEL[to]}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Malaysian couriers, in the order this shop actually uses them. */
const COURIERS = ["J&T Express", "Flash Express", "Ninja Van", "Pos Laju", "Lalamove"];

export function FulfilmentForm({
  orderId,
  courier: initialCourier,
  trackingNo: initialTracking,
}: {
  orderId: string;
  courier: string;
  trackingNo: string;
}) {
  const router = useRouter();
  const [courier, setCourier] = useState(initialCourier);
  const [trackingNo, setTrackingNo] = useState(initialTracking);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = courier !== initialCourier || trackingNo !== initialTracking;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await updateFulfilment(orderId, courier, trackingNo);
          if (result.ok) {
            setSaved(true);
            router.refresh();
            window.setTimeout(() => setSaved(false), 2000);
          } else {
            setError(result.error);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="courier">Courier</Label>
        <div className="flex flex-wrap gap-1.5">
          {COURIERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCourier(courier === c ? "" : c)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[12px] transition-colors",
                courier === c
                  ? "border-ink-950 bg-ink-950 text-ink-50"
                  : "border-border-default text-text-secondary hover:border-border-strong",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <Input
          id="courier"
          value={courier}
          onChange={(e) => setCourier(e.target.value)}
          placeholder="Or type another"
          className="h-8 rounded-sm text-[13px]"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="tracking">Tracking number</Label>
        <Input
          id="tracking"
          value={trackingNo}
          onChange={(e) => setTrackingNo(e.target.value)}
          className="numeric h-8 rounded-sm text-[13px]"
        />
      </div>

      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="sm" disabled={pending || !dirty} className="w-full">
        {pending ? "Saving…" : saved ? "Saved" : "Save delivery details"}
      </Button>
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        start(async () => {
          const result = await addOrderNote(orderId, note);
          if (result.ok) {
            setNote("");
            router.refresh();
          }
        });
      }}
      className="flex gap-2"
    >
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note to this order"
        aria-label="Add a note"
        className="h-8 flex-1 rounded-sm text-[13px]"
      />
      <Button type="submit" size="sm" disabled={pending || !note.trim()}>
        {pending ? "Adding…" : "Add"}
      </Button>
    </form>
  );
}
