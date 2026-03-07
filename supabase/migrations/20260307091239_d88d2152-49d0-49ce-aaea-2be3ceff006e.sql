
-- Create therapist_patient_assignments table
CREATE TABLE public.therapist_patient_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  schedule_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, patient_id)
);

ALTER TABLE public.therapist_patient_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org owners and admins can manage assignments"
  ON public.therapist_patient_assignments
  FOR ALL
  USING (
    is_org_owner(organization_id, auth.uid())
    OR get_user_org_role(organization_id, auth.uid()) = 'admin'
  )
  WITH CHECK (
    is_org_owner(organization_id, auth.uid())
    OR get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Members can view their own assignments"
  ON public.therapist_patient_assignments
  FOR SELECT
  USING (
    is_org_owner(organization_id, auth.uid())
    OR is_org_member(organization_id, auth.uid())
  );

CREATE TRIGGER update_therapist_patient_assignments_updated_at
  BEFORE UPDATE ON public.therapist_patient_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_therapist_assigned_to_patient(_patient_id UUID, _user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.therapist_patient_assignments tpa
    JOIN public.organization_members om ON om.id = tpa.member_id
    WHERE tpa.patient_id = _patient_id
      AND om.user_id = _user_id
      AND om.status = 'active'
  );
$$;
