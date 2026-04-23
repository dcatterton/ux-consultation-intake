-- Fix infinite recursion in admin_allowlist policies caused by self-referential checks.
-- Align admin management policies with allowed_accounts admins.

drop policy if exists "Allow admins to read allowlist" on public.admin_allowlist;
drop policy if exists "Allow admins to manage allowlist" on public.admin_allowlist;

drop policy if exists "Allow admins to select submissions" on public.intake_submissions;
drop policy if exists "Allow admins to update submissions" on public.intake_submissions;
drop policy if exists "Allow anonymous intake inserts" on public.intake_submissions;

drop policy if exists "Allow admins to read recipients" on public.notification_recipients;
drop policy if exists "Allow admins to manage recipients" on public.notification_recipients;

create policy "admin_allowlist_select_admin"
on public.admin_allowlist
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

create policy "admin_allowlist_write_admin"
on public.admin_allowlist
for all
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

create policy "notification_recipients_select_admin"
on public.notification_recipients
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

create policy "notification_recipients_write_admin"
on public.notification_recipients
for all
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
