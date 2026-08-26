create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Guest Reader',
  favorite_chapter integer not null default 1 check (favorite_chapter between 1 and 114),
  daily_goal integer not null default 7 check (daily_goal between 1 and 300),
  streak_count integer not null default 0 check (streak_count >= 0),
  learning_theme text not null default 'Consistency and reflection',
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter integer not null check (chapter between 1 and 114),
  verse integer not null check (verse >= 1),
  created_at timestamptz not null default now(),
  primary key (user_id, chapter, verse)
);

create table if not exists public.progress_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter integer not null check (chapter between 1 and 114),
  verse integer not null check (verse >= 1),
  created_at timestamptz not null default now(),
  primary key (user_id, chapter, verse)
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  chapter integer not null check (chapter between 1 and 114),
  verse integer check (verse is null or verse >= 1),
  body text not null check (char_length(body) between 1 and 1200),
  likes_count integer not null default 0 check (likes_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_stats (
  id boolean primary key default true check (id),
  visitor_count bigint not null default 0 check (visitor_count >= 0)
);

insert into public.site_stats (id, visitor_count)
values (true, 0)
on conflict (id) do nothing;

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

create index if not exists progress_entries_user_created_idx
  on public.progress_entries (user_id, created_at desc);

create index if not exists community_posts_created_idx
  on public.community_posts (created_at desc);

alter table public.profiles enable row level security;
alter table public.bookmarks enable row level security;
alter table public.progress_entries enable row level security;
alter table public.community_posts enable row level security;
alter table public.site_stats enable row level security;

create or replace function public.record_site_visit()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count bigint;
begin
  update public.site_stats
  set visitor_count = visitor_count + 1
  where id = true
  returning visitor_count into next_count;

  return next_count;
end;
$$;

revoke all on function public.record_site_visit() from public;
grant execute on function public.record_site_visit() to anon, authenticated;

do $$
begin
  create policy "Profiles are visible to the owning user"
    on public.profiles
    for select
    using (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Profiles can be inserted by the owning user"
    on public.profiles
    for insert
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Profiles can be updated by the owning user"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Bookmarks are visible to the owning user"
    on public.bookmarks
    for select
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Bookmarks can be inserted by the owning user"
    on public.bookmarks
    for insert
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Bookmarks can be updated by the owning user"
    on public.bookmarks
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Bookmarks can be deleted by the owning user"
    on public.bookmarks
    for delete
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Progress is visible to the owning user"
    on public.progress_entries
    for select
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Progress can be inserted by the owning user"
    on public.progress_entries
    for insert
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Progress can be updated by the owning user"
    on public.progress_entries
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Progress can be deleted by the owning user"
    on public.progress_entries
    for delete
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Community posts are readable by authenticated users"
    on public.community_posts
    for select
    to authenticated
    using (true);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Community posts can be created by authenticated users"
    on public.community_posts
    for insert
    to authenticated
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Community posts can be updated by their author"
    on public.community_posts
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create policy "Community posts can be deleted by their author"
    on public.community_posts
    for delete
    to authenticated
    using (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();
