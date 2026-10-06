-- Private bucket for intake form file uploads. Admins download via signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake-attachments',
  'intake-attachments',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "intake_attachments_insert_anon" on storage.objects;
drop policy if exists "intake_attachments_insert_authenticated" on storage.objects;
drop policy if exists "intake_attachments_select_admin" on storage.objects;

create policy "intake_attachments_insert_anon"
on storage.objects
for insert
to anon
with check (bucket_id = 'intake-attachments');

create policy "intake_attachments_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'intake-attachments');

create policy "intake_attachments_select_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'intake-attachments'
  and exists (
    select 1
    from public.allowed_accounts aa
    where lower(aa.email) = lower(auth.jwt()->>'email')
      and aa.is_active
      and aa.role = 'admin'
  )
);
