-- Fox Buddy's push relay: one row per paired Mac and iPhone. Only the relay's edge function (service role) reads or
-- writes it: row-level security is on with no policies, so the public API keys can't touch it.
create table if not exists public.foxbuddy_pairs (
  pair          text primary key,
  secret_hash   text not null,                         -- sha-256 of the pair secret; the secret itself is never stored
  env           text not null default 'production',    -- which APNs: sandbox for Xcode builds, production for TestFlight
  device_token  text,                                  -- the phone's token for alerts
  start_token   text,                                  -- its token for starting Live Activities
  activities    jsonb not null default '{}'::jsonb,    -- {"printer": token, "claude": token} for the ones showing now
  window_start  timestamptz not null default now(),    -- a simple hourly push limit
  window_count  integer not null default 0,
  created_at    timestamptz not null default now(),
  seen_at       timestamptz not null default now()
);
alter table public.foxbuddy_pairs enable row level security;
revoke all on public.foxbuddy_pairs from anon, authenticated;
