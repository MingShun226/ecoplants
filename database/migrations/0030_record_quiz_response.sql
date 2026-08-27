-- 0030_record_quiz_response.sql
--
-- Quiz responses go through one function, not a table grant.
--
-- Recording an answer set needs an upsert: retaking the quiz should correct a
-- response, not add a second person to the tally. But an upsert needs UPDATE,
-- and an UPDATE policy permissive enough for `anon` — who has no session to
-- scope it by — would let anybody rewrite anybody else's answers.
--
-- So the write is a function instead. It takes the session id as an argument
-- and only ever touches that row, which is the narrow permission the table
-- grant could not express.

create or replace function record_quiz_response(
  p_session_id text,
  p_answers    jsonb,
  p_refs       text[],
  p_locale     text
)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_session_id is null or btrim(p_session_id) = '' then
    raise exception 'record_quiz_response: a session id is required';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or p_answers = '{}'::jsonb then
    return;  -- nothing said, nothing to record
  end if;

  insert into quiz_responses (session_id, answers, recommended_ids, locale, customer_id)
  values (
    btrim(p_session_id),
    p_answers,
    coalesce(p_refs, '{}'),
    coalesce(nullif(p_locale, ''), 'en')::locale_code,
    -- Deliberately null even for a signed-in customer. The value is in the
    -- aggregate, and what someone said about the light in their bedroom is not
    -- something to staple to their order history without asking.
    null
  )
  on conflict (session_id) where session_id is not null
  do update set
    answers         = excluded.answers,
    recommended_ids = excluded.recommended_ids,
    locale          = excluded.locale,
    created_at      = now();
end;
$fn$;

comment on function record_quiz_response is
  'Records or corrects one quiz response, keyed on an anonymous browser '
  'session. A function rather than a table grant: an UPDATE policy loose '
  'enough for anon would let anyone rewrite anyone else''s answers.';

revoke execute on function record_quiz_response(text, jsonb, text[], text) from public;
grant execute on function record_quiz_response(text, jsonb, text[], text)
  to anon, authenticated, service_role;

-- Direct inserts are no longer the way in. One door.
drop policy if exists "anyone submits a quiz response" on quiz_responses;
