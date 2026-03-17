
ALTER TABLE public.clinic_packages
  ADD COLUMN IF NOT EXISTS package_type TEXT NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS session_limit INTEGER NULL;
