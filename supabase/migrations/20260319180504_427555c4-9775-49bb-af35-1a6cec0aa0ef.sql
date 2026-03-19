
-- Team member attendance records
CREATE TABLE public.team_attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'present', -- 'present' | 'absent' | 'justified'
  justification TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(member_id, date)
);

ALTER TABLE public.team_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view attendance"
  ON public.team_attendance FOR SELECT
  USING (is_org_owner(organization_id, auth.uid()) OR is_org_member(organization_id, auth.uid()));

CREATE POLICY "Org owners and admins can manage attendance"
  ON public.team_attendance FOR ALL
  USING (is_org_owner(organization_id, auth.uid()) OR get_user_org_role(organization_id, auth.uid()) = 'admin')
  WITH CHECK (is_org_owner(organization_id, auth.uid()) OR get_user_org_role(organization_id, auth.uid()) = 'admin');

CREATE TRIGGER update_team_attendance_updated_at
  BEFORE UPDATE ON public.team_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
