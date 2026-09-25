create table if not exists public.accounts (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  created_at bigint not null,
  password_hash text not null
);

create table if not exists public.sessions (
  token_hash text primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  expires_at bigint not null
);

create table if not exists public.bills (
  id uuid primary key,
  owner_id uuid not null references public.accounts(id) on delete cascade,
  join_code text not null unique,
  created_at bigint not null,
  title text not null,
  people jsonb not null default '[]'::jsonb,
  items jsonb not null default '[]'::jsonb,
  gst_mode text not null check (gst_mode in ('inclusive', 'exclusive', 'none')),
  gst_rate numeric not null,
  tip_amount numeric not null default 0,
  service_fee_amount numeric not null default 0,
  receipt_total numeric,
  settled_person_ids jsonb not null default '[]'::jsonb,
  paid_at bigint
);

create index if not exists bills_owner_id_created_at_idx on public.bills(owner_id, created_at desc);
create index if not exists sessions_account_id_idx on public.sessions(account_id);

alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.bills enable row level security;