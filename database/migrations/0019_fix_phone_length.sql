-- 0019_fix_phone_length.sql
--
-- 0018 shipped `^601[0-9]{7,8}$`, which is wrong at both ends and rejected
-- every 011 number — one of the most common Malaysian prefixes.
--
-- Malaysian mobiles are 10 or 11 digits nationally:
--
--   012-345 6789    10 digits  -> +60 12 345 6789   (010/012/013/014/016-019)
--   011-1234 5678   11 digits  -> +60 11 1234 5678  (011, and 015)
--
-- In E.164 that is `60` followed by 9 or 10 digits, all starting `1`. Written
-- as `601` plus the rest, the rest is 8 or 9 digits — not 7 or 8. The old lower
-- bound also accepted a 9-digit national number, which is too short to be real.
--
-- Forward-only, rather than editing 0018: the applied history is a record of
-- what ran, and a migration that quietly changes after the fact is worse than
-- one that is visibly corrected.

create or replace function normalise_my_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $fn$
declare
  v_digits text := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
begin
  if left(v_digits, 2) = '60' then
    v_digits := v_digits;
  elsif left(v_digits, 1) = '0' then
    v_digits := '60' || substr(v_digits, 2);
  else
    v_digits := '60' || v_digits;
  end if;

  -- 60 + 9 or 10 digits, starting 1. Landlines (03, 04, …) are rejected on
  -- purpose: deliveries and the whole support channel run on WhatsApp.
  if v_digits !~ '^601[0-9]{8,9}$' then
    return null;
  end if;

  return '+' || v_digits;
end;
$fn$;
