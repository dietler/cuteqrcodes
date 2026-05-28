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
