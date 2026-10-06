-- Allow admins to delete intake submissions and their uploaded attachments.

drop policy if exists "intake_submissions_delete_admin" on public.intake_submissions;
drop policy if exists "intake_attachments_delete_admin" on storage.objects;

create policy "intake_submissions_delete_admin"
on public.intake_submissions
for delete
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

create policy "intake_attachments_delete_admin"
on storage.objects
for delete
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
