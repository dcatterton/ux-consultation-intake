-- The previous migration dropped intake_submissions policies and never recreated them.
-- Restore public insert access and admin read/update access.

drop policy if exists "Allow anonymous intake inserts" on public.intake_submissions;
drop policy if exists "intake_submissions_insert_anon" on public.intake_submissions;
drop policy if exists "intake_submissions_insert_authenticated" on public.intake_submissions;
drop policy if exists "intake_submissions_select_admin" on public.intake_submissions;
drop policy if exists "intake_submissions_update_admin" on public.intake_submissions;

-- Public intake form submissions (unauthenticated)
create policy "intake_submissions_insert_anon"
on public.intake_submissions
for insert
to anon
with check (true);

-- Allow signed-in users to submit the public form as well
create policy "intake_submissions_insert_authenticated"
on public.intake_submissions
for insert
to authenticated
with check (true);

-- Admins can read submissions
create policy "intake_submissions_select_admin"
on public.intake_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.allowed_accounts aa
    where lower(aa.email) = lower(auth.jwt()->>'email')
      and aa.is_active
      and aa.role = 'admin'
  )
);

-- Admins can update submissions
create policy "intake_submissions_update_admin"
on public.intake_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.allowed_accounts aa
    where lower(aa.email) = lower(auth.jwt()->>'email')
      and aa.is_active
      and aa.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.allowed_accounts aa
    where lower(aa.email) = lower(auth.jwt()->>'email')
      and aa.is_active
      and aa.role = 'admin'
  )
);
