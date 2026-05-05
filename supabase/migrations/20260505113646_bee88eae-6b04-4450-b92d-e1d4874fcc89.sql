-- Create team_commission_payments table for tracking paid/unpaid commission status per member/month
CREATE TABLE IF NOT EXISTS public.team_commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  member_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid')),
  total_due numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz,
  paid_by_user_id uuid,
  notes text,
  individual_payments jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, clinic_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_tcp_clinic_period ON public.team_commission_payments(clinic_id, year, month);
CREATE INDEX IF NOT EXISTS idx_tcp_member_period ON public.team_commission_payments(member_id, year, month);

ALTER TABLE public.team_commission_payments ENABLE ROW LEVEL SECURITY;

-- Org owners and admins fully manage commission payments
CREATE POLICY "Org owners and admins manage commission payments"
ON public.team_commission_payments
FOR ALL
TO authenticated
USING (
  is_org_owner(organization_id, auth.uid())
  OR get_user_org_role(organization_id, auth.uid()) = 'admin'
)
WITH CHECK (
  is_org_owner(organization_id, auth.uid())
  OR get_user_org_role(organization_id, auth.uid()) = 'admin'
);

-- Members can view their own commission payment records
CREATE POLICY "Members can view their own commission payments"
ON public.team_commission_payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.id = team_commission_payments.member_id
      AND om.user_id = auth.uid()
  )
);

CREATE TRIGGER update_team_commission_payments_updated_at
BEFORE UPDATE ON public.team_commission_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();