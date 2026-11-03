-- Sync size limits.
-- The first limits (20261103020000) measured pg_column_size(data), which is the compressed size on disk and
-- allowed only 256 KB. Brands carry the logo and creatives carry their photo as data URLs, so real rows are larger.
-- The limits below are measured on the uncompressed JSON text and sized for downscaled images:
--   brands and library items: up to 8 MB   generations (8 cards per pack): up to 2 MB
-- Still NOT VALID: existing rows are left alone, every insert and update from now on is checked.
-- Run "alter table ... validate constraint ..." after cleaning old rows, if any are bigger.

alter table public.brands        drop constraint if exists brands_data_size;
alter table public.generations   drop constraint if exists generations_data_size;
alter table public.library_items drop constraint if exists library_items_data_size;

alter table public.brands        add constraint brands_data_size        check (octet_length(data::text) <= 8388608) not valid;
alter table public.generations   add constraint generations_data_size   check (octet_length(data::text) <= 2097152) not valid;
alter table public.library_items add constraint library_items_data_size check (octet_length(data::text) <= 8388608) not valid;
