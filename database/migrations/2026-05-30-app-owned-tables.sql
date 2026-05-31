-- Apply this migration before deploying server code that reads/writes app-owned tables.

create table if not exists saved_qr_codes (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  payload jsonb not null,
  preview_svg text not null,
  preview_width double precision not null,
  preview_height double precision not null,
  status text not null default 'draft',
  tags text[] not null default '{}'::text[],
  pdf_purchase_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table saved_qr_codes add column if not exists status text not null default 'draft';
alter table saved_qr_codes add column if not exists tags text[] not null default '{}'::text[];
alter table saved_qr_codes add column if not exists pdf_purchase_id text unique;

do $$
begin
  alter table saved_qr_codes drop constraint if exists saved_qr_codes_folder_id_fkey;
  alter table saved_qr_codes drop constraint if exists saved_qr_codes_user_id_name_key;
  alter table saved_qr_codes drop constraint if exists saved_qr_codes_status_check;
  alter table saved_qr_codes
    add constraint saved_qr_codes_status_check
    check (status in ('draft', 'purchased'));

  if exists (
    select 1
    from information_schema.columns
    where table_name = 'saved_qr_codes'
      and column_name = 'folder_id'
  ) then
    alter table saved_qr_codes drop column folder_id;
  end if;

  drop table if exists qr_folders;
end $$;

create index if not exists saved_qr_codes_user_id_idx on saved_qr_codes(user_id, updated_at desc);
create index if not exists saved_qr_codes_status_idx on saved_qr_codes(user_id, status, updated_at desc);
create index if not exists saved_qr_codes_tags_idx on saved_qr_codes using gin(tags);
create unique index if not exists saved_qr_codes_pdf_purchase_id_idx on saved_qr_codes(pdf_purchase_id) where pdf_purchase_id is not null;

create table if not exists dynamic_qr_links (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  slug text not null unique,
  destination_url text not null,
  is_dynamic boolean not null default false,
  tracks_statistics boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dynamic_qr_links_user_id_idx on dynamic_qr_links(user_id, created_at desc);

create table if not exists dynamic_qr_scans (
  id text primary key,
  link_id text not null references dynamic_qr_links(id) on delete cascade,
  ip_address text,
  country text,
  region text,
  city text,
  latitude text,
  longitude text,
  timezone text,
  user_agent text,
  referrer text,
  scanned_at timestamptz not null default now()
);

create index if not exists dynamic_qr_scans_link_id_idx on dynamic_qr_scans(link_id, scanned_at desc);

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
  type text not null check (type in ('credit_purchase', 'pdf_purchase', 'qr_feature_purchase')),
  credits integer not null check (credits <> 0),
  balance_after integer not null check (balance_after >= 0),
  description text not null,
  lemon_squeezy_order_id text unique,
  lemon_squeezy_variant_id text,
  pdf_purchase_id text references purchased_pdfs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'credit_transactions_type_check'
      and conrelid = 'credit_transactions'::regclass
  ) then
    alter table credit_transactions drop constraint credit_transactions_type_check;
  end if;

  alter table credit_transactions
    add constraint credit_transactions_type_check
    check (type in ('credit_purchase', 'pdf_purchase', 'qr_feature_purchase'));
exception
  when duplicate_object then null;
end $$;

create index if not exists credit_transactions_user_id_idx on credit_transactions(user_id, created_at desc);
