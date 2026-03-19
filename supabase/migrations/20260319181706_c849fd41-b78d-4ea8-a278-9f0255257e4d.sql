
-- Add guardian/is_minor fields to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS is_minor boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS guardian_name text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS guardian_phone text,
  ADD COLUMN IF NOT EXISTS guardian_kinship text;
