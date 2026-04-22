
-- Health plans (convênios) per clinic
CREATE TABLE public.health_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  name text NOT NULL,
  ans_registry text,
  phone text,
  reimbursement_value numeric DEFAULT 0,
  reimbursement_type text DEFAULT 'por_sessao',
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.health_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own health plans"
ON public.health_plans FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Org members view shared health plans"
ON public.health_plans FOR SELECT TO authenticated
USING (is_clinic_org_member(clinic_id, auth.uid()) OR is_clinic_org_owner(clinic_id, auth.uid()));

CREATE TRIGGER set_health_plans_updated_at
BEFORE UPDATE ON public.health_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Patient link to a health plan + per-patient details
ALTER TABLE public.patients
  ADD COLUMN health_plan_id uuid REFERENCES public.health_plans(id) ON DELETE SET NULL,
  ADD COLUMN health_plan_card_number text,
  ADD COLUMN health_plan_authorized_sessions integer,
  ADD COLUMN health_plan_authorization_expires_at date;

CREATE INDEX idx_patients_health_plan_id ON public.patients(health_plan_id);
CREATE INDEX idx_health_plans_clinic_id ON public.health_plans(clinic_id);
