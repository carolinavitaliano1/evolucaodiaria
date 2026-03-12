
-- Add new fields to patient_intake_forms
ALTER TABLE public.patient_intake_forms
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS how_found text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  ADD COLUMN IF NOT EXISTS emergency_contact_address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS financial_responsible_name text,
  ADD COLUMN IF NOT EXISTS financial_responsible_email text,
  ADD COLUMN IF NOT EXISTS financial_responsible_cpf text,
  ADD COLUMN IF NOT EXISTS financial_responsible_relation text,
  ADD COLUMN IF NOT EXISTS financial_responsible_address text,
  ADD COLUMN IF NOT EXISTS financial_responsible_phone text;
