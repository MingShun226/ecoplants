"use client";

import {
  ArrowLeft,
  Check,
  CreditCard,
  Landmark,
  QrCode,
  ShieldCheck,
  Truck,
  Wallet,
} from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import { PlantImage } from "@/components/brand/plant-image";
import { DisplayHeading } from "@/components/brand/display-heading";
import { refreshCart, useCart } from "@/components/features/cart-provider";
import { PhoneField } from "@/components/features/phone-field";
import { formatPhoneInput } from "@/lib/account/phone";
import { AddressField } from "@/components/features/address-field";
import { claimOrder, signUp } from "@/lib/account/actions";
import { placeOrder } from "@/lib/checkout/actions";
import { PENINSULAR_STATES } from "@/lib/checkout/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useShopSettings } from "@/components/features/settings-provider";
import { toMajor } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/**
 * Checkout — the one full page in the basket flow. The drawer handles review
 * and quantity; this page exists because entering an address and choosing a
 * payment method needs room and undivided attention.
 *
 * Submitting calls `placeOrder`, which re-reads the cart from the cookie
 * **server-side** and sends nothing but variant ids and quantities. Postgres
 * recomputes every price, the delivery fee and the coverage rule. The totals
 * rendered below are display only and are never what gets charged.
 */

type PaymentMethod = "fpx" | "duitnow" | "ewallet" | "card";

const PAYMENT_METHODS: { value: PaymentMethod; Icon: typeof Landmark; descKey: string }[] = [
  { value: "fpx", Icon: Landmark, descKey: "fpxDesc" },
  { value: "duitnow", Icon: QrCode, descKey: "duitnowDesc" },
  { value: "ewallet", Icon: Wallet, descKey: "ewalletDesc" },
  { value: "card", Icon: CreditCard, descKey: "cardDesc" },
];

export function CheckoutClient({
  defaults,
}: {
  /** From the signed-in customer, or blank for a guest. */
  defaults?: { fullName: string; phone: string };
}) {
  const settings = useShopSettings();
  const t = useTranslations("checkout");
  const tc = useTranslations("cart");
  const ta = useTranslations("actions");
  const ts = useTranslations("shipping");
  const tg = useTranslations("guarantee");
  const tSize = useTranslations("sizes");
  const format = useFormatter();
  const locale = useLocale() as Locale;
  const { lines, subtotalSen } = useCart();

  const router = useRouter();

  // Controlled, because the address lookup writes into them. They stay fully
  // editable — Google's Malaysian coverage is good in the Klang Valley and
  // patchy off it, and a shopper must always be able to correct or ignore it.
  const [state, setState] = useState<string>("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  // Run the prefill through the same formatter, so a returning customer sees
  // their number already grouped rather than as raw digits.
  const [phone, setPhone] = useState(() => formatPhoneInput(defaults?.phone ?? ""));
  const [payment, setPayment] = useState<PaymentMethod>("fpx");

  /*
   * Whether to keep the details as an account.
   *
   * Offered, not assumed. Signing in here is a phone number and a password, so
   * an account made silently from the checkout form would be one the customer
   * has no password for — reachable only through a reset they were never told
   * to expect. Asking costs one tick and one field, and everything else on the
   * form is already what the account would be made of.
   *
   * Only shown to a guest. A signed-in customer already has one.
   */
  const [wantsAccount, setWantsAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  /** No prefill means nobody is signed in — the page only passes it for a customer. */
  const isGuest = !defaults;

  const money = (sen: number) => format.number(toMajor(sen), "currency");

  const shippingSen =
    subtotalSen >= settings.freeShippingThresholdSen ? 0 : settings.standardShippingSen;
  const totalSen = subtotalSen + shippingSen;

  if (lines.length === 0) {
    return (
      <div className="container-narrow section-y text-center">
        <DisplayHeading as="h1" lead={tc("emptyTitle")} size="sm" />
        <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-text-secondary">
          {tc("emptyBody")}
        </p>
        <Button asChild size="lg" className="mt-10 px-7">
          <Link href="/plants">{ta("shopPlants")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        const field = (name: string) => String(data.get(name) ?? "").trim();

        start(async () => {
          // Only ids and quantities cross this line, and they come from the
          // cookie server-side — not from anything rendered on this page. The
          // totals above are display; the database recomputes all of them.
          const result = await placeOrder({
            fullName: field("name"),
            email: field("email"),
            phone,
            line1: field("address1"),
            line2: field("address2"),
            city: field("city"),
            postcode: field("postcode"),
            state,
          });

          if (!result.ok) {
            setError(result.error);
            return;
          }

          /*
           * The order first, the account second, and never the other way round.
           *
           * The order is the thing the customer came for and the thing that
           * holds their plants. If making the account fails — the number is
           * already registered, the password is too short, Supabase is having a
           * moment — the order still stands and they carry on to payment with a
           * note. An account is a convenience; losing an order to it would not
           * be a trade worth making.
           */
          if (isGuest && wantsAccount) {
            const created = await signUp(phone, password, field("name"));
            if (created.ok) {
              // Signed in as of this call, so the order can be moved onto the
              // new account and show up in their order history.
              await claimOrder(result.orderId);
            } else {
              // A toast rather than a message on this page: the next line
              // navigates to payment, and anything rendered here goes with it.
              // The order succeeded, so this is a note, not an error.
              toast.warning(t("accountNotCreated", { reason: created.error }), {
                duration: 9000,
              });
            }
          }

          // The server already dropped the cart cookie; this tells the store to
          // look again, so the header badge empties before the page changes.
          refreshCart();
          router.push(`/pay/${result.orderId}?method=${payment}`);
        });
      }}
      className="container-page section-y pt-8 md:pt-12"
    >
      <Link
        href="/plants"
        className="inline-flex items-center gap-2 text-[13px] text-text-tertiary transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        {t("keepShopping")}
      </Link>

      <DisplayHeading as="h1" lead={t("title")} size="sm" className="mt-5" />

      <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_23rem] lg:gap-20">
        <div className="space-y-14">
          <Section step={1} title={t("contactHeading")} lead={t("contactLead")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="name"
                label={t("fullName")}
                autoComplete="name"
                defaultValue={defaults?.fullName}
                required
              />
              <PhoneField
                id="checkout-phone"
                value={phone}
                onChange={setPhone}
                label={t("phone")}
                hint={t("phoneHint")}
              />
              <div className="sm:col-span-2">
                <Field
                  id="email"
                  label={t("email")}
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Guests only — a signed-in customer has one already. */}
            {isGuest ? (
              <div className="mt-6 rounded-lg border border-border-subtle bg-surface-sunken px-5 py-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={wantsAccount}
                    onChange={(e) => setWantsAccount(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-clay-600"
                  />
                  <span>
                    <span className="block text-sm">{t("createAccount")}</span>
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-text-secondary">
                      {t("createAccountLead")}
                    </span>
                  </span>
                </label>

                {wantsAccount ? (
                  <div className="mt-4 max-w-sm">
                    <Field
                      id="account-password"
                      label={t("choosePassword")}
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <p className="mt-2 text-[11px] leading-relaxed text-text-tertiary">
                      {t("passwordHint")}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section step={2} title={t("deliveryHeading")} lead={t("deliveryLead")}>
            <div className="grid gap-5 sm:grid-cols-2">
              {/* The street, with Google's suggestions under it. Choosing one
                  fills the town, postcode and state below — which is most of
                  this form, and the part a shopper on a phone gets wrong. */}
              <div className="sm:col-span-2">
                <AddressField
                  id="address1"
                  label={t("address1")}
                  hint={t("address1Hint")}
                  onResolved={(found) => {
                    setCity(found.city);
                    setPostcode(found.postcode);
                    // Null where Google returned Sabah, Sarawak or a name we do
                    // not know. Leaving the picker alone is right: it has no
                    // option for those, and the shopper needs to see that.
                    if (found.state) setState(found.state);
                  }}
                />
              </div>
              <div className="sm:col-span-2">
                <Field id="address2" label={t("address2")} autoComplete="address-line2" />
              </div>
              <Field
                id="city"
                label={t("city")}
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
              <Field
                id="postcode"
                label={t("postcode")}
                inputMode="numeric"
                pattern="[0-9]{5}"
                maxLength={5}
                autoComplete="postal-code"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                required
              />

              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="state">{t("state")}</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger id="state" className="w-full rounded-sm">
                    <SelectValue placeholder={t("statePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {PENINSULAR_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Coverage is stated plainly rather than enforced after the fact:
                the state list only contains places we actually deliver to. */}
            <p className="mt-6 text-sm leading-relaxed text-text-secondary">
              {ts("peninsular")}
            </p>
          </Section>

          <Section step={3} title={t("paymentHeading")} lead={t("paymentLead")}>
            <div className="grid gap-px overflow-hidden rounded-xl border border-border-subtle bg-border-subtle sm:grid-cols-2">
              {PAYMENT_METHODS.map(({ value, Icon, descKey }) => {
                const selected = payment === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPayment(value)}
                    aria-pressed={selected}
                    className={cn(
                      "flex items-start gap-3.5 p-5 text-left transition-colors",
                      selected ? "bg-leaf-50" : "bg-surface hover:bg-surface-sunken",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
                        selected ? "border-ink-950 bg-ink-950 text-ink-50" : "border-border-strong",
                      )}
                    >
                      {selected ? <Check className="size-2.5" strokeWidth={4} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="size-4 text-clay-600" aria-hidden="true" />
                        {t(value)}
                      </span>
                      <span className="mt-1 block text-[13px] leading-relaxed text-text-secondary">
                        {t(descKey)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 text-xs leading-relaxed text-text-tertiary">
              {t("gatewayNotice")}
            </p>
          </Section>
        </div>

        {/* --- order summary -------------------------------------------- */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-xl border border-border-subtle bg-surface">
            <h2 className="border-b border-border-subtle px-6 py-4 font-display text-lg">
              {tc("summary")}
            </h2>

            <ul className="max-h-72 overflow-y-auto">
              {lines.map((line) => {
                const tr = line.product.t[locale];
                return (
                  <li
                    key={line.variant.id}
                    className="flex items-center gap-4 border-b border-border-subtle px-6 py-4"
                  >
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                      <PlantImage product={line.product} sizes="56px" />
                      <span className="numeric absolute -right-1 -top-1 flex size-4.5 items-center justify-center rounded-full bg-ink-950 text-[10px] text-ink-50">
                        {line.qty}
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[14px]">{tr.name}</span>
                      <span className="text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary">
                        {tSize(line.variant.sizeKey)}
                      </span>
                    </span>
                    <span className="numeric shrink-0 text-sm">
                      {money(line.variant.priceSen * line.qty)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <dl className="space-y-3.5 px-6 py-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">{tc("subtotal")}</dt>
                <dd className="numeric">{money(subtotalSen)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">{tc("delivery")}</dt>
                <dd className="numeric">
                  {shippingSen === 0 ? tc("free") : money(shippingSen)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between border-t border-border-subtle pt-4">
                <dt className="font-medium">{tc("total")}</dt>
                <dd className="numeric font-display text-xl">{money(totalSen)}</dd>
              </div>
            </dl>

            <div className="px-6 pb-6">
              {error ? (
                <p
                  role="alert"
                  className="mb-4 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-[13px] leading-relaxed"
                >
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={pending}
              >
                {pending ? t("placingOrder") : t("placeOrder")}
              </Button>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-text-tertiary">
                {t("submitNotice")}
              </p>
            </div>

            <ul className="space-y-3 border-t border-border-subtle px-6 py-5 text-xs">
              <li className="flex gap-2.5 text-text-secondary">
                <ShieldCheck className="mt-px size-4 shrink-0 text-clay-600" aria-hidden="true" />
                {tg("headline", { days: settings.guaranteeDays })}
              </li>
              <li className="flex gap-2.5 text-text-secondary">
                <Truck className="mt-px size-4 shrink-0 text-clay-600" aria-hidden="true" />
                {ts("freeOver", {
                  amount: format.number(
                    toMajor(settings.freeShippingThresholdSen),
                    "currencyWhole",
                  ),
                })}
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </form>
  );
}

function Section({
  step,
  title,
  lead,
  children,
}: {
  step: number;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-4 border-b border-border-subtle pb-4">
        <span className="numeric font-display text-2xl leading-none text-clay-500">{step}</span>
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          {lead ? <p className="mt-1 text-sm text-text-secondary">{lead}</p> : null}
        </div>
      </div>
      <div className="mt-7">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.ComponentProps<"input">) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} className="rounded-sm" {...props} />
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}
