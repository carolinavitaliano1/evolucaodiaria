
-- Fix: Portal patient can read own payment records (financial tab was empty)
CREATE POLICY "Portal patient can read own payment records"
ON public.patient_payment_records FOR SELECT
TO authenticated
USING (is_portal_patient(patient_id, auth.uid()));

-- Add payment_due_day to patient_intake_forms for patient to suggest payment day
ALTER TABLE public.patient_intake_forms
  ADD COLUMN IF NOT EXISTS payment_due_day integer;

-- Portal patient can update own intake form (needed for the upsert from patient side)
CREATE POLICY "Portal patient can upsert own intake form"
ON public.patient_intake_forms FOR ALL
TO authenticated
USING (is_portal_patient(patient_id, auth.uid()))
WITH CHECK (is_portal_patient(patient_id, auth.uid()));
