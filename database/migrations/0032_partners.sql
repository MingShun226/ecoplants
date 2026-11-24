-- 0032_partners.sql
--
-- Partner nurseries — the first slice of ADR 0009.
--
-- EcoPlants stays the seller. A nursery is a supplier that EcoPlants pays a net
-- price agreed per plant, and routing (a later migration) decides which nursery
-- fulfils an order. This migration only adds the nurseries themselves, what
-- each one stocks, and where its money goes. Nothing that places or moves an
-- order reads any of it yet, so the live checkout is unaffected.
--
-- Three tables:
--
--   partners                 — every fulfiller, including EcoPlants itself
--   partner_offers           — which variants a nursery stocks, at what net price
--   partner_payout_accounts  — where a nursery is paid; the owner role only
--
-- EcoPlants' own stock is a partner of kind 'house'. It has **no offers**: what
-- the house stocks is already recorded, counted and audited in `inventory`, and
-- a second list of the same facts would only be a second thing to keep in step.
-- Offers are for nurseries, which report availability rather than counts.

-- ------------------------------------------------------------------ types --

create type partner_kind as enum ('house', 'nursery');

create type partner_status as enum (
  'onboarding', -- signed or being signed, not yet taking orders
  'active',
  'paused',     -- temporarily not taking orders (staff decision, not "closed today")
  'ended'       -- no longer a partner; kept because orders will point at it
);

create type offer_availability as enum ('available', 'limited', 'out');

-- ------------------------------------------------------------ role helper --
-- Bank details are for the owner, not for every member of staff. Policies need
-- a rank check, and is_admin() only answers yes or no.

create or replace function is_admin_at_least(p_min admin_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from admin_users
     where auth_user_id = (select auth.uid())
       and is_active
       and (case role    when 'owner' then 3 when 'manager' then 2 else 1 end)
        >= (case p_min   when 'owner' then 3 when 'manager' then 2 else 1 end)
  );
$$;

comment on function is_admin_at_least is
  'True when the current session belongs to an active admin of at least the '
  'given role. SECURITY DEFINER for the same reason as is_admin().';

-- Same grants as is_admin() after 0012: policies are evaluated as the querying
-- role, so authenticated must be able to call it; anon must never meet it.
revoke execute on function is_admin_at_least(admin_role) from public, anon;
grant execute on function is_admin_at_least(admin_role) to authenticated;

-- ----------------------------------------------------------- pickup hours --
-- When a driver can collect. One key per day, each either null (closed) or
-- {"open": "HH:MM", "close": "HH:MM"} with open before close. Routing will use
-- it to work out when a nursery has to confirm an order by, so a malformed
-- value has to be refused here rather than discovered then.

create or replace function valid_pickup_hours(p jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_object_keys(p) as k(day)
        where k.day not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')
     )
     and not exists (
       select 1 from jsonb_each(p) as e(day, hours)
        where not (
          jsonb_typeof(e.hours) = 'null'
          or (
                jsonb_typeof(e.hours) = 'object'
            and coalesce(e.hours->>'open', '')  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            and coalesce(e.hours->>'close', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
            and (e.hours->>'open') < (e.hours->>'close')
          )
        )
     );
$$;

-- Not revoked: a CHECK constraint runs its function as the role doing the
-- write, so the panel's own session has to be able to execute it. It reads its
-- argument and nothing else.

-- --------------------------------------------------------------- partners --

create table partners (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique
                        check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind                partner_kind not null default 'nursery',

  -- The business, as it appears on the agreement and the payout statement.
  name                text not null check (btrim(name) <> ''),
  -- What the customer reads on their receipt: "Grown by Kebun Ah Seng".
  display_name        text not null check (btrim(display_name) <> ''),
  -- The town a customer would recognise: "Sungai Buloh".
  area_label          text not null default '',
  -- Where a driver collects from. Staff paste it into Lalamove.
  address             text not null default '',

  -- Where the nursery is, for distance. Both or neither. Bounded to Malaysia,
  -- which also catches the commonest mistake — latitude and longitude pasted
  -- the wrong way round, which would otherwise put a nursery in the sea.
  lat                 double precision check (lat between 0.5 and 7.6),
  lng                 double precision check (lng between 99.5 and 119.5),
  delivery_radius_km  integer not null default 30
                        check (delivery_radius_km between 1 and 200),

  pickup_hours        jsonb not null default '{
                        "mon": {"open": "09:00", "close": "18:00"},
                        "tue": {"open": "09:00", "close": "18:00"},
                        "wed": {"open": "09:00", "close": "18:00"},
                        "thu": {"open": "09:00", "close": "18:00"},
                        "fri": {"open": "09:00", "close": "18:00"},
                        "sat": {"open": "09:00", "close": "18:00"},
                        "sun": {"open": "09:00", "close": "18:00"}
                      }'::jsonb
                        check (valid_pickup_hours(pickup_hours)),
  -- "Closed today" — Chinese New Year, a rainy day, the owner away. Routing
  -- skips the nursery until this passes. Distinct from status = 'paused', which
  -- is a staff decision with no end date.
  closed_until        timestamptz,

  -- Has its own lorry for large plants. Only such a nursery ever sees a
  -- customer's address, and only for an order it delivers itself.
  self_delivery       boolean not null default false,
  -- Routing's last tie-break, after coverage and distance. Higher wins.
  priority            integer not null default 0,

  preferred_locale    locale_code not null default 'ms',
  contact_name        text not null default '',
  -- E.164, normalised by the trigger below. The number staff WhatsApp.
  whatsapp            text check (whatsapp is null or whatsapp ~ '^\+601[0-9]{8,9}$'),

  status              partner_status not null default 'onboarding',
  agreement_signed_on date,
  notes               text not null default '',

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint partners_location_pair check ((lat is null) = (lng is null))
);

-- Exactly one house. The index is the rule; the seed below is the row.
create unique index partners_one_house on partners (kind) where kind = 'house';

create trigger partners_set_updated_at
  before update on partners
  for each row execute function set_updated_at();

-- Malaysians write a number half a dozen ways. normalise_my_phone() is the
-- authority on what each one means (0018/0019), so the stored value is always
-- its answer — and a number it cannot read is refused by name rather than
-- stored as typed and discovered when a WhatsApp link goes nowhere.
create or replace function normalise_partner_whatsapp()
returns trigger
language plpgsql
set search_path = public
as $fn$
declare
  v_typed text := new.whatsapp;
begin
  if v_typed is null or btrim(v_typed) = '' then
    new.whatsapp := null;
    return new;
  end if;

  new.whatsapp := normalise_my_phone(v_typed);

  -- Raised rather than stored as null: a typo must not quietly erase a number
  -- that was there before.
  if new.whatsapp is null then
    raise exception 'partners: % is not a Malaysian mobile number', v_typed
      using hint = 'WhatsApp needs a mobile number, for example 012-345 6789.';
  end if;

  return new;
end;
$fn$;

create trigger partners_normalise_whatsapp
  before insert or update of whatsapp on partners
  for each row execute function normalise_partner_whatsapp();

revoke execute on function normalise_partner_whatsapp() from public, anon, authenticated;

alter table partners enable row level security;

-- Nothing here is for shoppers. When the receipt names the nursery, it will do
-- so through a SECURITY DEFINER function returning the display name and area,
-- the same way get_order_receipt() returns a receipt and not an order row.
revoke all on partners from anon;

create policy "admins read partners"
  on partners for select to authenticated
  using (is_admin());

-- Nurseries only. The house is seeded once, below, and the unique index stops a
-- second one regardless.
create policy "admins add nurseries"
  on partners for insert to authenticated
  with check (is_admin() and kind = 'nursery');

create policy "admins update partners"
  on partners for update to authenticated
  using (is_admin())
  with check (is_admin());

-- No delete policy. A partner that stops is 'ended'; orders will point at it,
-- and the record of who fulfilled what has to outlive the partnership.

-- Kind is fixed at creation. Turning a nursery into the house (or back) would
-- change what its offers and its stock mean underneath every order it has, so
-- the column is simply not in the update grant. RLS gates rows, never columns
-- (database/README.md, rule 5).
revoke update on partners from authenticated;
grant update (
  slug, name, display_name, area_label, address, lat, lng, delivery_radius_km,
  pickup_hours, closed_until, self_delivery, priority, preferred_locale,
  contact_name, whatsapp, status, agreement_signed_on, notes
) on partners to authenticated;

insert into partners (slug, kind, name, display_name, status, preferred_locale, notes)
values (
  'ecoplants', 'house', 'EcoPlants', 'EcoPlants', 'active', 'en',
  'EcoPlants'' own stock. What it holds is the Inventory screen, not offers.'
);

-- ------------------------------------------------------ editor stamp ----
-- Who last changed an offer or a bank account, from the session — never from
-- the request, for the same reason order events are stamped (0011).

create or replace function stamp_admin_editor()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.updated_by := (
    select id from admin_users
     where auth_user_id = (select auth.uid()) and is_active
  );
  new.updated_at := now();
  return new;
end;
$fn$;

revoke execute on function stamp_admin_editor() from public, anon, authenticated;

-- --------------------------------------------------------- partner offers --

create table partner_offers (
  partner_id     uuid not null references partners(id) on delete cascade,
  variant_id     uuid not null references product_variants(id) on delete cascade,
  -- What EcoPlants pays the nursery for one. The customer's price stays on the
  -- variant; the difference is EcoPlants' margin, and it is snapshotted onto
  -- each order line when the order is placed (ADR 0009, decision 1).
  net_price_sen  integer not null check (net_price_sen >= 0),
  availability   offer_availability not null default 'available',
  updated_by     uuid references admin_users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (partner_id, variant_id)
);

-- "Who stocks this plant" is the question routing asks, per variant.
create index partner_offers_variant_idx on partner_offers (variant_id);
create index partner_offers_updated_by_idx on partner_offers (updated_by);

-- The house has no offers (see the header). A trigger rather than a policy, so
-- the rule also holds for SECURITY DEFINER functions, which bypass policies.
create or replace function partner_offers_nursery_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if (select kind from partners where id = new.partner_id) is distinct from 'nursery' then
    raise exception 'partner_offers: only nurseries have offers — EcoPlants'' own stock is its inventory';
  end if;
  return new;
end;
$fn$;

revoke execute on function partner_offers_nursery_only() from public, anon, authenticated;

create trigger partner_offers_nursery_only
  before insert or update of partner_id on partner_offers
  for each row execute function partner_offers_nursery_only();

create trigger partner_offers_stamp_editor
  before insert or update on partner_offers
  for each row execute function stamp_admin_editor();

alter table partner_offers enable row level security;
revoke all on partner_offers from anon;

create policy "admins read offers"
  on partner_offers for select to authenticated
  using (is_admin());

create policy "admins add offers"
  on partner_offers for insert to authenticated
  with check (is_admin());

create policy "admins update offers"
  on partner_offers for update to authenticated
  using (is_admin())
  with check (is_admin());

-- Removing an offer means the nursery no longer stocks the plant. Orders do not
-- reference offers — they will carry their own net-price snapshot — so this
-- never rewrites what an existing order owes.
create policy "admins remove offers"
  on partner_offers for delete to authenticated
  using (is_admin());

-- ------------------------------------------------ partner payout accounts --

create table partner_payout_accounts (
  partner_id    uuid primary key references partners(id) on delete cascade,
  bank_name     text not null check (btrim(bank_name) <> ''),
  account_name  text not null check (btrim(account_name) <> ''),
  -- Digits only. Spaces and dashes are stripped by the panel before saving.
  account_no    text not null check (account_no ~ '^[0-9]{6,20}$'),
  updated_by    uuid references admin_users(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create index partner_payout_accounts_updated_by_idx on partner_payout_accounts (updated_by);

create trigger partner_payout_accounts_stamp_editor
  before insert or update on partner_payout_accounts
  for each row execute function stamp_admin_editor();

alter table partner_payout_accounts enable row level security;
revoke all on partner_payout_accounts from anon;

-- One policy per command, all owner-only. A manager runs payouts later; they
-- will see the amount owed and that an account is on file, through a function,
-- never the account number itself.
create policy "owner reads payout accounts"
  on partner_payout_accounts for select to authenticated
  using (is_admin_at_least('owner'));

create policy "owner adds payout accounts"
  on partner_payout_accounts for insert to authenticated
  with check (is_admin_at_least('owner'));

create policy "owner updates payout accounts"
  on partner_payout_accounts for update to authenticated
  using (is_admin_at_least('owner'))
  with check (is_admin_at_least('owner'));

create policy "owner removes payout accounts"
  on partner_payout_accounts for delete to authenticated
  using (is_admin_at_least('owner'));
