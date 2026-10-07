-- 462 — every listing photo carries a caption saying what it shows (applied October 2026)
-- properties.photo_labels: a JSON list of captions in the SAME ORDER as properties.photos ("Master bedroom — Ceiling").
-- Existing listings keep an empty list (photos show without captions); new listings are required to supply them.
-- The listing form's photo checklist is now built from the property itself (lib/photoChecklist.ts): it grows with the
-- bedrooms, bathrooms and toilets declared — a 3-bed / 3-bath house needs 39 named photographs (walls, ceiling and floor of
-- every room; WC, basin, walls/ceiling and floor of every bathroom; the roof; meter and water) instead of 10 generic ones.
alter table properties add column if not exists photo_labels jsonb not null default '[]'::jsonb;
