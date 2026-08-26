-- Migration: Fix the assets Storage policies from 00009 — they matched
-- public.users.id = auth.uid(), but this app's public.users rows (seeded via
-- the CSV admin-import script) use IDs independent of Supabase Auth's own
-- auth.users.id. The backend's own auth check (authMiddleware.ts requireAdmin)
-- already knows this and looks admins up by EMAIL, not ID. Verified via a real
-- minted admin session: auth.uid() never matched public.users.id for an actual
-- admin account, so the INSERT/UPDATE/DELETE policies from 00009 never passed
-- for anyone, despite existing correctly in pg_policies.

DROP POLICY IF EXISTS "Admins can upload challenge assets" ON storage.objects;
CREATE POLICY "Admins can upload challenge assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD')
);

DROP POLICY IF EXISTS "Admins can overwrite challenge assets" ON storage.objects;
CREATE POLICY "Admins can overwrite challenge assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD')
)
WITH CHECK (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD')
);

DROP POLICY IF EXISTS "Admins can delete challenge assets" ON storage.objects;
CREATE POLICY "Admins can delete challenge assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assets'
  AND (SELECT role FROM public.users WHERE email = auth.email()) IN ('admin', 'GOD')
);
