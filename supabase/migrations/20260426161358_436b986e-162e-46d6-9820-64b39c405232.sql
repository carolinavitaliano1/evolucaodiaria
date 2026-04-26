
-- Create patient_schedule_slots table for multi-therapist patient schedules in clinic-type units
CREATE TABLE public.patient_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  organization_id uuid,
  member_id uuid NOT NULL,
  weekday text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  package_link_id uuid,
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pss_patient ON public.patient_schedule_slots(patient_id);
CREATE INDEX idx_pss_clinic_weekday ON public.patient_schedule_slots(clinic_id, weekday);
CREATE INDEX idx_pss_member ON public.patient_schedule_slots(member_id);

ALTER TABLE public.patient_schedule_slots ENABLE ROW LEVEL SECURITY;

-- Owners and admins of the organization can do everything
CREATE POLICY "Org owners/admins manage schedule slots"
ON public.patient_schedule_slots
FOR ALL
TO authenticated
USING (
  auth.uid() = created_by
  OR (organization_id IS NOT NULL AND (
    is_org_owner(organization_id, auth.uid())
    OR get_user_org_role(organization_id, auth.uid()) = 'admin'
  ))
)
WITH CHECK (
  auth.uid() = created_by
  OR (organization_id IS NOT NULL AND (
    is_org_owner(organization_id, auth.uid())
    OR get_user_org_role(organization_id, auth.uid()) = 'admin'
  ))
);

-- Therapists assigned to the slot can view their own slots
CREATE POLICY "Therapists view own schedule slots"
ON public.patient_schedule_slots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.id = patient_schedule_slots.member_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

-- Org members can also view all slots in the same organization (for clinic agenda)
CREATE POLICY "Org members view org schedule slots"
ON public.patient_schedule_slots
FOR SELECT
TO authenticated
USING (
  organization_id IS NOT NULL AND is_org_member(organization_id, auth.uid())
);

CREATE TRIGGER update_patient_schedule_slots_updated_at
BEFORE UPDATE ON public.patient_schedule_slots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
