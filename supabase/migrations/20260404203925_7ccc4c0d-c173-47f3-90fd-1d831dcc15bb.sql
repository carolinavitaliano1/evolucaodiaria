
-- Therapeutic Groups
CREATE TABLE public.therapeutic_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  therapeutic_focus text,
  objectives text,
  support_reason text,
  shared_goals text,
  communication_patterns text,
  conflict_areas text,
  meeting_frequency text,
  duration_minutes integer,
  meeting_format text,
  facilitation_style text,
  open_to_new boolean NOT NULL DEFAULT false,
  max_participants integer,
  waitlist_policy text,
  follow_up_plan text,
  entry_criteria text,
  exclusion_criteria text,
  confidentiality_agreement text,
  group_rules text,
  materials text,
  support_resources text,
  assessment_method text,
  next_topics text,
  facilitation_notes text,
  supervision_notes text,
  general_notes text,
  session_link text,
  default_price numeric,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Therapeutic Group Members
CREATE TABLE public.therapeutic_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.therapeutic_groups(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'active'
);

-- Enable RLS
ALTER TABLE public.therapeutic_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.therapeutic_group_members ENABLE ROW LEVEL SECURITY;

-- RLS for therapeutic_groups
CREATE POLICY "Owner can manage therapeutic groups"
  ON public.therapeutic_groups FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members can view therapeutic groups"
  ON public.therapeutic_groups FOR SELECT TO authenticated
  USING (is_clinic_org_member(clinic_id, auth.uid()) OR is_clinic_org_owner(clinic_id, auth.uid()));

-- RLS for therapeutic_group_members (via group ownership)
CREATE POLICY "Owner can manage group members"
  ON public.therapeutic_group_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapeutic_groups tg WHERE tg.id = group_id AND tg.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.therapeutic_groups tg WHERE tg.id = group_id AND tg.user_id = auth.uid()));

CREATE POLICY "Org members can view group members"
  ON public.therapeutic_group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.therapeutic_groups tg WHERE tg.id = group_id AND (is_clinic_org_member(tg.clinic_id, auth.uid()) OR is_clinic_org_owner(tg.clinic_id, auth.uid()))));

-- Triggers for updated_at
CREATE TRIGGER update_therapeutic_groups_updated_at
  BEFORE UPDATE ON public.therapeutic_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
