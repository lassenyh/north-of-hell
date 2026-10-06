-- Public Auth sign-ups must remain disabled. Accounts added by a Supabase
-- administrator are then granted North of Hell admin access automatically.
create or replace function public.authorize_new_project_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_admin_auth_users (user_id, project_slug)
  values (new.id, 'north-of-hell')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function public.authorize_new_project_admin() from public, anon, authenticated;

drop trigger if exists authorize_new_project_admin on auth.users;
create trigger authorize_new_project_admin
after insert on auth.users
for each row execute function public.authorize_new_project_admin();
