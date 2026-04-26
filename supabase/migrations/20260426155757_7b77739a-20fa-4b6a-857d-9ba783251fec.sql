CREATE TABLE public.patient_packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES public.clinic_packages(id) ON DELETE CASCADE,
  member_id UUID REFERENCES public.organization_members(id) ON DELETE SET NULL,
  therapist_user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_packages_patient ON public.patient_packages(patient_id);
CREATE INDEX idx_patient_packages_member ON public.patient_packages(member_id);
CREATE INDEX idx_patient_packages_therapist_user ON public.patient_packages(therapist_user_id);

ALTER TABLE public.patient_packages ENABLE ROW LEVEL SECURITY;

-- Patient owner manages
CREATE POLICY "Patient owner manages patient packages"
ON public.patient_packages
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_packages.patient_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_packages.patient_id AND p.user_id = auth.uid()
  )
);

-- Org owners and admins manage
CREATE POLICY "Org owners and admins manage patient packages"
ON public.patient_packages
FOR ALL
TO authenticated
USING (
  organization_id IS NOT NULL AND (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  )
)
WITH CHECK (
  organization_id IS NOT NULL AND (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  )
);

-- Org members can view
CREATE POLICY "Org members view patient packages"
ON public.patient_packages
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid())
);

-- The therapist linked to the package can view (even if no admin)
CREATE POLICY "Linked therapist views own patient packages"
ON public.patient_packages
FOR SELECT
TO authenticated
USING (
  therapist_user_id = auth.uid()
);

CREATE TRIGGER update_patient_packages_updated_at
BEFORE UPDATE ON public.patient_packages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();