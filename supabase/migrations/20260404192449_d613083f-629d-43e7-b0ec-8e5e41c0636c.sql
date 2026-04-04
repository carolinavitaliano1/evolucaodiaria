CREATE POLICY "Portal patient can read therapist custom questions"
ON public.intake_custom_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patient_portal_accounts ppa
    WHERE ppa.user_id = auth.uid()
      AND ppa.therapist_user_id = intake_custom_questions.user_id
      AND ppa.status = 'active'
  )
);