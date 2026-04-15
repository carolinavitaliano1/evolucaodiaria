
CREATE POLICY "Portal patient can read own package"
ON public.clinic_packages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.patient_portal_accounts ppa ON ppa.patient_id = p.id
    WHERE p.package_id = clinic_packages.id
      AND ppa.user_id = auth.uid()
      AND ppa.status = 'active'
  )
);
