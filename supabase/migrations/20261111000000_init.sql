-- Stride: initial schema
--
-- Every row is owned by a (usually anonymous) auth user. RLS is on for
-- every table and all policies key off auth.uid(), so a guest can only ever
-- see the stuff they created. The activity log is written by triggers only;
-- clients can read it but can't forge entries.

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (char_length(trim(title)) between 1 and 200),
  description  text check (char_length(description) <= 5000),
  status       text not null default 'todo'
               check (status in ('todo', 'in_progress', 'in_review', 'done')),
  priority     text not null default 'normal'
               check (priority in ('low', 'normal', 'high')),
  due_date     date,
  -- fractional ordering inside a column. dropping a card between two others
  -- just takes the midpoint, so a move is always a single-row update.
  position     double precision not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index tasks_user_status_idx on public.tasks (user_id, status, position);

-- ---------------------------------------------------------------------------
-- team members (lightweight, not real auth users, just names + a color)
-- ---------------------------------------------------------------------------
create table public.team_members (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 60),
  color       text not null default '#6366f1' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now()
);

create index team_members_user_idx on public.team_members (user_id);

create table public.task_assignees (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  member_id   uuid not null references public.team_members (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, member_id)
);

create index task_assignees_member_idx on public.task_assignees (member_id);
create index task_assignees_user_idx on public.task_assignees (user_id);

-- ---------------------------------------------------------------------------
-- labels
-- ---------------------------------------------------------------------------
create table public.labels (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 32),
  color       text not null default '#64748b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.task_labels (
  task_id     uuid not null references public.tasks (id) on delete cascade,
  label_id    uuid not null references public.labels (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (task_id, label_id)
);

create index task_labels_label_idx on public.task_labels (label_id);
create index task_labels_user_idx on public.task_labels (user_id);

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body        text not null check (char_length(trim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index comments_task_idx on public.comments (task_id, created_at);
create index comments_user_idx on public.comments (user_id);

-- ---------------------------------------------------------------------------
-- activity log
-- kind is one of: created, status, title, description, priority, due_date,
-- assigned, unassigned, labeled, unlabeled. meta holds the before/after bits.
-- ---------------------------------------------------------------------------
create table public.task_activity (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.tasks (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index task_activity_task_idx on public.task_activity (task_id, created_at);
create index task_activity_user_idx on public.task_activity (user_id);

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

-- Logs task inserts + edits. security definer because clients have no insert
-- policy on task_activity (on purpose).
create or replace function public.log_task_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_activity (task_id, user_id, kind, meta)
    values (new.id, new.user_id, 'created', jsonb_build_object('status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.task_activity (task_id, user_id, kind, meta)
    values (new.id, new.user_id, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;

  if new.title is distinct from old.title then
    insert into public.task_activity (task_id, user_id, kind, meta)
    values (new.id, new.user_id, 'title', jsonb_build_object('from', old.title, 'to', new.title));
  end if;

  -- description can be long, no point storing both copies
  if new.description is distinct from old.description then
    insert into public.task_activity (task_id, user_id, kind)
    values (new.id, new.user_id, 'description');
  end if;

  if new.priority is distinct from old.priority then
    insert into public.task_activity (task_id, user_id, kind, meta)
    values (new.id, new.user_id, 'priority', jsonb_build_object('from', old.priority, 'to', new.priority));
  end if;

  if new.due_date is distinct from old.due_date then
    insert into public.task_activity (task_id, user_id, kind, meta)
    values (new.id, new.user_id, 'due_date', jsonb_build_object('from', old.due_date, 'to', new.due_date));
  end if;

  return new;
end;
$$;

create trigger tasks_log_changes
  after insert or update on public.tasks
  for each row execute function public.log_task_changes();

create or replace function public.log_assignee_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data  public.task_assignees;
  member    text;
begin
  row_data := coalesce(new, old);

  -- when a task or member gets deleted the join rows cascade away. nothing
  -- worth logging in that case (and the task row might already be gone).
  if not exists (select 1 from public.tasks t where t.id = row_data.task_id) then
    return null;
  end if;

  select m.name into member from public.team_members m where m.id = row_data.member_id;
  if member is null then
    return null;
  end if;

  insert into public.task_activity (task_id, user_id, kind, meta)
  values (
    row_data.task_id,
    row_data.user_id,
    case when tg_op = 'INSERT' then 'assigned' else 'unassigned' end,
    jsonb_build_object('member', member)
  );
  return null;
end;
$$;

create trigger task_assignees_log
  after insert or delete on public.task_assignees
  for each row execute function public.log_assignee_changes();

create or replace function public.log_label_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_data  public.task_labels;
  label     public.labels;
begin
  row_data := coalesce(new, old);

  if not exists (select 1 from public.tasks t where t.id = row_data.task_id) then
    return null;
  end if;

  select * into label from public.labels l where l.id = row_data.label_id;
  if label.id is null then
    return null;
  end if;

  insert into public.task_activity (task_id, user_id, kind, meta)
  values (
    row_data.task_id,
    row_data.user_id,
    case when tg_op = 'INSERT' then 'labeled' else 'unlabeled' end,
    jsonb_build_object('label', label.name, 'color', label.color)
  );
  return null;
end;
$$;

create trigger task_labels_log
  after insert or delete on public.task_labels
  for each row execute function public.log_label_changes();

-- trigger functions shouldn't be callable over the REST api
revoke execute on function public.log_task_changes() from public, anon, authenticated;
revoke execute on function public.log_assignee_changes() from public, anon, authenticated;
revoke execute on function public.log_label_changes() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- row level security
-- (select auth.uid()) instead of auth.uid() so postgres evaluates it once per
-- query instead of once per row.
-- ---------------------------------------------------------------------------
alter table public.tasks          enable row level security;
alter table public.team_members   enable row level security;
alter table public.task_assignees enable row level security;
alter table public.labels         enable row level security;
alter table public.task_labels    enable row level security;
alter table public.comments       enable row level security;
alter table public.task_activity  enable row level security;

-- tasks
create policy "own tasks: select" on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own tasks: insert" on public.tasks
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own tasks: update" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own tasks: delete" on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));

-- team members
create policy "own members: select" on public.team_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own members: insert" on public.team_members
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own members: update" on public.team_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own members: delete" on public.team_members
  for delete to authenticated using (user_id = (select auth.uid()));

-- labels
create policy "own labels: select" on public.labels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own labels: insert" on public.labels
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own labels: update" on public.labels
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "own labels: delete" on public.labels
  for delete to authenticated using (user_id = (select auth.uid()));

-- join tables: besides owning the row, you also have to own BOTH sides of the
-- link. otherwise someone could guess another user's task uuid and attach
-- their own label to it.
create policy "own assignees: select" on public.task_assignees
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own assignees: insert" on public.task_assignees
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.team_members m where m.id = member_id and m.user_id = (select auth.uid()))
  );
create policy "own assignees: delete" on public.task_assignees
  for delete to authenticated using (user_id = (select auth.uid()));

create policy "own task labels: select" on public.task_labels
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own task labels: insert" on public.task_labels
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.labels l where l.id = label_id and l.user_id = (select auth.uid()))
  );
create policy "own task labels: delete" on public.task_labels
  for delete to authenticated using (user_id = (select auth.uid()));

-- comments (no editing for now, just add/remove)
create policy "own comments: select" on public.comments
  for select to authenticated using (user_id = (select auth.uid()));
create policy "own comments: insert" on public.comments
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid()))
  );
create policy "own comments: delete" on public.comments
  for delete to authenticated using (user_id = (select auth.uid()));

-- activity is read-only from the client
create policy "own activity: select" on public.task_activity
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- realtime: lets a second tab / device see moves without a refresh.
-- postgres_changes respects RLS so you only get your own rows.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.tasks;
