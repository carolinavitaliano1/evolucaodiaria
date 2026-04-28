-- Add new financial/commission columns to clinic_packages
ALTER TABLE public.clinic_packages
  ADD COLUMN IF NOT EXISTS lancamento_tipo text NOT NULL DEFAULT 'valor_total',
  ADD COLUMN IF NOT EXISTS valor_total numeric,
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS commission_payment_method text NOT NULL DEFAULT 'sem_comissao',
  ADD COLUMN IF NOT EXISTS commission_type text NOT NULL DEFAULT 'valor_fixo',
  ADD COLUMN IF NOT EXISTS commission_per_professional boolean NOT NULL DEFAULT false;

-- Create auxiliary table for per-professional commissions
CREATE TABLE IF NOT EXISTS public.package_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.clinic_packages(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  commission_value numeric NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'valor_fixo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_package_commissions_package_id ON public.package_commissions(package_id);
CREATE INDEX IF NOT EXISTS idx_package_commissions_member_id ON public.package_commissions(member_id);

ALTER TABLE public.package_commissions ENABLE ROW LEVEL SECURITY;

-- Owner of the package can fully manage its commissions
CREATE POLICY "Package owner manages commissions"
ON public.package_commissions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinic_packages cp
    WHERE cp.id = package_commissions.package_id
      AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clinic_packages cp
    WHERE cp.id = package_commissions.package_id
      AND cp.user_id = auth.uid()
  )
);

-- Org members can view commissions of shared clinic packages
CREATE POLICY "Org members view package commissions"
ON public.package_commissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinic_packages cp
    WHERE cp.id = package_commissions.package_id
      AND (
        public.is_clinic_org_member(cp.clinic_id, auth.uid())
        OR public.is_clinic_org_owner(cp.clinic_id, auth.uid())
      )
  )
);

-- updated_at trigger
DROP TRIGGER IF EXISTS update_package_commissions_updated_at ON public.package_commissions;
CREATE TRIGGER update_package_commissions_updated_at
BEFORE UPDATE ON public.package_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();