"use client";

import { ExternalLink, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { formatPhone } from "@/lib/account/phone";
import type { ActionResult } from "@/lib/admin/actions";
import {
  LOCALES,
  LOCALE_LABEL,
  OFFER_AVAILABILITIES,
  OFFER_AVAILABILITY_LABEL,
  PARTNER_STATUSES,
  PARTNER_STATUS_HINT,
  PARTNER_STATUS_LABEL,
  PICKUP_DAYS,
  PICKUP_DAY_LABEL,
  type LocaleCode,
  type OfferAvailability,
  type PartnerStatus,
  type PickupHours,
} from "@/lib/admin/enums";
import { formatSen, formatStamp } from "@/lib/admin/format";
import { adminHref } from "@/lib/admin/href";
import {
  createPartner,
  removeOffer,
  saveOffer,
  savePayoutAccount,
  setPartnerClosed,
  updatePartnerLocation,
  updatePartnerOrdering,
  updatePartnerProfile,
  updatePickupHours,
} from "@/lib/admin/partner-actions";
import {
  formatLocation,
  malaysiaToday,
  mapsUrl,
  marginOf,
  nextDate,
  parseLocation,
  sizeLabel,
} from "@/lib/admin/partner-format";
import type {
  NurseryOption,
  PartnerDetail,
  PartnerOfferRow,
  PayoutAccount,
  ProductOfferRow,
  VariantOption,
} from "@/lib/admin/partners";
import { cn } from "@/lib/utils";

/**
 * Forms for the nursery screens (ADR 0009).
 *
 * Money is typed in ringgit, because that is what a person thinks in, and
 * converted to sen at the boundary (ADR 0002). Every form refreshes the route
 * when it saves, so the server-rendered parts of the screen — the list, the
 * "at a glance" panel — catch up without a reload.
 */

// ------------------------------------------------------------- plumbing --

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // "Saved" is timed from when everything — the save and the refresh behind it
  // — has finished. Timed from the save alone, a slow refresh kept the button
  // on "Saving…" past the end of the timer and the confirmation never showed.
  useEffect(() => {
    if (!saved || pending) return;
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved, pending]);

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    setError(null);
    setSaved(false);
    start(async () => {
      const result = await action();
      if (result.ok) {
        setSaved(true);
        router.refresh();
        after?.();
      } else {
        setError(result.error);
      }
    });
  }

  return { pending, error, saved, run, setError };
}

/**
 * Form values that start from the server's copy and take it again whenever
 * that copy changes — after a save the database may have tidied what was typed
 * ("019-000 0043" comes back as +60190000043).
 *
 * Done in place rather than by keying the form to the row's updated_at: a key
 * remounts the form, which threw away the "Saved" the person was waiting for,
 * and since every card shares one updated_at, saving one card wiped unsaved
 * edits in the others. Here each form follows only its own fields.
 */
function useServerValues<T>(fromServer: T): [T, (next: T) => void] {
  const version = JSON.stringify(fromServer);
  const [held, setHeld] = useState({ version, value: fromServer });

  // React's pattern for state that follows a prop: adjust during render, which
  // re-renders before anything is painted.
  if (held.version !== version) {
    setHeld({ version, value: fromServer });
  }

  const value = held.version === version ? held.value : fromServer;
  return [value, (next: T) => setHeld({ version, value: next })];
}

function SaveRow({
  pending,
  saved,
  error,
  dirty,
  label = "Save",
}: {
  pending: boolean;
  saved: boolean;
  error: string | null;
  dirty: boolean;
  label?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="submit" size="sm" disabled={pending || !dirty}>
        {pending ? "Saving…" : saved ? "Saved" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const INPUT = "h-8 rounded-sm text-[13px]";
const TEXTAREA =
  "w-full resize-y rounded-sm border border-border-default bg-surface px-3 py-2 text-[13px] leading-relaxed outline-none transition-colors placeholder:text-text-tertiary focus:border-border-strong";

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-text-tertiary">{children}</p>;
}

const ringgit = (sen: number) => (sen / 100).toFixed(2);

/** Ringgit typed by a person, to sen. `null` when it is not a usable amount. */
function toSen(typed: string): number | null {
  const n = Number(typed);
  if (typed.trim() === "" || !Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function LocaleSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: LocaleCode;
  onChange: (v: LocaleCode) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as LocaleCode)}>
      <SelectTrigger id={id} className={INPUT}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {LOCALE_LABEL[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AvailabilitySelect({
  value,
  onChange,
  label,
}: {
  value: OfferAvailability;
  onChange: (v: OfferAvailability) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as OfferAvailability)}>
      <SelectTrigger aria-label={label} className={cn(INPUT, "w-full")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OFFER_AVAILABILITIES.map((a) => (
          <SelectItem key={a} value={a}>
            {OFFER_AVAILABILITY_LABEL[a]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Margin, live as the price is typed. A loss is shown as one. */
function Margin({ retailSen, netSen }: { retailSen: number; netSen: number | null }) {
  if (netSen === null) return <span className="text-text-tertiary">—</span>;
  const m = marginOf(retailSen, netSen);
  if (m.sen <= 0) {
    return (
      <span className="numeric text-danger" title="The nursery is paid as much as the customer pays, or more.">
        {m.sen === 0 ? "No margin" : `${formatSen(m.sen)} loss`}
      </span>
    );
  }
  return (
    <span className="numeric text-text-secondary">
      {formatSen(m.sen)}
      {m.pct !== null ? <span className="text-text-tertiary"> · {m.pct}%</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------- create --

export function NewPartnerForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState({
    displayName: "",
    name: "",
    areaLabel: "",
    contactName: "",
    whatsapp: "",
    preferredLocale: "ms" as LocaleCode,
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await createPartner(f);
          if (result.ok) router.push(`/admin/partners/${result.slug}`);
          else setError(result.error);
        });
      }}
      className="flex max-w-xl flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="displayName">Name customers will read</Label>
        <Input
          id="displayName"
          value={f.displayName}
          onChange={(e) => setF({ ...f, displayName: e.target.value })}
          placeholder="Kebun Ah Seng"
          required
          className={INPUT}
        />
        <Hint>Shown on the receipt as “Grown by …”. Keep it the name people know the nursery by.</Hint>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Registered business name</Label>
        <Input
          id="name"
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          placeholder="Same as above if left blank"
          className={INPUT}
        />
        <Hint>As on the SSM registration and the agreement. Used on payout statements.</Hint>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="areaLabel">Area</Label>
          <Input
            id="areaLabel"
            value={f.areaLabel}
            onChange={(e) => setF({ ...f, areaLabel: e.target.value })}
            placeholder="Sungai Buloh"
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactName">Person to talk to</Label>
          <Input
            id="contactName"
            value={f.contactName}
            onChange={(e) => setF({ ...f, contactName: e.target.value })}
            placeholder="Mr Tan"
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            value={f.whatsapp}
            onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
            placeholder="012-345 6789"
            className={cn(INPUT, "numeric")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="locale">Messages in</Label>
          <LocaleSelect
            id="locale"
            value={f.preferredLocale}
            onChange={(v) => setF({ ...f, preferredLocale: v })}
          />
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <Button type="submit" size="sm" disabled={pending || f.displayName.trim() === ""}>
          {pending ? "Adding…" : "Add nursery"}
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------- profile --

export function PartnerProfileForm({ partner }: { partner: PartnerDetail }) {
  const s = useSave();
  const initial = {
    displayName: partner.displayName,
    name: partner.name,
    areaLabel: partner.areaLabel,
    address: partner.address,
    contactName: partner.contactName,
    whatsapp: partner.whatsapp ? formatPhone(partner.whatsapp) : "",
    preferredLocale: partner.preferredLocale,
    agreementSignedOn: partner.agreementSignedOn ?? "",
    notes: partner.notes,
  };
  const [f, setF] = useServerValues(initial);
  const dirty = (Object.keys(initial) as (keyof typeof initial)[]).some((k) => f[k] !== initial[k]);
  const house = partner.kind === "house";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        s.run(() => updatePartnerProfile(partner.id, partner.slug, f));
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="displayName">Name customers read</Label>
          <Input
            id="displayName"
            value={f.displayName}
            onChange={(e) => setF({ ...f, displayName: e.target.value })}
            required
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Registered business name</Label>
          <Input
            id="name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="areaLabel">Area</Label>
          <Input
            id="areaLabel"
            value={f.areaLabel}
            onChange={(e) => setF({ ...f, areaLabel: e.target.value })}
            placeholder="Sungai Buloh"
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="contactName">Person to talk to</Label>
          <Input
            id="contactName"
            value={f.contactName}
            onChange={(e) => setF({ ...f, contactName: e.target.value })}
            className={INPUT}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            type="tel"
            inputMode="tel"
            value={f.whatsapp}
            onChange={(e) => setF({ ...f, whatsapp: e.target.value })}
            placeholder="012-345 6789"
            className={cn(INPUT, "numeric")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="locale">Messages in</Label>
          <LocaleSelect
            id="locale"
            value={f.preferredLocale}
            onChange={(v) => setF({ ...f, preferredLocale: v })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Pickup address</Label>
        <textarea
          id="address"
          value={f.address}
          onChange={(e) => setF({ ...f, address: e.target.value })}
          rows={2}
          placeholder="Lot 12, Jalan Kuala Selangor, 47000 Sungai Buloh, Selangor"
          className={TEXTAREA}
        />
        <Hint>Where a driver collects from. This is what gets pasted into Lalamove.</Hint>
      </div>

      {!house ? (
        <div className="flex flex-col gap-2 sm:w-56">
          <Label htmlFor="agreement">Agreement signed on</Label>
          <Input
            id="agreement"
            type="date"
            value={f.agreementSignedOn}
            onChange={(e) => setF({ ...f, agreementSignedOn: e.target.value })}
            className={cn(INPUT, "numeric")}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          rows={3}
          placeholder="Anything the next person to call them should know."
          className={TEXTAREA}
        />
        <Hint>Staff only. The nursery never sees these.</Hint>
      </div>

      <SaveRow pending={s.pending} saved={s.saved} error={s.error} dirty={dirty} />
    </form>
  );
}

// ---------------------------------------------------------------- orders --

export function PartnerOrderingForm({ partner }: { partner: PartnerDetail }) {
  const s = useSave();
  const [f, setF] = useServerValues<{ status: PartnerStatus; priority: string; selfDelivery: boolean }>({
    status: partner.status,
    priority: String(partner.priority),
    selfDelivery: partner.selfDelivery,
  });
  const { status, priority, selfDelivery } = f;
  const setStatus = (v: PartnerStatus) => setF({ ...f, status: v });
  const setPriority = (v: string) => setF({ ...f, priority: v });
  const setSelfDelivery = (v: boolean) => setF({ ...f, selfDelivery: v });
  const dirty =
    status !== partner.status || priority !== String(partner.priority) || selfDelivery !== partner.selfDelivery;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(priority);
        if (!Number.isInteger(n)) {
          s.setError("Priority is a whole number.");
          return;
        }
        s.run(() => updatePartnerOrdering(partner.id, partner.slug, { status, priority: n, selfDelivery }));
      }}
      className="flex flex-col gap-5"
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-medium">Status</legend>
        {PARTNER_STATUSES.map((value) => (
          <label
            key={value}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors",
              status === value ? "border-ink-950 bg-surface-sunken" : "border-border-subtle hover:border-border-default",
            )}
          >
            <input
              type="radio"
              name="status"
              value={value}
              checked={status === value}
              onChange={() => setStatus(value)}
              className="mt-0.5 size-4 shrink-0 accent-ink-950"
            />
            <span className="flex flex-col">
              <span className="text-[13px] font-medium">{PARTNER_STATUS_LABEL[value]}</span>
              <span className="text-[12px] text-text-tertiary">{PARTNER_STATUS_HINT[value]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-2 sm:w-40">
        <Label htmlFor="priority">Priority</Label>
        <Input
          id="priority"
          type="number"
          step="1"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className={cn(INPUT, "numeric")}
        />
      </div>
      <Hint>
        When two nurseries can fill the same order from the same distance, the higher number gets it. Leave at 0
        unless there is a reason.
      </Hint>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={selfDelivery}
          onChange={(e) => setSelfDelivery(e.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-ink-950"
        />
        <span className="flex flex-col">
          <span className="text-[13px]">Can deliver its own large plants</span>
          <span className="text-[12px] text-text-tertiary">
            Has a lorry or van. Only then is a customer&apos;s address ever shown to it, and only for an order it
            delivers.
          </span>
        </span>
      </label>

      <SaveRow pending={s.pending} saved={s.saved} error={s.error} dirty={dirty} />
    </form>
  );
}

// ---------------------------------------------------------- closed today --

export function ClosedControl({ partner, closedNow }: { partner: PartnerDetail; closedNow: boolean }) {
  const s = useSave();
  const [date, setDate] = useState("");
  const tomorrow = nextDate(malaysiaToday());

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed">
        {closedNow && partner.closedUntil ? (
          <>
            <strong className="font-medium text-warning">Closed</strong> until{" "}
            <span className="numeric">{formatStamp(partner.closedUntil)}</span>. Not given orders until then.
          </>
        ) : (
          <>
            <strong className="font-medium text-success">Open</strong> during its pickup hours.
          </>
        )}
      </p>

      <div className="flex flex-wrap gap-2">
        {closedNow ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={s.pending}
            onClick={() => s.run(() => setPartnerClosed(partner.id, partner.slug, { kind: "open" }))}
          >
            Open again now
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={s.pending}
            onClick={() => s.run(() => setPartnerClosed(partner.id, partner.slug, { kind: "today" }))}
          >
            Closed for the rest of today
          </Button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.run(() => setPartnerClosed(partner.id, partner.slug, { kind: "until", date }), () => setDate(""));
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="closedUntil">Closed until the morning of</Label>
          <Input
            id="closedUntil"
            type="date"
            min={tomorrow}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={cn(INPUT, "numeric w-44")}
          />
        </div>
        <Button type="submit" size="sm" variant="outline" disabled={s.pending || date === ""}>
          Set
        </Button>
      </form>

      {s.error ? (
        <p role="alert" className="text-[13px] leading-relaxed text-danger">
          {s.error}
        </p>
      ) : null}
      <Hint>For a holiday or a day off. Status stays as it is; this only pauses orders until the date.</Hint>
    </div>
  );
}

// -------------------------------------------------------------- location --

export function LocationForm({ partner }: { partner: PartnerDetail }) {
  const s = useSave();
  const initialLocation = formatLocation(partner.lat, partner.lng);
  const [f, setF] = useServerValues({ location: initialLocation, radius: String(partner.radiusKm) });
  const { location, radius } = f;
  const setLocation = (v: string) => setF({ ...f, location: v });
  const setRadius = (v: string) => setF({ ...f, radius: v });
  const parsed = parseLocation(location);
  const dirty = location !== initialLocation || radius !== String(partner.radiusKm);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = Number(radius);
        s.run(() => updatePartnerLocation(partner.id, partner.slug, { location, radiusKm: r }));
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="location">Location</Label>
        <Input
          id="location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="3.20457, 101.57951"
          className={cn(INPUT, "numeric")}
        />
        {!parsed.ok ? (
          <p className="text-[12px] text-danger">{parsed.error}</p>
        ) : parsed.lat !== null ? (
          <a
            href={mapsUrl(parsed.lat, parsed.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-[12px] text-text-secondary underline-offset-4 hover:underline"
          >
            Check it on Google Maps
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : (
          <Hint>
            In Google Maps, right-click the nursery&apos;s gate and click the numbers at the top of the menu. That
            copies them; paste here. A shared Maps link works too.
          </Hint>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:w-40">
        <Label htmlFor="radius">Delivers within (km)</Label>
        <Input
          id="radius"
          type="number"
          min="1"
          max="200"
          step="1"
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className={cn(INPUT, "numeric")}
        />
      </div>
      <Hint>Straight-line distance from the location above. Orders further away go to another nursery.</Hint>

      <SaveRow pending={s.pending} saved={s.saved} error={s.error} dirty={dirty && parsed.ok} />
    </form>
  );
}

// ---------------------------------------------------------- pickup hours --

type DayRow = { open: boolean; from: string; to: string };

export function PickupHoursForm({ partner }: { partner: PartnerDetail }) {
  const s = useSave();
  const initial = Object.fromEntries(
    PICKUP_DAYS.map((d) => {
      const h = partner.pickupHours[d];
      return [d, h ? { open: true, from: h.open, to: h.close } : { open: false, from: "09:00", to: "18:00" }];
    }),
  ) as Record<(typeof PICKUP_DAYS)[number], DayRow>;

  const [rows, setRows] = useServerValues(initial);
  const dirty = PICKUP_DAYS.some((d) => {
    const a = rows[d];
    const b = initial[d];
    return a.open !== b.open || (a.open && (a.from !== b.from || a.to !== b.to));
  });

  const set = (d: (typeof PICKUP_DAYS)[number], patch: Partial<DayRow>) =>
    setRows({ ...rows, [d]: { ...rows[d], ...patch } });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const hours: PickupHours = {};
        for (const d of PICKUP_DAYS) {
          hours[d] = rows[d].open ? { open: rows[d].from, close: rows[d].to } : null;
        }
        s.run(() => updatePickupHours(partner.id, partner.slug, hours));
      }}
      className="flex flex-col gap-4"
    >
      <ul className="flex flex-col divide-y divide-border-subtle">
        {PICKUP_DAYS.map((d) => (
          <li key={d} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
            <label className="flex w-36 cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={rows[d].open}
                onChange={(e) => set(d, { open: e.target.checked })}
                className="size-4 shrink-0 accent-ink-950"
              />
              <span className="text-[13px]">{PICKUP_DAY_LABEL[d]}</span>
            </label>
            {rows[d].open ? (
              <span className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${PICKUP_DAY_LABEL[d]} opens`}
                  value={rows[d].from}
                  onChange={(e) => set(d, { from: e.target.value })}
                  className={cn(INPUT, "numeric w-36")}
                />
                <span className="text-[12px] text-text-tertiary">to</span>
                <Input
                  type="time"
                  aria-label={`${PICKUP_DAY_LABEL[d]} closes`}
                  value={rows[d].to}
                  onChange={(e) => set(d, { to: e.target.value })}
                  className={cn(INPUT, "numeric w-36")}
                />
              </span>
            ) : (
              <span className="text-[12px] text-text-tertiary">Closed</span>
            )}
          </li>
        ))}
      </ul>
      <Hint>
        When a driver can collect. An order paid outside these hours waits for the next opening before the nursery
        has to confirm it.
      </Hint>
      <SaveRow pending={s.pending} saved={s.saved} error={s.error} dirty={dirty} />
    </form>
  );
}

// ---------------------------------------------------------------- offers --

/**
 * One offer: what the nursery is paid, and whether it has the plant.
 *
 * Shared by the nursery screen (one row per plant) and the product screen (one
 * row per nursery), which is why the left-hand label is passed in.
 */
function OfferRow({
  partnerId,
  variantId,
  retailSen,
  netPriceSen,
  availability,
  label,
}: {
  partnerId: string;
  variantId: string;
  retailSen: number;
  netPriceSen: number;
  availability: OfferAvailability;
  label: React.ReactNode;
}) {
  const s = useSave();
  const [f, setF] = useServerValues<{ net: string; avail: OfferAvailability }>({
    net: ringgit(netPriceSen),
    avail: availability,
  });
  const { net, avail } = f;
  const setNet = (v: string) => setF({ ...f, net: v });
  const setAvail = (v: OfferAvailability) => setF({ ...f, avail: v });
  const [confirmRemove, setConfirmRemove] = useState(false);
  const netSen = toSen(net);
  const dirty = net !== ringgit(netPriceSen) || avail !== availability;

  return (
    <li className="px-5 py-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (netSen === null) {
            s.setError("Enter what the nursery is paid, in ringgit.");
            return;
          }
          s.run(() => saveOffer(partnerId, variantId, { netPriceSen: netSen, availability: avail }));
        }}
        className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_8rem_8rem_auto]"
      >
        <div className="min-w-0">{label}</div>
        <span className="numeric text-[13px] text-text-secondary sm:text-right" title="What the customer pays">
          {formatSen(retailSen)}
        </span>
        <Input
          aria-label="Nursery is paid (RM)"
          type="number"
          min="0"
          step="0.01"
          value={net}
          onChange={(e) => setNet(e.target.value)}
          className={cn(INPUT, "numeric")}
        />
        <span className="text-[13px] sm:text-right">
          <Margin retailSen={retailSen} netSen={netSen} />
        </span>
        <AvailabilitySelect value={avail} onChange={setAvail} label="Availability" />
        <span className="flex items-center gap-1.5">
          <Button type="submit" size="sm" variant={dirty ? "default" : "outline"} disabled={s.pending || !dirty}>
            {s.pending ? "…" : s.saved ? "Saved" : "Save"}
          </Button>
          {confirmRemove ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-danger"
              disabled={s.pending}
              onClick={() => s.run(() => removeOffer(partnerId, variantId), () => setConfirmRemove(false))}
            >
              Remove
            </Button>
          ) : (
            <button
              type="button"
              aria-label="Remove this offer"
              onClick={() => setConfirmRemove(true)}
              className="flex size-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-sunken hover:text-danger"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </form>
      {s.error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-danger">
          {s.error}
        </p>
      ) : null}
    </li>
  );
}

function OfferHeader({ first }: { first: string }) {
  return (
    <div className="hidden border-b border-border-subtle px-5 py-2.5 text-[10.5px] uppercase tracking-[0.14em] text-text-tertiary sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_7rem_8rem_8rem_auto] sm:gap-x-4">
      <span>{first}</span>
      <span className="text-right">Customer pays</span>
      <span>Nursery paid</span>
      <span className="text-right">Margin</span>
      <span>Has it</span>
      <span className="w-[4.75rem]" />
    </div>
  );
}

/** "Add a plant": a variant not yet offered, its net price, and whether it is in. */
function AddOfferForm({
  options,
  onAdd,
  placeholder,
  emptyText,
}: {
  options: { value: string; label: string; retailSen: number }[];
  onAdd: (value: string, netPriceSen: number, availability: OfferAvailability) => Promise<ActionResult>;
  placeholder: string;
  emptyText: string;
}) {
  const s = useSave();
  const [value, setValue] = useState("");
  const [net, setNet] = useState("");
  const [avail, setAvail] = useState<OfferAvailability>("available");
  const chosen = options.find((o) => o.value === value);
  const netSen = toSen(net);

  if (options.length === 0) {
    return <p className="border-t border-border-subtle px-5 py-4 text-[13px] text-text-tertiary">{emptyText}</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!chosen || netSen === null) return;
        s.run(
          () => onAdd(chosen.value, netSen, avail),
          () => {
            setValue("");
            setNet("");
            setAvail("available");
          },
        );
      }}
      className="flex flex-col gap-2 border-t border-border-subtle bg-surface-sunken/40 px-5 py-4"
    >
      <div className="grid items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_8rem_8rem_auto]">
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger aria-label={placeholder} className={cn(INPUT, "w-full min-w-0")}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* On a phone the column headings are hidden, so an empty cell is just
            a stray dash; hide it until there is something to say, and say
            what it is. */}
        <span className={cn("numeric text-[13px] text-text-secondary sm:text-right", !chosen && "max-sm:hidden")}>
          {chosen ? (
            <>
              <span className="text-text-tertiary sm:hidden">Customer pays </span>
              {formatSen(chosen.retailSen)}
            </>
          ) : (
            "—"
          )}
        </span>
        <Input
          aria-label="Nursery is paid (RM)"
          type="number"
          min="0"
          step="0.01"
          placeholder="RM"
          value={net}
          onChange={(e) => setNet(e.target.value)}
          className={cn(INPUT, "numeric")}
        />
        <span className={cn("text-[13px] sm:text-right", !chosen && "max-sm:hidden")}>
          {chosen ? (
            <>
              <span className="text-text-tertiary sm:hidden">Margin </span>
              <Margin retailSen={chosen.retailSen} netSen={netSen} />
            </>
          ) : (
            <span className="text-text-tertiary">—</span>
          )}
        </span>
        <AvailabilitySelect value={avail} onChange={setAvail} label="Availability" />
        <Button type="submit" size="sm" disabled={s.pending || !chosen || netSen === null}>
          <Plus className="size-3.5" aria-hidden="true" />
          {s.pending ? "Adding…" : "Add"}
        </Button>
      </div>
      {s.error ? (
        <p role="alert" className="text-[12px] text-danger">
          {s.error}
        </p>
      ) : null}
    </form>
  );
}

/** The nursery screen's list: every plant it stocks. */
export function PartnerOffers({
  partnerId,
  offers,
  variants,
}: {
  partnerId: string;
  offers: PartnerOfferRow[];
  variants: VariantOption[];
}) {
  const offered = new Set(offers.map((o) => o.variantId));
  const options = variants
    .filter((v) => !offered.has(v.id))
    .map((v) => ({
      value: v.id,
      label: `${v.productName} — ${sizeLabel(v.sizeKey)}${v.productActive ? "" : " (hidden)"}`,
      retailSen: v.priceSen,
    }));

  return (
    <>
      {offers.length > 0 ? (
        <>
          <OfferHeader first="Plant" />
          <ul className="divide-y divide-border-subtle">
            {offers.map((o) => (
              <OfferRow
                key={o.variantId}
                partnerId={partnerId}
                variantId={o.variantId}
                retailSen={o.priceSen}
                netPriceSen={o.netPriceSen}
                availability={o.availability}
                label={
                  <>
                    <Link
                      href={adminHref(`/admin/products/${o.productRef}`)}
                      className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                    >
                      {o.productName}
                    </Link>
                    <span className="numeric block truncate text-[11px] text-text-tertiary">
                      {sizeLabel(o.sizeKey)} · {o.sku}
                      {o.productActive ? "" : " · hidden from the shop"}
                    </span>
                  </>
                }
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-text-tertiary">
          Nothing yet. Add each plant this nursery can supply, with what it is paid for one.
        </p>
      )}
      <AddOfferForm
        options={options}
        placeholder="Add a plant…"
        emptyText="This nursery already has every plant in the catalogue."
        onAdd={(variantId, netPriceSen, availability) =>
          saveOffer(partnerId, variantId, { netPriceSen, availability })
        }
      />
    </>
  );
}

/** The product screen's list: which nurseries stock each size. */
export function ProductNurseries({
  variants,
  offers,
  nurseries,
}: {
  variants: { id: string; sku: string; sizeKey: string; priceSen: number }[];
  offers: ProductOfferRow[];
  nurseries: NurseryOption[];
}) {
  return (
    <div className="flex flex-col">
      {variants.map((v, i) => {
        const here = offers.filter((o) => o.variantId === v.id);
        const taken = new Set(here.map((o) => o.partnerId));
        const options = nurseries
          .filter((n) => !taken.has(n.id))
          .map((n) => ({
            value: n.id,
            label: `${n.displayName}${n.areaLabel ? `, ${n.areaLabel}` : ""}${n.status === "active" ? "" : ` (${PARTNER_STATUS_LABEL[n.status].toLowerCase()})`}`,
            retailSen: v.priceSen,
          }));

        return (
          <section key={v.id} className={i > 0 ? "border-t-4 border-surface-sunken" : undefined}>
            <h3 className="flex items-baseline justify-between gap-3 px-5 pb-1 pt-4">
              <span className="text-[13px] font-medium">{sizeLabel(v.sizeKey)}</span>
              <span className="numeric text-[11px] text-text-tertiary">{v.sku}</span>
            </h3>
            {here.length > 0 ? (
              <>
                <OfferHeader first="Nursery" />
                <ul className="divide-y divide-border-subtle">
                  {here.map((o) => (
                    <OfferRow
                      key={o.partnerId}
                      partnerId={o.partnerId}
                      variantId={v.id}
                      retailSen={v.priceSen}
                      netPriceSen={o.netPriceSen}
                      availability={o.availability}
                      label={
                        <>
                          <Link
                            href={adminHref(`/admin/partners/${o.partnerSlug}`)}
                            className="block truncate text-[13px] font-medium underline-offset-4 hover:underline"
                          >
                            {o.partnerName}
                          </Link>
                          <span className="block truncate text-[11px] text-text-tertiary">
                            {o.partnerArea || "No area set"}
                            {o.partnerStatus === "active" ? "" : ` · ${PARTNER_STATUS_LABEL[o.partnerStatus]}`}
                          </span>
                        </>
                      }
                    />
                  ))}
                </ul>
              </>
            ) : (
              <p className="px-5 pb-3 text-[13px] text-text-tertiary">No nursery stocks this size yet.</p>
            )}
            <AddOfferForm
              options={options}
              placeholder="Add a nursery…"
              emptyText={
                nurseries.length === 0
                  ? "No nurseries yet. Add one under Nurseries first."
                  : "Every nursery already stocks this size."
              }
              onAdd={(partnerId, netPriceSen, availability) =>
                saveOffer(partnerId, v.id, { netPriceSen, availability })
              }
            />
          </section>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------- payout account --

export function PayoutAccountForm({
  partnerId,
  slug,
  account,
}: {
  partnerId: string;
  slug: string;
  account: PayoutAccount | null;
}) {
  const s = useSave();
  const initial = {
    bankName: account?.bankName ?? "",
    accountName: account?.accountName ?? "",
    accountNo: account?.accountNo ?? "",
  };
  const [f, setF] = useServerValues(initial);
  const dirty = f.bankName !== initial.bankName || f.accountName !== initial.accountName || f.accountNo !== initial.accountNo;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        s.run(() => savePayoutAccount(partnerId, slug, f));
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="bankName">Bank</Label>
        <Input
          id="bankName"
          value={f.bankName}
          onChange={(e) => setF({ ...f, bankName: e.target.value })}
          placeholder="Maybank"
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="accountName">Account name</Label>
        <Input
          id="accountName"
          value={f.accountName}
          onChange={(e) => setF({ ...f, accountName: e.target.value })}
          className={INPUT}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="accountNo">Account number</Label>
        <Input
          id="accountNo"
          inputMode="numeric"
          value={f.accountNo}
          onChange={(e) => setF({ ...f, accountNo: e.target.value })}
          className={cn(INPUT, "numeric")}
        />
      </div>
      {account ? (
        <Hint>
          Last changed <span className="numeric">{formatStamp(account.updatedAt)}</span>. Check a change with the
          nursery by phone before the next payout.
        </Hint>
      ) : (
        <Hint>Only the owner can see or change this.</Hint>
      )}
      <SaveRow pending={s.pending} saved={s.saved} error={s.error} dirty={dirty} />
    </form>
  );
}
