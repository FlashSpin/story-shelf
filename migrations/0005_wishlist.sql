-- Gift-idea wishlist: titles not yet owned. Separate from the owned `books`
-- shelf. Rows are unowned (no user_id): guests may browse; only editors mutate.
-- Do not store personal names or private notes beyond a short gift hint.

create table if not exists wishlist_items (
  id              serial primary key,
  title           text not null,
  authors         text not null default '',
  isbn            text,
  cover_url       text,
  publisher       text,
  published_year  text,
  page_count      integer,
  description     text,
  notes           text,
  added_at        timestamptz not null default now()
);

create unique index if not exists wishlist_items_isbn_unique
  on wishlist_items (isbn)
  where isbn is not null;

create index if not exists wishlist_items_added_at_idx
  on wishlist_items (added_at desc);
