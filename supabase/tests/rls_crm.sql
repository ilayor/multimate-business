-- RLS check for the CRM tables: a stranger sees nothing and cannot write; preferences stay private.
-- Runs inside a transaction and rolls back. Returns one row per check; every `ok` must be true.
begin;
create temp table results (check_name text, ok boolean) on commit drop;
grant all on results to authenticated;

-- a stranger with no membership
insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-0000000000aa', 'stranger@example.com', 'authenticated', 'authenticated');
-- one client on the first business, as the database owner
insert into public.clients (id, business_id, full_name, kind) select '00000000-0000-0000-0000-0000000000c1', id, 'בדיקה', 'client' from public.businesses limit 1;
insert into public.user_prefs (user_id, prefs) select user_id, '{"t":1}' from public.business_memberships limit 1 on conflict (user_id) do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000aa","role":"authenticated"}', true);

insert into results select 'stranger sees no clients', (select count(*) = 0 from public.clients);
insert into results select 'stranger sees no sessions/payments/packages/templates',
  (select count(*) = 0 from public.sessions) and (select count(*) = 0 from public.payments)
  and (select count(*) = 0 from public.packages) and (select count(*) = 0 from public.message_templates);
insert into results select 'stranger sees no one else''s prefs', (select count(*) = 0 from public.user_prefs);
do $$ begin
  begin
    insert into public.clients (business_id, full_name) select id, 'x' from public.businesses limit 1;
    insert into results values ('stranger cannot insert a client', (select count(*) = 0 from public.businesses));
  exception when others then
    insert into results values ('stranger cannot insert a client', true);
  end;
end $$;
with u as (update public.clients set full_name = 'hacked' where id = '00000000-0000-0000-0000-0000000000c1' returning 1)
insert into results select 'stranger cannot update a client', (select count(*) = 0 from u);

reset role;
select * from results;
rollback;
