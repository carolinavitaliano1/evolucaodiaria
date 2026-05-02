CREATE TABLE IF NOT EXISTS public.patient_package_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  package_id uuid,
  decision text NOT NULL CHECK (decision IN ('renewed','declined')),
  sessions_used_in_cycle integer DEFAULT 0,
  session_limit integer,
  cycle_started_at timestamptz,
  decided_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ppr_patient ON public.patient_package_renewals(patient_id, created_at DESC);

ALTER TABLE public.patient_package_renewals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view renewal history"
ON public.patient_package_renewals
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_package_renewals.patient_id
      AND (
        p.user_id = auth.uid()
        OR is_clinic_org_member(p.clinic_id, auth.uid())
        OR is_clinic_org_owner(p.clinic_id, auth.uid())
      )
  )
);

CREATE POLICY "Authenticated users can insert renewal records"
ON public.patient_package_renewals
FOR INSERT
WITH CHECK (
  auth.uid() = decided_by
  AND EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_package_renewals.patient_id
      AND (
        p.user_id = auth.uid()
        OR is_clinic_org_member(p.clinic_id, auth.uid())
        OR is_clinic_org_owner(p.clinic_id, auth.uid())
      )
  )
);