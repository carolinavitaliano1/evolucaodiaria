-- Drop overly permissive "Anyone can ..." policies on the attachments bucket.
-- These allowed unauthenticated callers to upload, update, and delete files.
DROP POLICY IF EXISTS "Anyone can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete attachments" ON storage.objects;

-- Keep authenticated-only mutation policies. The existing
-- "Authenticated users can upload attachments" / "Users can update their own attachments"
-- / "Users can delete their own attachments" policies remain in place and now
-- become the only path to write into the bucket.

-- Public read is intentional: the bucket is marked public and the app uses
-- getPublicUrl() to render attachments inside PDFs, the patient portal, and
-- shared receipts. The existing "Users can view attachments" policy already
-- mirrors that public-read posture for authenticated callers.
