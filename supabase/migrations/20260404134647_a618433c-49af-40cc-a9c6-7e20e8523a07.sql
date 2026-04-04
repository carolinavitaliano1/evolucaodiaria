CREATE POLICY "Anon can update patient by intake_token"
ON public.patients
FOR UPDATE
TO anon
USING (intake_token IS NOT NULL);