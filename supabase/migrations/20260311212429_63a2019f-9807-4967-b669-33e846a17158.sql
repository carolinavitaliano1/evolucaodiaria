-- 1. patient_portal_accounts
CREATE TABLE IF NOT EXISTS public.patient_portal_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL UNIQUE,
  therapist_user_id uuid NOT NULL,
  patient_email text NOT NULL,
  user_id uuid,
  invite_token text UNIQUE,
  invite_sent_at timestamptz,
  invite_expires_at timestamptz,
  status text NOT NULL DEFAULT 'invited',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_portal_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist can manage portal accounts" ON public.patient_portal_accounts FOR ALL TO authenticated USING (therapist_user_id = auth.uid()) WITH CHECK (therapist_user_id = auth.uid());
CREATE POLICY "Patient can view own portal account" ON public.patient_portal_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER update_patient_portal_accounts_updated_at BEFORE UPDATE ON public.patient_portal_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Helper function (table must exist first)
CREATE OR REPLACE FUNCTION public.is_portal_patient(_patient_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.patient_portal_accounts WHERE patient_id = _patient_id AND user_id = _user_id AND status = 'active');
$$;

-- 3. portal_messages
CREATE TABLE IF NOT EXISTS public.portal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_user_id uuid NOT NULL,
  sender_type text NOT NULL DEFAULT 'therapist',
  content text NOT NULL DEFAULT '',
  message_type text NOT NULL DEFAULT 'message',
  read_by_patient boolean NOT NULL DEFAULT false,
  read_by_therapist boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist can manage portal messages" ON public.portal_messages FOR ALL TO authenticated USING (therapist_user_id = auth.uid()) WITH CHECK (therapist_user_id = auth.uid());
CREATE POLICY "Patient can read portal messages" ON public.portal_messages FOR SELECT TO authenticated USING (is_portal_patient(patient_id, auth.uid()));
CREATE POLICY "Patient can insert portal messages" ON public.portal_messages FOR INSERT TO authenticated WITH CHECK (sender_type = 'patient' AND is_portal_patient(patient_id, auth.uid()));
CREATE POLICY "Patient can update message read status" ON public.portal_messages FOR UPDATE TO authenticated USING (is_portal_patient(patient_id, auth.uid()));

-- 4. patient_intake_forms
CREATE TABLE IF NOT EXISTS public.patient_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL UNIQUE,
  therapist_user_id uuid NOT NULL,
  full_name text, cpf text, birthdate date, phone text, address text,
  responsible_name text, responsible_cpf text, responsible_phone text,
  emergency_contact text, health_info text, observations text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_intake_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Therapist can view patient intake forms" ON public.patient_intake_forms FOR SELECT TO authenticated USING (therapist_user_id = auth.uid());
CREATE POLICY "Patient can manage own intake form" ON public.patient_intake_forms FOR ALL TO authenticated USING (is_portal_patient(patient_id, auth.uid())) WITH CHECK (is_portal_patient(patient_id, auth.uid()));
CREATE TRIGGER update_patient_intake_forms_updated_at BEFORE UPDATE ON public.patient_intake_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();