-- =====================================================================
-- 004: Storage bucket for product photos. Run once, any time after 001.
-- The bucket is PUBLIC for reading (the store shows the photos to everyone) but nothing
-- in the browser can write to it: uploads happen only through the import-product-images
-- edge function, which uses the service role inside Supabase.
-- PNG only, 5 MB max per file.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/png'])
on conflict (id) do nothing;
