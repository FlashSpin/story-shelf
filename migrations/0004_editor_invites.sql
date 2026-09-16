-- Editor invites + DB membership (env SHELF_EDITOR_EMAILS remains bootstrap).
-- Tokens are stored hashed (sha256 hex); raw token is only shown once in the UI.

create table if not exists shelf_editors (
  email            text primary key,
  user_id          text,
  created_by_email text,
  created_at       timestamptz not null default now()
);

create table if not exists shelf_editor_invites (
  id                  text primary key,
  token_hash          text not null unique,
  email               text not null,
  created_by_user_id  text not null,
  created_by_email    text not null,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  used_at             timestamptz,
  used_by_user_id     text
);

create index if not exists shelf_editor_invites_email_idx
  on shelf_editor_invites (email);

create index if not exists shelf_editor_invites_expires_at_idx
  on shelf_editor_invites (expires_at);
