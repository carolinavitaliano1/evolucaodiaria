
-- 1. Adiciona vínculo de procedimento e pacote nos agendamentos
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS procedure_id uuid REFERENCES public.procedures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.clinic_packages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_procedure_id ON public.appointments(procedure_id);
CREATE INDEX IF NOT EXISTS idx_appointments_package_id ON public.appointments(package_id);

-- 2. Cria tabela de comissões por procedimento por profissional
CREATE TABLE IF NOT EXISTS public.procedure_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id uuid NOT NULL REFERENCES public.procedures(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.organization_members(id) ON DELETE CASCADE,
  commission_value numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'porcentagem' CHECK (commission_type IN ('valor_fixo','porcentagem')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (procedure_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_procedure_commissions_procedure_id ON public.procedure_commissions(procedure_id);
CREATE INDEX IF NOT EXISTS idx_procedure_commissions_member_id ON public.procedure_commissions(member_id);

ALTER TABLE public.procedure_commissions ENABLE ROW LEVEL SECURITY;

-- Quem pode ver: dono da org dona da clínica do procedimento, ou membro ativo dessa org
CREATE POLICY "View procedure commissions of own org"
ON public.procedure_commissions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.procedures p
    JOIN public.clinics c ON c.id = p.clinic_id
    WHERE p.id = procedure_commissions.procedure_id
      AND (
        c.organization_id IS NULL AND c.user_id = auth.uid()
        OR (c.organization_id IS NOT NULL AND public.is_org_member(c.organization_id, auth.uid()))
      )
  )
);

CREATE POLICY "Manage procedure commissions of own clinic"
ON public.procedure_commissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.procedures p
    JOIN public.clinics c ON c.id = p.clinic_id
    WHERE p.id = procedure_commissions.procedure_id
      AND (
        c.user_id = auth.uid()
        OR (c.organization_id IS NOT NULL AND public.is_org_owner(c.organization_id, auth.uid()))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.procedures p
    JOIN public.clinics c ON c.id = p.clinic_id
    WHERE p.id = procedure_commissions.procedure_id
      AND (
        c.user_id = auth.uid()
        OR (c.organization_id IS NOT NULL AND public.is_org_owner(c.organization_id, auth.uid()))
      )
  )
);

CREATE TRIGGER update_procedure_commissions_updated_at
  BEFORE UPDATE ON public.procedure_commissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
