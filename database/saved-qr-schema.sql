create table if not exists saved_qr_codes (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  payload jsonb not null,
  preview_svg text not null,
  preview_width double precision not null,
  preview_height double precision not null,
  status text not null default 'draft' check (status in ('draft', 'purchased')),
  tags text[] not null default '{}'::text[],
  pdf_purchase_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_qr_codes_user_id_idx on saved_qr_codes(user_id, updated_at desc);
create index if not exists saved_qr_codes_status_idx on saved_qr_codes(user_id, status, updated_at desc);
create index if not exists saved_qr_codes_tags_idx on saved_qr_codes using gin(tags);
create unique index if not exists saved_qr_codes_pdf_purchase_id_idx on saved_qr_codes(pdf_purchase_id) where pdf_purchase_id is not null;
