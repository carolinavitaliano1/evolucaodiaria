
-- Add toggle to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS applications_link_enabled boolean NOT NULL DEFAULT true;

-- Create team_applications table
CREATE TABLE IF NOT EXISTS public.team_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  specialty text,
  professional_id text,
  message text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid
);

CREATE INDEX IF NOT EXISTS idx_team_applications_org ON public.team_applications(organization_id, status);

ALTER TABLE public.team_applications ENABLE ROW LEVEL SECURITY;

-- Anon can insert only if link is enabled for that organization
CREATE POLICY "Anon can submit team applications"
  ON public.team_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND o.applications_link_enabled = true
    )
  );

-- Owners and admins can view applications
CREATE POLICY "Owners and admins view applications"
  ON public.team_applications
  FOR SELECT
  TO authenticated
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

-- Owners and admins can update applications
CREATE POLICY "Owners and admins update applications"
  ON public.team_applications
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

-- Owners and admins can delete applications
CREATE POLICY "Owners and admins delete applications"
  ON public.team_applications
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

-- Trigger for updated_at
CREATE TRIGGER update_team_applications_updated_at
  BEFORE UPDATE ON public.team_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Public function to fetch organization name for the public form (without exposing all org data)
CREATE OR REPLACE FUNCTION public.get_organization_for_application(_org_id uuid)
RETURNS TABLE(id uuid, name text, applications_link_enabled boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT o.id, o.name, o.applications_link_enabled
  FROM public.organizations o
  WHERE o.id = _org_id;
$$;
