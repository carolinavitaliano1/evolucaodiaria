-- 1. Tabela de planos de remuneração por membro
CREATE TABLE public.member_remuneration_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Plano Padrão',
  remuneration_type TEXT NOT NULL DEFAULT 'por_sessao',
  remuneration_value NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_member_remuneration_plans_member_id ON public.member_remuneration_plans(member_id);

ALTER TABLE public.member_remuneration_plans ENABLE ROW LEVEL SECURITY;

-- Donos/admins da organização gerenciam planos dos membros
CREATE POLICY "Org owners and admins manage member remuneration plans"
ON public.member_remuneration_plans
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.id = member_remuneration_plans.member_id
      AND (
        public.is_org_owner(om.organization_id, auth.uid())
        OR public.get_user_org_role(om.organization_id, auth.uid()) = 'admin'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.id = member_remuneration_plans.member_id
      AND (
        public.is_org_owner(om.organization_id, auth.uid())
        OR public.get_user_org_role(om.organization_id, auth.uid()) = 'admin'
      )
  )
);

-- O próprio membro pode visualizar seus planos
CREATE POLICY "Members can view own remuneration plans"
ON public.member_remuneration_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.id = member_remuneration_plans.member_id
      AND om.user_id = auth.uid()
  )
);

CREATE TRIGGER trg_member_remuneration_plans_updated_at
BEFORE UPDATE ON public.member_remuneration_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Coluna no vínculo terapeuta-paciente
ALTER TABLE public.therapist_patient_assignments
ADD COLUMN IF NOT EXISTS remuneration_plan_id UUID REFERENCES public.member_remuneration_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tpa_remuneration_plan_id ON public.therapist_patient_assignments(remuneration_plan_id);

-- 3. Migração de dados: cria um "Plano Padrão" para cada membro que já tem remuneração configurada
INSERT INTO public.member_remuneration_plans (member_id, name, remuneration_type, remuneration_value, is_default)
SELECT
  om.id,
  CASE
    WHEN om.remuneration_type = 'por_sessao' THEN 'Por Sessão'
    WHEN om.remuneration_type = 'fixo_mensal' THEN 'Fixo Mensal'
    WHEN om.remuneration_type = 'fixo_dia' THEN 'Fixo Diário'
    ELSE 'Plano Padrão'
  END,
  COALESCE(om.remuneration_type, 'por_sessao'),
  COALESCE(om.remuneration_value, 0),
  true
FROM public.organization_members om
WHERE om.remuneration_type IS NOT NULL
  AND om.remuneration_type <> 'definir_depois'
  AND om.remuneration_value IS NOT NULL
  AND om.remuneration_value > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.member_remuneration_plans p WHERE p.member_id = om.id
  );