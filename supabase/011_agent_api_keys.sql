-- 011: demo API keys for the public agent API (supabase/functions/api, docs/API.md). Run ONCE after 010. Additive only.
-- One row per registered external agent. The key itself is never stored, only its SHA-256 ('sha256:' + hex).
-- Hackathon only: demo-issued keys, not a production credential. Production would use registered public keys and
-- signature verification (not built).
-- No browser access at all: RLS on, no policies, and anon / authenticated have no grants. Only the api edge function
-- (service role) reads or writes it.
create table if not exists api_agents (
  id text primary key,                       -- agent_id, e.g. ext-my-agent-1a2b3c4d (also written to sessions.agent_id / grants.agent_id)
  agent_name text not null check (char_length(agent_name) between 1 and 80),
  key_hash sha256_hash not null unique,
  created_at timestamptz not null default now()
);

alter table api_agents enable row level security;
revoke all on api_agents from anon, authenticated;
