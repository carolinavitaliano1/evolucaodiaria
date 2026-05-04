CREATE TABLE public.procedures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  clinic_id UUID NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  commission_type TEXT NOT NULL DEFAULT 'valor_fixo',
  commission_value NUMERIC NOT NULL DEFAULT 0,
  tuss_code TEXT,
  health_plans JSONB NOT NULL DEFAULT '[]'::jsonb,
  allow_value_change BOOLEAN NOT NULL DEFAULT false,
  apply_to_all_professionals BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.procedures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own procedures"
ON public.procedures FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Org members can view shared clinic procedures"
ON public.procedures FOR SELECT
USING (is_clinic_org_member(clinic_id, auth.uid()) OR is_clinic_org_owner(clinic_id, auth.uid()));

CREATE POLICY "Users can create their own procedures"
ON public.procedures FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own procedures"
ON public.procedures FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Org owners can update shared clinic procedures"
ON public.procedures FOR UPDATE
USING (is_clinic_org_owner(clinic_id, auth.uid()));

CREATE POLICY "Users can delete their own procedures"
ON public.procedures FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Org owners can delete shared clinic procedures"
ON public.procedures FOR DELETE
USING (is_clinic_org_owner(clinic_id, auth.uid()));

CREATE INDEX idx_procedures_clinic ON public.procedures(clinic_id);
CREATE INDEX idx_procedures_user ON public.procedures(user_id);

CREATE TRIGGER update_procedures_updated_at
BEFORE UPDATE ON public.procedures
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();