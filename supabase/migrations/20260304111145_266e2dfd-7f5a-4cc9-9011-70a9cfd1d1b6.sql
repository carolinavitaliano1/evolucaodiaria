-- Tabela de organizações (clínicas multidisciplinares)
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de membros da organização
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'professional' CHECK (role IN ('owner', 'admin', 'professional')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'inactive')),
  invited_by UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, email)
);

-- Vincular clínicas existentes a organizações (opt-in)
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- RLS para organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Função security definer para verificar membership sem recursão
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id AND owner_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.get_user_org_role(_org_id UUID, _user_id UUID)
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.organization_members
  WHERE organization_id = _org_id AND user_id = _user_id AND status = 'active' LIMIT 1;
$$;

-- Policies para organizations
CREATE POLICY "Owners and members can view their organization"
  ON public.organizations FOR SELECT
  USING (owner_id = auth.uid() OR public.is_org_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their organization"
  ON public.organizations FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete their organization"
  ON public.organizations FOR DELETE USING (owner_id = auth.uid());

-- RLS para organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and owners can view org members"
  ON public.organization_members FOR SELECT
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.is_org_member(organization_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners and admins can invite members"
  ON public.organization_members FOR INSERT
  WITH CHECK (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

CREATE POLICY "Owners and admins can update members"
  ON public.organization_members FOR UPDATE
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners and admins can remove members"
  ON public.organization_members FOR DELETE
  USING (
    public.is_org_owner(organization_id, auth.uid())
    OR public.get_user_org_role(organization_id, auth.uid()) = 'admin'
  );

-- Triggers de updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();