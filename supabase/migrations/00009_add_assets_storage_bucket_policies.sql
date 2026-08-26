-- Migration: Provision the 'assets' Storage bucket and its RLS policies.
-- The admin dashboard's asset upload (handleAddAssetToChallengeDirect in
-- useAdminDashboard.js) uploads files directly to Supabase Storage from the
-- browser using the anon-key client, which is subject to Storage RLS — not
-- the backend's service-role client. No bucket or policy for this was ever
-- provisioned, so every upload failed with "new row violates row-level
-- security policy".

-- 1. Ensure the bucket exists and is public, so getPublicUrl() links work for
--    participants viewing challenge assets without needing a SELECT policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Admins/GOD can upload, overwrite (upsert:true), and delete objects here.
DROP POLICY IF EXISTS "Admins can upload challenge assets" ON storage.objects;
CREATE POLICY "Admins can upload challenge assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'GOD')
);

DROP POLICY IF EXISTS "Admins can overwrite challenge assets" ON storage.objects;
CREATE POLICY "Admins can overwrite challenge assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'GOD')
)
WITH CHECK (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'GOD')
);

DROP POLICY IF EXISTS "Admins can delete challenge assets" ON storage.objects;
CREATE POLICY "Admins can delete challenge assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'GOD')
);

-- 3. Anyone can view/download objects in this bucket (participants see these
--    assets during challenges; redundant with public=true above but kept as
--    defense-in-depth in case the bucket's public flag is ever changed).
DROP POLICY IF EXISTS "Anyone can view challenge assets" ON storage.objects;
CREATE POLICY "Anyone can view challenge assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'assets');
