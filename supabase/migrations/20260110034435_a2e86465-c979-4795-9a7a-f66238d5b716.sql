-- Create storage bucket for attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload files to the attachments bucket
CREATE POLICY "Anyone can upload attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'attachments');

-- Allow anyone to read files from the attachments bucket
CREATE POLICY "Anyone can read attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'attachments');

-- Allow anyone to update files in the attachments bucket
CREATE POLICY "Anyone can update attachments"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'attachments');

-- Allow anyone to delete files from the attachments bucket
CREATE POLICY "Anyone can delete attachments"
ON storage.objects
FOR DELETE
USING (bucket_id = 'attachments');