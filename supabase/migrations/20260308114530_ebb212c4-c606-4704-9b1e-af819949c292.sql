-- Add CPF field to patients for fiscal documents
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf text NULL;

-- Add responsible CPF for when patient is a minor
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS responsible_cpf text NULL;