
-- Allow portal patients to read their own evolution feedbacks
CREATE POLICY "Portal patient can read own evolution feedbacks"
  ON public.evolution_feedbacks
  FOR SELECT
  TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));
