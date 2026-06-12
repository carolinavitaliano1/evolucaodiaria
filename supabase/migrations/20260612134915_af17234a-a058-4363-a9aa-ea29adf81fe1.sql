
CREATE TABLE public.patient_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  portal_account_id uuid REFERENCES public.patient_portal_accounts(id) ON DELETE SET NULL,
  mood text,
  content text,
  shared_with_therapist boolean NOT NULL DEFAULT false,
  therapist_comment text,
  therapist_commented_at timestamptz,
  therapist_commented_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_patient_diary_patient ON public.patient_diary_entries(patient_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_diary_entries TO authenticated;
GRANT ALL ON public.patient_diary_entries TO service_role;

ALTER TABLE public.patient_diary_entries ENABLE ROW LEVEL SECURITY;

-- Patient (portal user) full CRUD on own entries
CREATE POLICY "Portal patient manages own diary"
ON public.patient_diary_entries
FOR ALL
TO authenticated
USING (public.is_portal_patient(patient_id, auth.uid()))
WITH CHECK (public.is_portal_patient(patient_id, auth.uid()));

-- Therapist owner sees all entries (UI/RPC masks content when not shared)
CREATE POLICY "Therapist owner reads patient diary"
ON public.patient_diary_entries
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_diary_entries.patient_id
      AND (
        p.user_id = auth.uid()
        OR public.is_clinic_org_member(p.clinic_id, auth.uid())
        OR public.is_clinic_org_owner(p.clinic_id, auth.uid())
      )
  )
);

-- Therapist owner can update only comment fields (enforced by trigger below)
CREATE POLICY "Therapist owner comments on diary"
ON public.patient_diary_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_diary_entries.patient_id
      AND (
        p.user_id = auth.uid()
        OR public.is_clinic_org_member(p.clinic_id, auth.uid())
        OR public.is_clinic_org_owner(p.clinic_id, auth.uid())
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.patients p
    WHERE p.id = patient_diary_entries.patient_id
      AND (
        p.user_id = auth.uid()
        OR public.is_clinic_org_member(p.clinic_id, auth.uid())
        OR public.is_clinic_org_owner(p.clinic_id, auth.uid())
      )
  )
);

-- Trigger: when caller is therapist (not the portal patient), only allow changing comment fields
CREATE OR REPLACE FUNCTION public.restrict_diary_therapist_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.is_portal_patient(NEW.patient_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  -- Therapist path: block changes to patient content
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.portal_account_id IS DISTINCT FROM OLD.portal_account_id
     OR NEW.mood IS DISTINCT FROM OLD.mood
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.shared_with_therapist IS DISTINCT FROM OLD.shared_with_therapist
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Therapists can only edit comment fields on diary entries';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_restrict_diary_therapist_updates
BEFORE UPDATE ON public.patient_diary_entries
FOR EACH ROW EXECUTE FUNCTION public.restrict_diary_therapist_updates();

CREATE TRIGGER trg_diary_updated_at
BEFORE UPDATE ON public.patient_diary_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC that masks content for therapist view when not shared
CREATE OR REPLACE FUNCTION public.get_patient_diary_for_therapist(_patient_id uuid)
RETURNS TABLE(
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  shared_with_therapist boolean,
  mood text,
  content text,
  therapist_comment text,
  therapist_commented_at timestamptz,
  therapist_commented_by uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.created_at,
    e.updated_at,
    e.shared_with_therapist,
    CASE WHEN e.shared_with_therapist THEN e.mood ELSE NULL END,
    CASE WHEN e.shared_with_therapist THEN e.content ELSE NULL END,
    e.therapist_comment,
    e.therapist_commented_at,
    e.therapist_commented_by
  FROM public.patient_diary_entries e
  JOIN public.patients p ON p.id = e.patient_id
  WHERE e.patient_id = _patient_id
    AND (
      p.user_id = auth.uid()
      OR public.is_clinic_org_member(p.clinic_id, auth.uid())
      OR public.is_clinic_org_owner(p.clinic_id, auth.uid())
    )
  ORDER BY e.created_at DESC;
$$;
