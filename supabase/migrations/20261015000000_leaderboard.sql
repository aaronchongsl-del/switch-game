-- Switch leaderboard. No direct table access: the browser can only call submit_score and leaderboard.
create table public.scores (
  id           bigint generated always as identity primary key,
  player_id    uuid        not null,
  name         text        not null check (char_length(name) between 1 and 14),
  score        int         not null check (score between 0 and 20000),
  mode         text        not null check (mode in ('play','daily')),
  day          date        not null,
  correct      int         not null check (correct >= 0),
  missed       int         not null check (missed >= 0),
  best_streak  int         not null check (best_streak >= 0),
  created_at   timestamptz not null default now()
);
create index scores_player_created_idx on public.scores (player_id, created_at desc);
create index scores_day_score_idx      on public.scores (day, score desc);
create index scores_score_idx          on public.scores (score desc);

alter table public.scores enable row level security;
revoke all on public.scores from anon, authenticated;
-- no policies on purpose: only the security-definer functions below touch the table

create or replace function public.submit_score(
  p_player uuid, p_name text, p_score int, p_mode text, p_day date,
  p_correct int, p_missed int, p_streak int
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := left(btrim(regexp_replace(coalesce(p_name,''), '[[:cntrl:]<>&"'']', '', 'g')), 14);
  if v_name = '' then v_name := 'Anon'; end if;
  if p_player is null or p_mode not in ('play','daily') then raise exception 'bad request'; end if;
  if p_score < 0 or p_score > 20000 or p_correct < 0 or p_missed < 0 or p_streak < 0 then raise exception 'bad score'; end if;
  if p_score > 800 * p_correct then raise exception 'implausible score'; end if;
  if p_day is null or abs(p_day - (now() at time zone 'utc')::date) > 1 then raise exception 'bad day'; end if;
  if exists (select 1 from public.scores where player_id = p_player and created_at > now() - interval '15 seconds') then
    raise exception 'too fast';
  end if;
  insert into public.scores (player_id, name, score, mode, day, correct, missed, best_streak)
  values (p_player, v_name, p_score, p_mode, p_day, p_correct, p_missed, p_streak);
end $$;

create or replace function public.leaderboard(p_scope text default 'all', p_day date default null, p_limit int default 10)
returns table (name text, score int, day date)
language sql stable security definer set search_path = ''
as $$
  select t.name, t.score, t.day from (
    select distinct on (s.player_id) s.name, s.score, s.day, s.created_at
    from public.scores s
    where case p_scope
            when 'today' then s.day = p_day
            when 'daily' then s.mode = 'daily' and s.day = p_day
            else true end
    order by s.player_id, s.score desc, s.created_at
  ) t
  order by t.score desc, t.created_at
  limit least(greatest(coalesce(p_limit,10),1),50);
$$;

revoke execute on function public.submit_score(uuid,text,int,text,date,int,int,int) from public;
revoke execute on function public.leaderboard(text,date,int) from public;
grant  execute on function public.submit_score(uuid,text,int,text,date,int,int,int) to anon, authenticated;
grant  execute on function public.leaderboard(text,date,int) to anon, authenticated;
