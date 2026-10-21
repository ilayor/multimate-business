-- Multimate Business — Slice 0/1 schema
-- Tenancy: organization (consulting practice) -> business. Access to business data is
-- granted ONLY through business_memberships (role consultant|owner). Org membership
-- alone discloses nothing about client businesses.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- organizations ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','consultant')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ---------- businesses ----------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  offerings text,
  current_price text,
  target_segments text,
  vision text,
  baseline_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.businesses(organization_id);

create table public.business_memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('consultant','owner')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index on public.business_memberships(user_id);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  position int not null default 0,
  unique (business_id, code)
);

-- ---------- authorization helpers ----------
create or replace function public.is_business_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_memberships where business_id = bid and user_id = auth.uid());
$$;

create or replace function public.is_business_consultant(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from business_memberships
                 where business_id = bid and user_id = auth.uid() and role = 'consultant');
$$;

create or replace function public.is_org_member(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from organization_memberships where organization_id = oid and user_id = auth.uid());
$$;

-- ---------- questionnaire templates ----------
create table public.questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  version int not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.questionnaire_templates(id) on delete cascade,
  department_code text not null,
  type text not null check (type in ('short_text','long_text','number','single_select')),
  position int not null,
  prompt text not null,
  options_json jsonb
);
create index on public.template_questions(template_id);

-- ---------- diagnostics ----------
create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  template_id uuid references public.questionnaire_templates(id) on delete set null,
  template_title text not null,
  template_version int not null,
  state text not null default 'in_progress' check (state in ('in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_by uuid references auth.users(id)
);
create index on public.diagnostics(business_id);

-- question wording is snapshotted per diagnostic so later template edits never change history
create table public.diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  position int not null,
  question_snapshot_json jsonb not null,
  answer_text text,
  is_unknown boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);
create index on public.diagnostic_answers(diagnostic_id);
create index on public.diagnostic_answers(business_id);

-- ---------- findings ----------
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  diagnostic_id uuid references public.diagnostics(id) on delete set null,
  answer_id uuid references public.diagnostic_answers(id) on delete set null,
  department_code text,
  title text not null,
  evidence text,
  rationale text,
  impact int not null default 2 check (impact between 1 and 3),
  urgency int not null default 2 check (urgency between 1 and 3),
  effort int not null default 2 check (effort between 1 and 3),
  is_blocker boolean not null default false,
  priority_override int,
  priority_override_reason text,
  status text not null default 'open' check (status in ('open','in_progress','resolved','dismissed')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (priority_override is null or priority_override_reason is not null)
);
create index on public.findings(business_id);

-- ---------- goals ----------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  outcome text not null,
  metric_name text,
  unit text,
  baseline numeric,
  target numeric,
  target_on date,
  status text not null default 'active' check (status in ('active','achieved','dropped')),
  created_at timestamptz not null default now()
);
create index on public.goals(business_id);

-- ---------- meetings ----------
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  scheduled_at timestamptz not null default now(),
  agenda text,
  shared_summary text,
  decisions text,
  follow_up_questions text,
  next_meeting_at timestamptz,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);
create index on public.meetings(business_id, scheduled_at);

-- private consultant notes live in their own table so owners can never select them
create table public.meeting_private_notes (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);

-- ---------- tasks ----------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  finding_id uuid references public.findings(id) on delete set null,
  goal_id uuid references public.goals(id) on delete set null,
  meeting_id uuid references public.meetings(id) on delete set null,
  department_code text,
  title text not null,
  description text,
  done_definition text,
  assignee_id uuid references auth.users(id),
  due_on date,
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','canceled')),
  is_weekly_commitment boolean not null default false,
  owner_comment text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.tasks(business_id, due_on);

-- owners may only touch status/comment on their own tasks
create or replace function public.guard_owner_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_business_consultant(old.business_id) then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.done_definition is distinct from old.done_definition or new.assignee_id is distinct from old.assignee_id
       or new.due_on is distinct from old.due_on or new.priority is distinct from old.priority
       or new.business_id is distinct from old.business_id or new.finding_id is distinct from old.finding_id
       or new.goal_id is distinct from old.goal_id or new.meeting_id is distinct from old.meeting_id
       or new.is_weekly_commitment is distinct from old.is_weekly_commitment then
      raise exception 'owners may only update status and comment';
    end if;
  end if;
  if new.status = 'done' and old.status <> 'done' then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;
create trigger tasks_guard before update on public.tasks
for each row execute function public.guard_owner_task_update();

-- ---------- audit ----------
create table public.audit_events (
  id bigint generated always as identity primary key,
  business_id uuid references public.businesses(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  occurred_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.businesses enable row level security;
alter table public.business_memberships enable row level security;
alter table public.departments enable row level security;
alter table public.questionnaire_templates enable row level security;
alter table public.template_questions enable row level security;
alter table public.diagnostics enable row level security;
alter table public.diagnostic_answers enable row level security;
alter table public.findings enable row level security;
alter table public.goals enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_private_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.audit_events enable row level security;

-- profiles: self, plus people who share a business with me
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or exists (
    select 1 from business_memberships a join business_memberships b on a.business_id = b.business_id
    where a.user_id = auth.uid() and b.user_id = profiles.id));
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid());

create policy org_select on public.organizations for select to authenticated using (is_org_member(id));
create policy orgm_select on public.organization_memberships for select to authenticated using (user_id = auth.uid());

create policy biz_select on public.businesses for select to authenticated using (is_business_member(id));
create policy biz_update on public.businesses for update to authenticated using (is_business_consultant(id));

create policy bm_select on public.business_memberships for select to authenticated using (is_business_member(business_id));

create policy dept_select on public.departments for select to authenticated using (is_business_member(business_id));
create policy dept_write on public.departments for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

create policy tpl_select on public.questionnaire_templates for select to authenticated using (is_org_member(organization_id));
create policy tq_select on public.template_questions for select to authenticated using (
  exists (select 1 from questionnaire_templates t where t.id = template_id and is_org_member(t.organization_id)));

create policy diag_select on public.diagnostics for select to authenticated using (is_business_member(business_id));
create policy diag_update on public.diagnostics for update to authenticated using (is_business_consultant(business_id));

create policy ans_select on public.diagnostic_answers for select to authenticated using (is_business_member(business_id));
create policy ans_update on public.diagnostic_answers for update to authenticated
  using (is_business_member(business_id)) with check (is_business_member(business_id));

create policy find_all on public.findings for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

create policy goal_select on public.goals for select to authenticated using (is_business_member(business_id));
create policy goal_write on public.goals for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

create policy meet_select on public.meetings for select to authenticated using (
  is_business_consultant(business_id) or (status = 'published' and is_business_member(business_id)));
create policy meet_write on public.meetings for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

create policy mpn_all on public.meeting_private_notes for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

create policy task_select on public.tasks for select to authenticated using (is_business_member(business_id));
create policy task_write on public.tasks for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));
create policy task_owner_update on public.tasks for update to authenticated
  using (is_business_member(business_id) and assignee_id = auth.uid())
  with check (is_business_member(business_id) and assignee_id = auth.uid());

create policy audit_select on public.audit_events for select to authenticated using (is_business_consultant(business_id));

-- ---------- RPCs ----------
create or replace function public.create_business(p_org uuid, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if not is_org_member(p_org) then raise exception 'not authorized'; end if;
  insert into businesses(organization_id, name) values (p_org, p_name) returning id into bid;
  insert into business_memberships(business_id, user_id, role) values (bid, auth.uid(), 'consultant');
  insert into departments(business_id, code, name, position) values
    (bid,'strategy','אסטרטגיה',1),(bid,'finance','כספים ורגולציה',2),(bid,'product','מוצר / שירות',3),
    (bid,'marketing','שיווק',4),(bid,'sales','מכירות',5),(bid,'service','שירות ושימור',6);
  insert into audit_events(business_id, actor_id, action, entity_type, entity_id)
    values (bid, auth.uid(), 'create', 'business', bid);
  return bid;
end $$;

create or replace function public.start_diagnostic(p_business uuid, p_template uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare did uuid; t record;
begin
  if not is_business_consultant(p_business) then raise exception 'not authorized'; end if;
  select * into t from questionnaire_templates where id = p_template;
  if t is null or not exists (select 1 from businesses b where b.id = p_business and b.organization_id = t.organization_id) then
    raise exception 'template not available for this business';
  end if;
  insert into diagnostics(business_id, template_id, template_title, template_version, created_by)
    values (p_business, t.id, t.title, t.version, auth.uid()) returning id into did;
  insert into diagnostic_answers(diagnostic_id, business_id, position, question_snapshot_json)
    select did, p_business, q.position,
           jsonb_build_object('question_id', q.id, 'department_code', q.department_code, 'type', q.type,
                              'prompt', q.prompt, 'options', q.options_json)
    from template_questions q where q.template_id = t.id order by q.position;
  insert into audit_events(business_id, actor_id, action, entity_type, entity_id)
    values (p_business, auth.uid(), 'start', 'diagnostic', did);
  return did;
end $$;

-- the snapshot must never change once taken
create or replace function public.guard_answer_snapshot() returns trigger language plpgsql as $$
begin
  if new.question_snapshot_json is distinct from old.question_snapshot_json
     or new.diagnostic_id is distinct from old.diagnostic_id or new.business_id is distinct from old.business_id
     or new.position is distinct from old.position then
    raise exception 'question snapshot is immutable';
  end if;
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger answers_guard before update on public.diagnostic_answers
for each row execute function public.guard_answer_snapshot();

revoke execute on function public.create_business(uuid, text) from anon;
revoke execute on function public.start_diagnostic(uuid, uuid) from anon;
