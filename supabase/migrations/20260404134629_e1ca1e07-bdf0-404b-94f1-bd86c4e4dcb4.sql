CREATE POLICY "Anon can read patient by intake_token"
ON public.patients
FOR SELECT
TO anon
USING (intake_token IS NOT NULL);