create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  organization text,
  details text not null,
  status text not null default 'new',
  review_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_allowlist (
  email text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_recipients (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.intake_submissions enable row level security;
alter table public.admin_allowlist enable row level security;
alter table public.notification_recipients enable row level security;

create policy "Allow anonymous intake inserts"
on public.intake_submissions
for insert
to anon
with check (true);

create policy "Allow admins to select submissions"
on public.intake_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);

create policy "Allow admins to update submissions"
on public.intake_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
)
with check (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);

create policy "Allow admins to read allowlist"
on public.admin_allowlist
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);

create policy "Allow admins to manage allowlist"
on public.admin_allowlist
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
)
with check (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);

create policy "Allow admins to read recipients"
on public.notification_recipients
for select
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);

create policy "Allow admins to manage recipients"
on public.notification_recipients
for all
to authenticated
using (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
)
with check (
  exists (
    select 1
    from public.admin_allowlist a
    where a.email = lower(auth.jwt()->>'email')
  )
);
