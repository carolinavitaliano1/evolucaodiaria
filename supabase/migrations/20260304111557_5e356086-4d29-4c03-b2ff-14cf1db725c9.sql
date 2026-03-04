-- =====================================================
-- FASE 2: Compartilhamento de dados dentro de organização
-- =====================================================

-- Função para verificar se o usuário é membro de uma organização
-- que está vinculada a uma clínica específica
CREATE OR REPLACE FUNCTION public.is_clinic_org_member(_clinic_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinics c
    JOIN public.organization_members om ON om.organization_id = c.organization_id
    WHERE c.id = _clinic_id
      AND om.user_id = _user_id
      AND om.status = 'active'
      AND c.organization_id IS NOT NULL
  );
$$;

-- Função para verificar se o usuário é dono da org vinculada à clínica
CREATE OR REPLACE FUNCTION public.is_clinic_org_owner(_clinic_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clinics c
    JOIN public.organizations o ON o.id = c.organization_id
    WHERE c.id = _clinic_id
      AND o.owner_id = _user_id
      AND c.organization_id IS NOT NULL
  );
$$;

-- =====================================================
-- Pacientes: membros da org podem ver pacientes da clínica
-- =====================================================

-- Adicionar política para membros da org
CREATE POLICY "Org members can view shared clinic patients"
  ON public.patients FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

-- Membros ativos podem criar pacientes na clínica da org
CREATE POLICY "Org members can create patients in shared clinics"
  ON public.patients FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      NOT public.is_clinic_org_member(clinic_id, auth.uid())  -- solo: só verifica user_id
      OR public.is_clinic_org_member(clinic_id, auth.uid())   -- membro: pode inserir
      OR public.is_clinic_org_owner(clinic_id, auth.uid())
    )
  );

-- Membros ativos podem editar pacientes da clínica
CREATE POLICY "Org members can update patients in shared clinics"
  ON public.patients FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

-- =====================================================
-- Evoluções: membros da org podem ver evoluções da clínica
-- =====================================================

CREATE POLICY "Org members can view shared clinic evolutions"
  ON public.evolutions FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

-- Membros podem criar evoluções na clínica da org (com seu próprio user_id)
CREATE POLICY "Org members can create evolutions in shared clinics"
  ON public.evolutions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_clinic_org_member(clinic_id, auth.uid())
      OR public.is_clinic_org_owner(clinic_id, auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM public.clinics c
        WHERE c.id = clinic_id AND c.organization_id IS NOT NULL
      )
    )
  );

-- Membros podem editar apenas suas próprias evoluções; dono/admin pode editar todas
CREATE POLICY "Org members can update their evolutions in shared clinics"
  ON public.evolutions FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

-- =====================================================
-- Appointments: membros podem ver appointments da clínica
-- =====================================================

CREATE POLICY "Org members can view shared clinic appointments"
  ON public.appointments FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_clinic_org_member(clinic_id, auth.uid())
    OR public.is_clinic_org_owner(clinic_id, auth.uid())
  );

-- =====================================================
-- Clinics: membros podem ver clínicas da sua org
-- =====================================================

CREATE POLICY "Org members can view shared clinics"
  ON public.clinics FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_org_member(organization_id, auth.uid())
    OR (organization_id IS NOT NULL AND public.is_org_owner(organization_id, auth.uid()))
  );