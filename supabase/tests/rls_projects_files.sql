-- RLS regression tests for projects, meeting materials and the business-files bucket. Rolls back.
-- Expects the seeded business 'אורשינא'. Every row in the final select must have pass = true.
begin;
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','outsider@test.local','x',now(),'{}','{}',now(),now()),
       ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','owner@test.local','x',now(),'{}','{}',now(),now());
insert into business_memberships select id,'22222222-2222-2222-2222-222222222222','owner',now() from businesses where name='אורשינא';
insert into projects(id,business_id,title) select '77777777-7777-7777-7777-777777777777',id,'p' from businesses where name='אורשינא';
insert into meetings(id,business_id) select '55555555-5555-5555-5555-555555555555',id from businesses where name='אורשינא';
insert into meeting_materials(meeting_id,business_id,kind,title) select '55555555-5555-5555-5555-555555555555',id,'note','secret' from businesses where name='אורשינא';
insert into storage.objects(bucket_id,name,owner) select 'business-files', id::text||'/meetings/x/rec.webm', null from businesses where name='אורשינא';
create temp table results(test text, pass boolean); grant all on results to authenticated;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
insert into results select 'outsider: no projects', (select count(*) from projects)=0;
insert into results select 'outsider: no storage objects', (select count(*) from storage.objects where bucket_id='business-files')=0;
insert into results select 'outsider: no materials', (select count(*) from meeting_materials)=0;
select set_config('request.jwt.claims','{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}',true);
insert into results select 'owner: sees projects', (select count(*) from projects)=1;
insert into results select 'owner: no materials (consultant files)', (select count(*) from meeting_materials)=0;
with u as (update projects set title='x' returning 1) insert into results select 'owner: cannot edit projects', (select count(*) from u)=0;
reset role;
select * from results;
rollback;
