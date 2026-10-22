-- Slice 2/3 rework: projects with sub-goals, richer tasks and meetings, business profile, file storage.

-- ---------- business profile ----------
alter table public.businesses
  add column if not exists profession text,
  add column if not exists owner_name text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists social_links jsonb not null default '[]',
  add column if not exists sites jsonb not null default '[]',
  add column if not exists services jsonb not null default '[]',
  add column if not exists logo_path text;

-- ---------- projects ----------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  department_code text,
  title text not null,
  current_state text,
  goal text,
  unit text,
  baseline numeric,
  current_value numeric,
  target numeric,
  target_date date,
  status text not null default 'active' check (status in ('active','done','paused')),
  position int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.projects(business_id, position);

create table public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.project_milestones(project_id);

-- ---------- tasks ----------
alter table public.tasks
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists milestone_id uuid references public.project_milestones(id) on delete set null,
  add column if not exists assignee_name text,
  add column if not exists archived_at timestamptz,
  add column if not exists position int not null default 0;
create index if not exists tasks_project_idx on public.tasks(project_id);

create or replace function public.guard_owner_task_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not is_business_consultant(old.business_id) then
    if new.title is distinct from old.title or new.description is distinct from old.description
       or new.done_definition is distinct from old.done_definition or new.assignee_id is distinct from old.assignee_id
       or new.assignee_name is distinct from old.assignee_name
       or new.due_on is distinct from old.due_on or new.priority is distinct from old.priority
       or new.business_id is distinct from old.business_id or new.finding_id is distinct from old.finding_id
       or new.goal_id is distinct from old.goal_id or new.meeting_id is distinct from old.meeting_id
       or new.project_id is distinct from old.project_id or new.milestone_id is distinct from old.milestone_id
       or new.archived_at is distinct from old.archived_at
       or new.is_weekly_commitment is distinct from old.is_weekly_commitment then
      raise exception 'owners may only update status and comment';
    end if;
  end if;
  if new.status = 'done' and old.status <> 'done' then new.completed_at := now(); end if;
  if new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;

-- ---------- meetings: fixed format, scheduling, archive ----------
alter table public.meetings
  add column if not exists title text,
  add column if not exists duration_minutes int not null default 60,
  add column if not exists location text,
  add column if not exists notes_current text,
  add column if not exists notes_last_week text,
  add column if not exists notes_progress text,
  add column if not exists notes_problems text,
  add column if not exists notes_goals text,
  add column if not exists completed_at timestamptz,
  add column if not exists archived_at timestamptz;

create table public.meeting_materials (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('link','file','note')),
  title text not null,
  url text,
  storage_path text,
  body text,
  created_at timestamptz not null default now()
);
create index on public.meeting_materials(meeting_id);

create table public.meeting_recordings (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  storage_path text not null,
  segment int not null default 1,
  duration_seconds int,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
create index on public.meeting_recordings(meeting_id);

-- ---------- RLS ----------
alter table public.projects enable row level security;
alter table public.project_milestones enable row level security;
alter table public.meeting_materials enable row level security;
alter table public.meeting_recordings enable row level security;

create policy proj_select on public.projects for select to authenticated using (is_business_member(business_id));
create policy proj_write on public.projects for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));
create policy ms_select on public.project_milestones for select to authenticated using (is_business_member(business_id));
create policy ms_write on public.project_milestones for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));
-- materials and recordings are consultant working files for now
create policy mm_all on public.meeting_materials for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));
create policy mr_all on public.meeting_recordings for all to authenticated
  using (is_business_consultant(business_id)) with check (is_business_consultant(business_id));

-- ---------- storage: one private bucket, first path segment = business id ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('business-files', 'business-files', false, 52428800)
on conflict (id) do nothing;

create or replace function public.path_business_id(p text) returns uuid
language plpgsql immutable as $$
begin
  return split_part(p, '/', 1)::uuid;
exception when others then
  return null;
end $$;

create policy bf_select on storage.objects for select to authenticated
  using (bucket_id = 'business-files' and is_business_member(path_business_id(name)));
create policy bf_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'business-files' and is_business_consultant(path_business_id(name)));
create policy bf_update on storage.objects for update to authenticated
  using (bucket_id = 'business-files' and is_business_consultant(path_business_id(name)));
create policy bf_delete on storage.objects for delete to authenticated
  using (bucket_id = 'business-files' and is_business_consultant(path_business_id(name)));

alter function public.path_business_id(text) set search_path = public;
