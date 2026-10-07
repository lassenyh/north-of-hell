-- An authenticated administrator may verify only their own project grant.
grant select on public.project_admin_auth_users to authenticated;

create policy "Admins can read their own authorization"
on public.project_admin_auth_users
for select to authenticated
using ((select auth.uid()) = user_id);
