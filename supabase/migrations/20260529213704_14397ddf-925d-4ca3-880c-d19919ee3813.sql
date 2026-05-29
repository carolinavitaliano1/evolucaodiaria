
-- 1) Profiles: prevent self-escalation via privileged fields
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / no auth context: allow
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- App owners (resolved via current DB state, not the NEW row) may change anything
  IF public.is_app_owner(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Not allowed to change email via direct update';
  END IF;
  IF NEW.is_support_admin IS DISTINCT FROM OLD.is_support_admin THEN
    RAISE EXCEPTION 'Not allowed to change support admin flag';
  END IF;
  IF NEW.trial_until IS DISTINCT FROM OLD.trial_until THEN
    RAISE EXCEPTION 'Not allowed to change trial_until';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_priv_esc ON public.profiles;
CREATE TRIGGER trg_prevent_profile_priv_esc
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- 2) Patients: prevent portal patients from changing sensitive clinical/financial fields
CREATE OR REPLACE FUNCTION public.restrict_portal_patient_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_portal boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- If the caller is the owner therapist or an org member, allow
  IF NEW.user_id = auth.uid() OR public.is_clinic_org_member(NEW.clinic_id, auth.uid()) OR public.is_clinic_org_owner(NEW.clinic_id, auth.uid()) THEN
    RETURN NEW;
  END IF;

  _is_portal := public.is_portal_patient(NEW.id, auth.uid());
  IF NOT _is_portal THEN
    RETURN NEW;
  END IF;

  -- Portal patient: block changes to sensitive fields
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.clinic_id IS DISTINCT FROM OLD.clinic_id
     OR NEW.clinical_area IS DISTINCT FROM OLD.clinical_area
     OR NEW.diagnosis IS DISTINCT FROM OLD.diagnosis
     OR NEW.professionals IS DISTINCT FROM OLD.professionals
     OR NEW.payment_type IS DISTINCT FROM OLD.payment_type
     OR NEW.payment_value IS DISTINCT FROM OLD.payment_value
     OR NEW.payment_due_day IS DISTINCT FROM OLD.payment_due_day
     OR NEW.payment_info IS DISTINCT FROM OLD.payment_info
     OR NEW.contract_start_date IS DISTINCT FROM OLD.contract_start_date
     OR NEW.weekdays IS DISTINCT FROM OLD.weekdays
     OR NEW.schedule_time IS DISTINCT FROM OLD.schedule_time
     OR NEW.schedule_by_day IS DISTINCT FROM OLD.schedule_by_day
     OR NEW.package_id IS DISTINCT FROM OLD.package_id
     OR NEW.package_assigned_at IS DISTINCT FROM OLD.package_assigned_at
     OR NEW.package_renewal_decision IS DISTINCT FROM OLD.package_renewal_decision
     OR NEW.package_decision_at IS DISTINCT FROM OLD.package_decision_at
     OR NEW.is_archived IS DISTINCT FROM OLD.is_archived
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.intake_token IS DISTINCT FROM OLD.intake_token
     OR NEW.show_payment_in_portal IS DISTINCT FROM OLD.show_payment_in_portal
     OR NEW.is_minor IS DISTINCT FROM OLD.is_minor
     OR NEW.is_virtual IS DISTINCT FROM OLD.is_virtual
     OR NEW.session_link IS DISTINCT FROM OLD.session_link
     OR NEW.departure_date IS DISTINCT FROM OLD.departure_date
     OR NEW.departure_reason IS DISTINCT FROM OLD.departure_reason
     OR NEW.health_plan_id IS DISTINCT FROM OLD.health_plan_id
     OR NEW.health_plan_card_number IS DISTINCT FROM OLD.health_plan_card_number
     OR NEW.health_plan_authorized_sessions IS DISTINCT FROM OLD.health_plan_authorized_sessions
     OR NEW.health_plan_authorization_expires_at IS DISTINCT FROM OLD.health_plan_authorization_expires_at
  THEN
    RAISE EXCEPTION 'Portal patients are not allowed to modify clinical/financial fields';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_portal_patient_updates ON public.patients;
CREATE TRIGGER trg_restrict_portal_patient_updates
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.restrict_portal_patient_updates();

-- 3) Notices: restrict SELECT to author
DROP POLICY IF EXISTS "Authenticated users can view all notices" ON public.notices;
CREATE POLICY "Users can view their own notices"
  ON public.notices
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4) Storage: attendance-attachments must be uploaded into a folder named with auth.uid()
DROP POLICY IF EXISTS "Org members can upload attendance attachments" ON storage.objects;
CREATE POLICY "Uploader folder for attendance attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'attendance-attachments'
    AND auth.uid() IS NOT NULL
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );
