import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "@/lib/admin/orders";

/**
 * Status is the one place colour is allowed to carry meaning in the panel — the
 * rest of it is monochrome precisely so this reads at a glance.
 *
 * The scale is deliberate: grey = nothing owed of us, amber = we owe the
 * customer an action, green = done, red = money left the business.
 */
const STATUS_TONE: Record<OrderStatus, string> = {
  pending: "border-border-default bg-surface-sunken text-text-secondary",
  paid: "border-warning/40 bg-warning-soft text-ink-900",
  packing: "border-warning/40 bg-warning-soft text-ink-900",
  shipped: "border-info/40 bg-info-soft text-ink-900",
  delivered: "border-success/40 bg-success-soft text-ink-900",
  cancelled: "border-border-default bg-surface-sunken text-text-tertiary line-through",
  refunded: "border-danger/40 bg-danger-soft text-ink-900",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  packing: "Packing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        STATUS_TONE[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  authorised: "Authorised",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] whitespace-nowrap",
        status === "paid"
          ? "border-success/40 bg-success-soft text-ink-900"
          : status === "failed" || status === "refunded"
            ? "border-danger/40 bg-danger-soft text-ink-900"
            : "border-border-default bg-surface-sunken text-text-secondary",
      )}
    >
      {PAYMENT_LABEL[status]}
    </span>
  );
}
