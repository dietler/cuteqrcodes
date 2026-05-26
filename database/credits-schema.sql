create table if not exists user_credit_balances (
  user_id text primary key references "user"(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists purchased_pdfs (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  template_id text not null,
  template_label text not null,
  qr_title text not null,
  storage_key text not null unique,
  size_bytes integer not null check (size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists purchased_pdfs_user_id_idx on purchased_pdfs(user_id, created_at desc);

create table if not exists credit_transactions (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  type text not null check (type in ('credit_purchase', 'pdf_purchase')),
  credits integer not null check (credits <> 0),
  balance_after integer not null check (balance_after >= 0),
  description text not null,
  lemon_squeezy_order_id text unique,
  lemon_squeezy_variant_id text,
  pdf_purchase_id text references purchased_pdfs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx on credit_transactions(user_id, created_at desc);

