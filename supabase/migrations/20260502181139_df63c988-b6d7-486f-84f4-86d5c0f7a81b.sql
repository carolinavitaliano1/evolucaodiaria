-- Tabela de pré-confirmações de presença
CREATE TABLE public.attendance_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  date DATE NOT NULL,
  confirmed_by_user_id UUID NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT attendance_confirmations_unique UNIQUE (patient_id, clinic_id, date)
);

CREATE INDEX idx_attendance_confirmations_lookup
  ON public.attendance_confirmations (clinic_id, date);

ALTER TABLE public.attendance_confirmations ENABLE ROW LEVEL SECURITY;

-- Dono da clínica gerencia
CREATE POLICY "Clinic owner manages attendance confirmations"
ON public.attendance_confirmations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = attendance_confirmations.clinic_id
      AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clinics c
    WHERE c.id = attendance_confirmations.clinic_id
      AND c.user_id = auth.uid()
  )
);

-- Org members podem ler/inserir/excluir confirmações em clínicas compartilhadas
CREATE POLICY "Org members view shared clinic confirmations"
ON public.attendance_confirmations
FOR SELECT
TO authenticated
USING (
  public.is_clinic_org_member(clinic_id, auth.uid())
  OR public.is_clinic_org_owner(clinic_id, auth.uid())
);

CREATE POLICY "Org members insert shared clinic confirmations"
ON public.attendance_confirmations
FOR INSERT
TO authenticated
WITH CHECK (
  confirmed_by_user_id = auth.uid()
  AND (
    public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  )
);

CREATE POLICY "Org members delete shared clinic confirmations"
ON public.attendance_confirmations
FOR DELETE
TO authenticated
USING (
  confirmed_by_user_id = auth.uid()
  OR public.is_clinic_org_owner(clinic_id, auth.uid())
);