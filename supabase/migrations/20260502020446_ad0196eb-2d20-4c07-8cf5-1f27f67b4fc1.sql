ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS package_renewal_decision text,
  ADD COLUMN IF NOT EXISTS package_decision_at timestamptz;