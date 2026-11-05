-- AI health: short provider message next to error_code (e.g. "Cloudflare 429 (3040): limite momentâneo do Workers AI ...").
-- The app sanitizes it (one line, at most 200 chars, no URLs or token-like strings) and keeps working without this column:
-- until the migration runs, rows are stored without it.
alter table public.ai_events add column if not exists error_detail text check (error_detail is null or char_length(error_detail) <= 200);
