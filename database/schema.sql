begin;

create table if not exists kozu_city_posts (
  id bigint generated always as identity primary key,
  region_id text not null,
  body text not null,
  import_key text unique,
  created_at timestamptz not null default now(),
  constraint kozu_city_posts_region_id_check
    check (region_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint kozu_city_posts_body_check
    check (char_length(btrim(body)) between 1 and 1000)
);

create index if not exists kozu_city_posts_region_created_idx
  on kozu_city_posts (region_id, created_at desc, id desc);

create table if not exists kozu_store_memos (
  region_id text not null,
  store_id text not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (region_id, store_id),
  constraint kozu_store_memos_region_id_check
    check (region_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint kozu_store_memos_store_id_check
    check (store_id ~ '^[A-Za-z0-9._:-]{1,180}$'),
  constraint kozu_store_memos_body_check
    check (char_length(btrim(body)) between 1 and 2000)
);

create table if not exists kozu_favorites (
  region_id text not null,
  store_id text not null,
  created_at timestamptz not null default now(),
  primary key (region_id, store_id),
  constraint kozu_favorites_region_id_check
    check (region_id ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint kozu_favorites_store_id_check
    check (store_id ~ '^[A-Za-z0-9._:-]{1,180}$')
);

commit;
