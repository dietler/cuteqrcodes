create table if not exists qr_folders (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists qr_folders_user_id_idx on qr_folders(user_id);

create table if not exists saved_qr_codes (
  id text primary key,
  user_id text not null references "user"(id) on delete cascade,
  folder_id text not null references qr_folders(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  payload jsonb not null,
  preview_svg text not null,
  preview_width double precision not null,
  preview_height double precision not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists saved_qr_codes_user_id_idx on saved_qr_codes(user_id);
create index if not exists saved_qr_codes_folder_id_idx on saved_qr_codes(folder_id);
