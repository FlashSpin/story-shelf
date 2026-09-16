-- Stopgap: keep HTTPS catalog covers in cover_url; store camera/upload data
-- URLs in cover_data so listBooks can omit the heavy payload.
alter table books add column if not exists cover_data text;

-- Move any legacy data-URL covers out of the list path column.
update books
set cover_data = cover_url,
    cover_url = null
where cover_url is not null
  and cover_url like 'data:image/%'
  and cover_data is null;
