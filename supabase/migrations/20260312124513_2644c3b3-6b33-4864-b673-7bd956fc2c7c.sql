
-- Allow portal patients to update their own basic information
-- This is needed so intake form submissions can sync back to the patients table
CREATE POLICY "Portal patient can update own basic data"
  ON public.patients
  FOR UPDATE
  TO authenticated
  USING (is_portal_patient(id, auth.uid()))
  WITH CHECK (is_portal_patient(id, auth.uid()));
