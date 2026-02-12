ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS services_description text;