-- 0023_customer_from_metadata.sql
--
-- Customers are no longer created from `auth.users.phone`.
--
-- 0018 used Supabase's native phone identity, which turned out to be tied to
-- the SMS subsystem: the Phone provider cannot be saved without an SMS provider
-- configured, even with confirmations off and nothing ever sent. Requiring
-- Twilio credentials that will never be called — to support an OTP that is
-- explicitly not wanted — is the tail wagging the dog.
--
-- So the number is carried as a synthetic address instead
-- (`60123456789@phone.ecoplants.my`, which nobody ever sees or types) and the
-- real E.164 arrives in the signup metadata. `customers.phone` is unchanged and
-- remains the source of truth everywhere else.
--
-- The discriminator changes with it. It used to be "has a phone = customer";
-- now every auth user has an address, so it is "has a phone in the signup
-- metadata = customer". Staff are provisioned server-side without that
-- metadata and still never acquire a shopping profile.

create or replace function handle_new_customer()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_phone text;
begin
  -- Signup metadata is client-supplied, so the number is re-normalised here
  -- rather than trusted. An account cannot be created with a malformed number
  -- even if something bypasses the form.
  v_phone := normalise_my_phone(new.raw_user_meta_data->>'phone');

  -- No phone in the metadata: this is a staff account, provisioned
  -- server-side. An admin is not a customer (ADR 0006).
  if v_phone is null then
    return new;
  end if;

  insert into customers (id, full_name, phone)
  values (
    new.id,
    nullif(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    v_phone
  )
  on conflict (id) do nothing;

  return new;
end;
$fn$;

comment on function handle_new_customer is
  'Creates the customers row when an auth user is created with a valid '
  'Malaysian mobile in its signup metadata. Skips accounts without one, which '
  'are staff. Re-normalises the number rather than trusting the client.';

-- Trigger functions are not called through the API; Postgres does not check
-- EXECUTE when one fires. Re-applied because CREATE OR REPLACE resets grants.
revoke execute on function handle_new_customer() from public, anon, authenticated;

-- One account per number. Previously implied by auth.users.phone being unique;
-- now that the number lives here, this table has to enforce it.
create unique index if not exists customers_phone_key on customers (phone);
