
-- Phase 2: Patient contracts
CREATE TABLE IF NOT EXISTS public.patient_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_user_id uuid NOT NULL,
  template_html text NOT NULL DEFAULT '',
  signed_at timestamp with time zone,
  signature_data text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manages contracts" ON public.patient_contracts
  FOR ALL TO authenticated
  USING (therapist_user_id = auth.uid())
  WITH CHECK (therapist_user_id = auth.uid());

CREATE POLICY "Patient can view and sign own contract" ON public.patient_contracts
  FOR ALL TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()))
  WITH CHECK (is_portal_patient(patient_id, auth.uid()));

-- Phase 3: Portal notices (therapist → specific patient)
CREATE TABLE IF NOT EXISTS public.portal_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  therapist_user_id uuid NOT NULL,
  title text NOT NULL,
  content text,
  read_by_patient boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Therapist manages portal notices" ON public.portal_notices
  FOR ALL TO authenticated
  USING (therapist_user_id = auth.uid())
  WITH CHECK (therapist_user_id = auth.uid());

CREATE POLICY "Patient can read own portal notices" ON public.portal_notices
  FOR SELECT TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));

CREATE POLICY "Patient can update read status on notices" ON public.portal_notices
  FOR UPDATE TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));

-- Phase 3: Shared evolutions (therapist marks evolutions visible in portal)
ALTER TABLE public.evolutions ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT false;

-- Phase 4: Portal payment summary view helper column (we use existing patient_payment_records)
-- Add column to portal_messages for appointment reminder type
ALTER TABLE public.portal_messages ADD COLUMN IF NOT EXISTS appointment_date date;
ALTER TABLE public.portal_messages ADD COLUMN IF NOT EXISTS appointment_time text;
