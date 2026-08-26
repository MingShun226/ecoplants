-- 0015_merge_review_update_policies.sql
--
-- `reviews` ended up with two permissive UPDATE policies for `authenticated`:
-- the author's own edit rule from 0005, and the admin moderation rule added in
-- 0014. Postgres evaluates every permissive policy for the same role and
-- command, so an author editing their own review paid for the admin check too.
--
-- Merged into one, the same fix 0008 applied to reviews' SELECT policies and
-- 0013 applied to orders. The two halves keep their different shapes, which is
-- the whole reason this needs care:
--
--   an author may edit their own review, but only while it is unpublished, and
--   may not publish it — hence `is_approved = false` in the check;
--
--   an admin may edit any review and may flip `is_approved` either way, which
--   is what moderation is.
--
-- `is_admin()` is first in both expressions so it short-circuits the
-- `auth.uid()` comparison on the panel's path.

drop policy "authors edit own unpublished reviews" on reviews;
drop policy "admins moderate reviews" on reviews;

create policy "edit own unpublished review, or any as admin"
  on reviews for update to authenticated
  using (
    is_admin()
    or (select auth.uid()) = customer_id
  )
  with check (
    is_admin()
    or ((select auth.uid()) = customer_id and is_approved = false)
  );
