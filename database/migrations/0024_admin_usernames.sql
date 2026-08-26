-- 0024_admin_usernames.sql
--
-- Staff sign in with a username. Not an email address, and not a username that
-- is secretly an email address.
--
-- 0009 keyed staff on `auth.users.email` and the panel papered over it by
-- appending `@ecoplants.my` to whatever was typed. Two problems with that:
--
--   1. `ecoplants.my` is the shop's real domain. The day someone creates a real
--      `admin@ecoplants.my` mailbox, or staff want to sign in with their actual
--      work addresses, the two meanings collide.
--   2. Typing a full address still worked, so it was an email login wearing a
--      username label.
--
-- The username is now real, stored data: unique, validated, and the thing the
-- panel displays. The auth address is derived from it — `admin@staff.ecoplants.my`
-- — on a subdomain that can never be a real inbox, exactly as customer phone
-- numbers are carried on `@phone.ecoplants.my` (ADR 0008).
--
-- Nobody sees or types the derived address.

alter table admin_users add column if not exists username text;

-- Backfill from the local part of the existing address before adding the
-- constraints, so the one account that exists survives the change.
update admin_users a
   set username = lower(split_part(u.email, '@', 1))
  from auth.users u
 where u.id = a.auth_user_id and a.username is null;

-- Lowercase, starts with a letter, then letters/digits/dot/underscore/hyphen.
-- The range is deliberately narrower than an email local part allows: a
-- username someone has to read out over the phone should not contain quoting.
alter table admin_users
  add constraint admin_users_username_format
  check (username ~ '^[a-z][a-z0-9._-]{2,29}$');

alter table admin_users alter column username set not null;

create unique index if not exists admin_users_username_key on admin_users (username);

comment on column admin_users.username is
  'What staff type to sign in. The auth address is derived from it as '
  '<username>@staff.ecoplants.my, which is never shown or typed.';

-- Move the existing account onto the internal domain so the shop domain is
-- free for real mailboxes.
update auth.users u
   set email = a.username || '@staff.ecoplants.my',
       updated_at = now()
  from admin_users a
 where a.auth_user_id = u.id
   and u.email not like '%@staff.ecoplants.my';
