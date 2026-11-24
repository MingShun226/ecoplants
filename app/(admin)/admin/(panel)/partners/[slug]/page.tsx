import { ArrowLeft, ExternalLink, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminCard, AdminField, AdminPage } from "@/components/admin/admin-page";
import {
  ClosedControl,
  LocationForm,
  PartnerOffers,
  PartnerOrderingForm,
  PartnerProfileForm,
  PayoutAccountForm,
  PickupHoursForm,
} from "@/components/admin/partner-forms";
import { formatPhone } from "@/lib/account/phone";
import { PARTNER_STATUS_LABEL, PICKUP_DAYS } from "@/lib/admin/enums";
import { formatStamp } from "@/lib/admin/format";
import { mapsUrl } from "@/lib/admin/partner-format";
import { getPartner, getPayoutAccount, isClosedNow, listVariantOptions } from "@/lib/admin/partners";
import { getSessionAdmin, hasRole } from "@/lib/admin/session";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const partner = await getPartner(slug);
  return { title: partner?.displayName ?? "Nursery" };
}

/**
 * One nursery.
 *
 * The left column is what changes week to week — what it stocks and at what
 * price — and who it is. The right column is what decides whether it can be
 * given an order at all: status, closed-today, location and hours. Routing
 * (a later slice of ADR 0009) reads exactly those, so a nursery missing one of
 * them says so at the top of the screen rather than quietly never being picked.
 */
export default async function PartnerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, admin] = await Promise.all([getPartner(slug), getSessionAdmin()]);
  if (!partner) notFound();

  const house = partner.kind === "house";
  const isOwner = hasRole(admin, "owner");
  const [variants, account] = await Promise.all([
    house ? Promise.resolve([]) : listVariantOptions(),
    !house && isOwner ? getPayoutAccount(partner.id) : Promise.resolve(null),
  ]);

  const closedNow = isClosedNow(partner.closedUntil);
  const openDays = PICKUP_DAYS.filter((d) => partner.pickupHours[d]).length;

  // What still stops this nursery being given an order, in the order someone
  // would fix it.
  const gaps = [
    partner.status !== "active" ? `it is ${PARTNER_STATUS_LABEL[partner.status].toLowerCase()}, not Active` : null,
    partner.lat === null ? "it has no location" : null,
    // The address is what gets pasted into Lalamove; a pin alone is not enough
    // for a driver to find the gate.
    partner.address.trim() === "" ? "it has no pickup address" : null,
    // Orders reach a nursery on WhatsApp in the pilot (ADR 0009).
    !house && !partner.whatsapp ? "it has no WhatsApp number" : null,
    openDays === 0 ? "it has no pickup hours" : null,
    !house && partner.offers.length === 0 ? "it stocks no plants yet" : null,
  ].filter((g): g is string => g !== null);

  return (
    <AdminPage
      title={partner.displayName}
      lead={[house ? "EcoPlants' own stock" : partner.name, partner.areaLabel].filter(Boolean).join(" · ")}
      actions={
        partner.whatsapp ? (
          <a
            href={`https://wa.me/${partner.whatsapp.replace(/^\+/, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-default px-3.5 text-[13px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <MessageCircle className="size-3.5" aria-hidden="true" />
            WhatsApp {partner.contactName || "them"}
          </a>
        ) : null
      }
    >
      <Link
        href="/admin/partners"
        className="-mt-2 inline-flex w-fit items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        All nurseries
      </Link>

      {gaps.length > 0 ? (
        <div className="rounded-lg border border-border-default bg-surface-sunken px-5 py-4 text-sm leading-relaxed">
          <strong className="font-medium">Not ready for orders:</strong> {gaps.join(", ")}.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {house ? (
            <AdminCard
              title="What it stocks"
              lead="EcoPlants counts its own stock, so it lives in Inventory, with every movement on record."
            >
              <Link
                href="/admin/inventory"
                className="text-[13px] underline-offset-4 hover:underline"
              >
                Open Inventory
              </Link>
            </AdminCard>
          ) : (
            <AdminCard
              title="Plants it stocks"
              lead="What the nursery is paid for one, and whether it has them. The customer's price is set on the product."
              flush
            >
              <PartnerOffers partnerId={partner.id} offers={partner.offers} variants={variants} />
            </AdminCard>
          )}

          <AdminCard title="Details" lead="Who they are, where a driver collects from, and anything staff should know.">
            <PartnerProfileForm partner={partner} />
          </AdminCard>

          <AdminCard
            title="Pickup hours"
            lead={openDays === 0 ? "None set — no day is open." : `Open ${openDays} day${openDays === 1 ? "" : "s"} a week.`}
            collapsible
            defaultOpen={openDays === 0}
          >
            <PickupHoursForm partner={partner} />
          </AdminCard>
        </div>

        <div className="flex flex-col gap-6">
          <AdminCard title="At a glance">
            <dl className="flex flex-col gap-4">
              <AdminField label="Status">{PARTNER_STATUS_LABEL[partner.status]}</AdminField>
              <AdminField label="Today">
                {closedNow && partner.closedUntil ? (
                  <span className="text-warning">
                    Closed until <span className="numeric">{formatStamp(partner.closedUntil)}</span>
                  </span>
                ) : (
                  "Open"
                )}
              </AdminField>
              <AdminField label="Delivers">
                {partner.lat !== null && partner.lng !== null ? (
                  <a
                    href={mapsUrl(partner.lat, partner.lng)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                  >
                    <span className="numeric">Within {partner.radiusKm} km</span>
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="text-warning">No location yet</span>
                )}
              </AdminField>
              {!house ? (
                <AdminField label="Plants">
                  <span className="numeric">{partner.offers.length}</span>
                </AdminField>
              ) : null}
              <AdminField label="WhatsApp">
                {partner.whatsapp ? (
                  <span className="numeric">{formatPhone(partner.whatsapp)}</span>
                ) : (
                  <span className="text-text-tertiary">None</span>
                )}
              </AdminField>
              {!house ? (
                <AdminField label="Agreement">
                  {partner.agreementSignedOn ? (
                    <span className="numeric">{partner.agreementSignedOn}</span>
                  ) : (
                    <span className="text-text-tertiary">Not recorded</span>
                  )}
                </AdminField>
              ) : null}
            </dl>
          </AdminCard>

          <AdminCard title="Taking orders">
            <PartnerOrderingForm partner={partner} />
          </AdminCard>

          <AdminCard title="Closed today">
            <ClosedControl partner={partner} closedNow={closedNow} />
          </AdminCard>

          <AdminCard title="Location" lead="Where it is and how far it delivers." collapsible defaultOpen={partner.lat === null}>
            <LocationForm partner={partner} />
          </AdminCard>

          {!house && isOwner ? (
            <AdminCard title="Bank details" lead="Where payouts go. Owner only." collapsible>
              <PayoutAccountForm partnerId={partner.id} slug={partner.slug} account={account} />
            </AdminCard>
          ) : null}
        </div>
      </div>
    </AdminPage>
  );
}
