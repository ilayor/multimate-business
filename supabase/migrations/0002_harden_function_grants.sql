-- Functions are executable by PUBLIC by default; restrict to what each one needs.
revoke execute on function public.create_business(uuid, text), public.start_diagnostic(uuid, uuid),
  public.is_business_member(uuid), public.is_business_consultant(uuid), public.is_org_member(uuid),
  public.handle_new_user(), public.guard_owner_task_update(), public.guard_answer_snapshot() from public, anon;
-- trigger functions are never called directly
revoke execute on function public.handle_new_user(), public.guard_owner_task_update(), public.guard_answer_snapshot() from authenticated;
grant execute on function public.create_business(uuid, text), public.start_diagnostic(uuid, uuid),
  public.is_business_member(uuid), public.is_business_consultant(uuid), public.is_org_member(uuid) to authenticated;
alter function public.guard_answer_snapshot() set search_path = public;
