
-- Allow anonymous (unauthenticated) users to read clinic name/address
-- needed for the public enrollment page /matricula/:clinicId
CREATE POLICY "Public can read clinic info for enrollment"
ON public.clinics
FOR SELECT
TO anon
USING (is_archived IS DISTINCT FROM true);
