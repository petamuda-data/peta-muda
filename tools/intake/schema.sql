-- Peta MUDA intake queue (private Supabase project).
-- Apply once in the Supabase SQL editor (or via MCP apply_migration), then:
--   1. Set the passphrase (bottom of this file — replace REPLACE_WITH_PASSPHRASE).
--   2. Put the project URL + publishable/anon key in site/ops-config.js.
--   3. Add SUPABASE_URL / SUPABASE_ANON_KEY / INTAKE_PASS as GitHub Actions
--      secrets on petamuda-data/peta-muda.
--
-- Security model: RLS is enabled with NO policies, so the anon key cannot
-- touch the tables directly. All access goes through the three SECURITY
-- DEFINER RPCs below, each of which first checks the shared passphrase
-- against a bcrypt hash. Rotating the passphrase = re-running the last insert.

create extension if not exists pgcrypto;

create table if not exists intake (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('ground', 'news')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'published')),
  text_bm text not null,
  text_en text,
  receipt text,
  seat_codes text[] not null default '{}',
  theme text,
  source_url text,
  source_name text,
  url_hash text unique,
  approved_at timestamptz
);
alter table intake enable row level security;
revoke all on table intake from anon, authenticated;

create table if not exists intake_config (
  id int primary key default 1,
  pass_hash text not null
);
alter table intake_config enable row level security;
revoke all on table intake_config from anon, authenticated;

create or replace function intake_check_pass(p_pass text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_pass is null or not exists (
    select 1 from intake_config where pass_hash = crypt(p_pass, pass_hash)
  ) then
    raise exception 'unauthorised';
  end if;
end $$;

create or replace function intake_submit(
  p_pass text,
  p_kind text,
  p_text_bm text,
  p_text_en text default null,
  p_receipt text default null,
  p_seat_codes text[] default '{}',
  p_theme text default null,
  p_source_url text default null,
  p_source_name text default null,
  p_url_hash text default null,
  p_status text default 'draft'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform intake_check_pass(p_pass);
  insert into intake (kind, status, text_bm, text_en, receipt, seat_codes, theme, source_url, source_name, url_hash, approved_at)
  values (p_kind, p_status, p_text_bm, p_text_en, p_receipt, coalesce(p_seat_codes, '{}'), p_theme, p_source_url, p_source_name, p_url_hash,
          case when p_status = 'approved' then now() end)
  on conflict (url_hash) do nothing
  returning id into v_id;
  return v_id; -- null = duplicate url_hash, not inserted
end $$;

create or replace function intake_list(p_pass text, p_status text default 'draft')
returns setof intake
language plpgsql security definer set search_path = public as $$
begin
  perform intake_check_pass(p_pass);
  return query select * from intake where status = p_status order by created_at desc limit 200;
end $$;

create or replace function intake_set_status(
  p_pass text,
  p_id uuid,
  p_status text,
  p_theme text default null,
  p_seat_codes text[] default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform intake_check_pass(p_pass);
  update intake set
    status = p_status,
    theme = coalesce(p_theme, theme),
    seat_codes = coalesce(p_seat_codes, seat_codes),
    approved_at = case when p_status = 'approved' then now() else approved_at end
  where id = p_id;
end $$;

revoke all on function intake_check_pass(text) from public, anon, authenticated;
grant execute on function intake_submit(text, text, text, text, text, text[], text, text, text, text, text) to anon;
grant execute on function intake_list(text, text) to anon;
grant execute on function intake_set_status(text, uuid, text, text, text[]) to anon;

-- Set/rotate the shared admin passphrase (long random string; share over WhatsApp):
insert into intake_config (id, pass_hash)
values (1, crypt('REPLACE_WITH_PASSPHRASE', gen_salt('bf')))
on conflict (id) do update set pass_hash = excluded.pass_hash;
