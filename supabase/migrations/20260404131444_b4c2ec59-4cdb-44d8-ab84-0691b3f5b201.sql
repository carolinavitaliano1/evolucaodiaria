CREATE POLICY "Portal patient can read own clinic info"
ON public.clinics
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM patient_portal_accounts ppa
    JOIN patients p ON p.id = ppa.patient_id
    WHERE ppa.user_id = auth.uid()
      AND ppa.status = 'active'
      AND p.clinic_id = clinics.id
  )
);