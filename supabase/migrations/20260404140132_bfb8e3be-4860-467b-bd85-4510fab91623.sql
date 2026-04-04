
DROP POLICY IF EXISTS "Public can read clinic info for enrollment" ON public.clinics;
CREATE POLICY "Public can read clinic info for enrollment"
ON public.clinics FOR SELECT
TO anon, authenticated
USING (is_archived IS DISTINCT FROM true);
