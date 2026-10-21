-- Cross-tenant RLS regression tests. Runs inside a transaction and rolls back.
-- Run with: psql "$DATABASE_URL" -f supabase/tests/rls_isolation.sql  (or paste into the SQL editor)
-- Expects the seeded business 'אורשינא'. Every row in the final select must have pass = true.
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','outsider@test.local','x',now(),'{}','{}',now(),now()),
       ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','owner@test.local','x',now(),'{}','{}',now(),now());
insert into organizations(id,name,owner_user_id) values ('33333333-3333-3333-3333-333333333333','other','11111111-1111-1111-1111-111111111111');
insert into organization_memberships values ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','admin',now());
insert into businesses(id,organization_id,name) values ('44444444-4444-4444-4444-444444444444','33333333-3333-3333-3333-333333333333','other biz');
insert into business_memberships values ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','consultant',now());
insert into business_memberships select id,'22222222-2222-2222-2222-222222222222','owner',now() from businesses where name='אורשינא';
insert into meetings(id,business_id,status,shared_summary) select '55555555-5555-5555-5555-555555555555',id,'draft','draft summary' from businesses where name='אורשינא';
insert into meeting_private_notes select '55555555-5555-5555-5555-555555555555',id,'SECRET',now() from businesses where name='אורשינא';
insert into tasks(id,business_id,title,assignee_id) select '66666666-6666-6666-6666-666666666666',id,'t','22222222-2222-2222-2222-222222222222' from businesses where name='אורשינא';
insert into findings(business_id,title) select id,'f' from businesses where name='אורשינא';

create temp table results(test text, pass boolean);
grant all on results to authenticated;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
insert into results select 'outsider sees only own business', (select count(*) from businesses)=1 and (select name from businesses)='other biz';
insert into results select 'outsider sees no אורשינא tasks/findings/meetings/templates', (select count(*) from tasks)+(select count(*) from findings)+(select count(*) from meetings)+(select count(*) from questionnaire_templates)=0;
with u as (update businesses set name='hacked' where name='אורשינא' returning 1) insert into results select 'outsider cannot update אורשינא', (select count(*) from u)=0;

select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',true);
insert into results select 'owner sees own business only', (select count(*) from businesses)=1;
insert into results select 'owner cannot see draft meeting', (select count(*) from meetings)=0;
insert into results select 'owner cannot see private notes', (select count(*) from meeting_private_notes)=0;
insert into results select 'owner cannot see findings (consultant interpretation)', (select count(*) from findings)=0;
insert into results select 'owner sees assigned task', (select count(*) from tasks)=1;
with u as (update tasks set status='done' where id='66666666-6666-6666-6666-666666666666' returning completed_at) insert into results select 'owner can update own task status (completed_at set)', (select count(*) from u where completed_at is not null)=1;
reset role;
update meetings set status='published' where id='55555555-5555-5555-5555-555555555555';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',true);
insert into results select 'owner sees published meeting', (select count(*) from meetings)=1;
insert into results select 'owner still cannot see private notes after publish', (select count(*) from meeting_private_notes)=0;
reset role;
select * from results;
rollback;
