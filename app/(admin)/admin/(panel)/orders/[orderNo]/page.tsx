import { ArrowLeft, MapPin, Phone, Mail, Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminField, AdminPage } from "@/components/admin/admin-page";
import { OrderStatusBadge, PaymentBadge, STATUS_LABEL } from "@/components/admin/order-status-badge";
import { FulfilmentForm, NoteForm, TransitionControls } from "@/components/admin/order-controls";
import { formatSen, formatStamp, formatWhen } from "@/lib/admin/format";
import { getOrder, NEXT_STATUSES } from "@/lib/admin/orders";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}): Promise<Metadata> {
  const { orderNo } = await params;
  return { title: orderNo };
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const order = await getOrder(orderNo);
  if (!order) notFound();

  const address = order.shippingAddress;
  const next = NEXT_STATUSES[order.status];

  return (
    <AdminPage
      title={order.orderNo}
      lead={`Placed ${formatStamp(order.placedAt)} · ${order.fullName}`}
      actions={<OrderStatusBadge status={order.status} />}
    >
      <Link
        href="/admin/orders"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All orders
      </Link>

      {/* East Malaysia on an order containing a Peninsular-only plant is the
          single most expensive mistake this shop can make, so it is stated at
          the top of the order rather than buried in the address panel. */}
      {order.isEastMalaysia ? (
        <div className="rounded-lg border border-warning/40 bg-warning-soft px-5 py-4 text-sm leading-relaxed">
          <strong className="font-medium">East Malaysia delivery.</strong> Transit
          to Sabah and Sarawak takes 7–8 working days. Check every line is a plant
          that survives it before packing.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <AdminCard title="What was ordered" flush>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                    <th className="px-5 py-3 font-medium">Item</th>
                    <th className="px-5 py-3 font-medium">SKU</th>
                    <th className="px-5 py-3 text-right font-medium">Qty</th>
                    <th className="px-5 py-3 text-right font-medium">Unit</th>
                    <th className="px-5 py-3 text-right font-medium">Line</th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border-subtle last:border-b-0">
                      <td className="px-5 py-3">
                        <span className="block text-[13px]">{line.productName}</span>
                        <span className="block text-[11px] capitalize text-text-tertiary">
                          {line.variantLabel}
                        </span>
                      </td>
                      <td className="numeric px-5 py-3 text-[12px] text-text-tertiary">
                        {line.sku}
                      </td>
                      <td className="numeric px-5 py-3 text-right text-[13px]">{line.quantity}</td>
                      <td className="numeric px-5 py-3 text-right text-[13px]">
                        {formatSen(line.unitPriceSen)}
                      </td>
                      <td className="numeric px-5 py-3 text-right text-[13px] font-medium">
                        {formatSen(line.unitPriceSen * line.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Prices are the snapshot taken when the order was placed, not a
                live join. If a plant's price changed yesterday, this invoice
                must not. */}
            <dl className="space-y-2 border-t border-border-subtle px-5 py-4 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Subtotal</dt>
                <dd className="numeric">{formatSen(order.subtotalSen)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Delivery</dt>
                <dd className="numeric">
                  {order.shippingFeeSen === 0 ? "Free" : formatSen(order.shippingFeeSen)}
                </dd>
              </div>
              {order.discountSen > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Discount</dt>
                  <dd className="numeric">−{formatSen(order.discountSen)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border-subtle pt-2 font-medium">
                <dt>Total</dt>
                <dd className="numeric">{formatSen(order.totalSen)}</dd>
              </div>
            </dl>
          </AdminCard>

          <AdminCard
            title="Timeline"
            lead="Every status change and note, and who made it."
            flush
          >
            <ol className="divide-y divide-border-subtle">
              {order.events.map((event) => (
                <li key={event.id} className="flex gap-4 px-5 py-3.5">
                  <span className="numeric w-24 shrink-0 pt-0.5 text-[11px] text-text-tertiary">
                    {formatWhen(event.createdAt)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px]">
                      {event.kind === "status" && event.toStatus ? (
                        <>
                          {event.fromStatus ? (
                            <span className="text-text-tertiary">
                              {STATUS_LABEL[event.fromStatus]} →{" "}
                            </span>
                          ) : null}
                          <span className="font-medium">{STATUS_LABEL[event.toStatus]}</span>
                        </>
                      ) : event.kind === "fulfilment" ? (
                        <span className="font-medium">Fulfilment updated</span>
                      ) : (
                        <span className="font-medium">Note</span>
                      )}
                    </p>
                    {event.note ? (
                      <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
                        {event.note}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-text-tertiary">{event.actorName}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-border-subtle px-5 py-4">
              <NoteForm orderId={order.id} />
            </div>
          </AdminCard>
        </div>

        <div className="flex flex-col gap-6">
          <AdminCard title="Move this order">
            {next.length === 0 ? (
              <p className="text-sm leading-relaxed text-text-tertiary">
                This order is closed. Nothing further can be done to it from
                here.
              </p>
            ) : (
              <TransitionControls
                orderId={order.id}
                status={order.status}
                next={next}
              />
            )}
          </AdminCard>

          <AdminCard title="Delivery">
            <FulfilmentForm
              orderId={order.id}
              courier={order.courier ?? ""}
              trackingNo={order.trackingNo ?? ""}
            />
          </AdminCard>

          <AdminCard title="Customer">
            <dl className="flex flex-col gap-4">
              <AdminField label="Name">{order.fullName}</AdminField>
              <AdminField label="Email">
                <a
                  href={`mailto:${order.email}`}
                  className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  <Mail className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  {order.email}
                </a>
              </AdminField>
              <AdminField label="Phone">
                {/* Straight to WhatsApp: it is how this shop talks to customers,
                    and the number is already E.164. */}
                <a
                  href={`https://wa.me/${order.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="numeric inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  <Phone className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  {order.phone}
                </a>
              </AdminField>
              <AdminField label="Deliver to">
                <span className="flex gap-1.5">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  <span className="leading-relaxed">
                    {address.line1}
                    {address.line2 ? <><br />{address.line2}</> : null}
                    <br />
                    {address.postcode} {address.city}
                    <br />
                    {address.state}
                  </span>
                </span>
              </AdminField>
            </dl>
          </AdminCard>

          <AdminCard title="Payment">
            <dl className="flex flex-col gap-4">
              <AdminField label="State">
                <PaymentBadge status={order.paymentStatus} />
              </AdminField>
              <AdminField label="Method">
                <span className="uppercase">{order.paymentMethod ?? "—"}</span>
              </AdminField>
              <AdminField label="Paid at">
                {order.paidAt ? formatStamp(order.paidAt) : "—"}
              </AdminField>
              {order.shippedAt ? (
                <AdminField label="Shipped at">{formatStamp(order.shippedAt)}</AdminField>
              ) : null}
              {order.deliveredAt ? (
                <AdminField label="Delivered at">{formatStamp(order.deliveredAt)}</AdminField>
              ) : null}
            </dl>
            <p className="mt-5 flex gap-2 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-tertiary">
              <Truck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              No payment gateway is connected yet, so payment state is set by
              hand here. It becomes webhook-driven when one is.
            </p>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
