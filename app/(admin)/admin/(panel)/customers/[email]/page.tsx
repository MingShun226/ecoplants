import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminField, AdminPage } from "@/components/admin/admin-page";
import { OrderStatusBadge, PaymentBadge } from "@/components/admin/order-status-badge";
import { getCustomer } from "@/lib/admin/people";
import { formatSen, formatStamp, formatWhen } from "@/lib/admin/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ email: string }>;
}): Promise<Metadata> {
  const { email } = await params;
  return { title: decodeURIComponent(email) };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const customer = await getCustomer(decodeURIComponent(email));
  if (!customer) notFound();

  const address = customer.lastAddress;

  return (
    <AdminPage
      title={customer.fullName}
      lead={`${customer.orderCount} ${customer.orderCount === 1 ? "order" : "orders"} · ${formatSen(customer.spentSen)} lifetime`}
    >
      <Link
        href="/admin/customers"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All customers
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <AdminCard title="Orders" flush>
          <ul className="divide-y divide-border-subtle">
            {customer.orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.orderNo}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-surface-sunken"
                >
                  <span className="numeric w-28 shrink-0 text-[13px] font-medium">{o.orderNo}</span>
                  <OrderStatusBadge status={o.status} />
                  <PaymentBadge status={o.paymentStatus} />
                  <span className="numeric ml-auto text-[12px] text-text-tertiary">
                    {o.itemCount} {o.itemCount === 1 ? "plant" : "plants"}
                  </span>
                  <span className="numeric w-20 text-right text-[13px] font-medium">
                    {formatSen(o.totalSen)}
                  </span>
                  <span className="numeric w-16 text-right text-[11px] text-text-tertiary">
                    {formatWhen(o.placedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>

        <div className="flex flex-col gap-6">
          <AdminCard title="Contact">
            <dl className="flex flex-col gap-4">
              <AdminField label="Email">
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex items-center gap-1.5 break-all underline-offset-4 hover:underline"
                >
                  <Mail className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  {customer.email}
                </a>
              </AdminField>
              <AdminField label="Phone">
                <a
                  href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="numeric inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                >
                  <Phone className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
                  {customer.phone}
                </a>
              </AdminField>
              {address ? (
                <AdminField label="Last delivered to">
                  <span className="flex gap-1.5">
                    <MapPin
                      className="mt-0.5 size-3.5 shrink-0 text-text-tertiary"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">
                      {address.line1}
                      {address.line2 ? (
                        <>
                          <br />
                          {address.line2}
                        </>
                      ) : null}
                      <br />
                      {address.postcode} {address.city}
                      <br />
                      {address.state}
                    </span>
                  </span>
                </AdminField>
              ) : null}
            </dl>
          </AdminCard>

          <AdminCard title="History">
            <dl className="flex flex-col gap-4">
              <AdminField label="First order">{formatStamp(customer.firstOrderAt)}</AdminField>
              <AdminField label="Last order">{formatStamp(customer.lastOrderAt)}</AdminField>
              <AdminField label="Lifetime value">
                <span className="numeric">{formatSen(customer.spentSen)}</span>
              </AdminField>
              {customer.isEastMalaysia ? (
                <AdminField label="Region">
                  <span className="text-warning">East Malaysia — 7–8 day transit</span>
                </AdminField>
              ) : null}
            </dl>
            <p className="mt-5 border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-tertiary">
              Lifetime value counts paid, packing, shipped and delivered orders. Cancelled
              and refunded ones are not revenue.
            </p>
          </AdminCard>
        </div>
      </div>
    </AdminPage>
  );
}
