-- Add specific_details JSONB column to patient_portal_accounts
ALTER TABLE public.patient_portal_accounts
  ADD COLUMN IF NOT EXISTS specific_details JSONB DEFAULT '{}'::jsonb;