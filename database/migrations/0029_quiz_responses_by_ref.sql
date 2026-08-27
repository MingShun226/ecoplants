-- 0029_quiz_responses_by_ref.sql
--
-- The quiz stores what it actually knows.
--
-- `recommended_ids` was uuid[], but the storefront identifies a product by its
-- `ref` (a stable natural key like `p-snake`) — Product.id *is* the ref, so the
-- quiz never has a uuid to store. Writing refs into a uuid column is why this
-- table has stayed empty: there was no shape the quiz could have written.
--
-- Refs are the better key here anyway. A quiz response is a record of what was
-- suggested at a moment in time, and a ref stays readable in an export long
-- after somebody is trying to work out what "8f3c…" was.

alter table quiz_responses
  alter column recommended_ids type text[] using recommended_ids::text[];

comment on column quiz_responses.recommended_ids is
  'Product refs suggested for these answers, in rank order. Refs rather than '
  'uuids: the storefront keys products by ref, and a ref is still legible in '
  'an export a year later.';

-- One row per browser, so retaking the quiz corrects an answer rather than
-- counting the same person twice in the tally.
create unique index if not exists quiz_responses_session_key
  on quiz_responses (session_id) where session_id is not null;
