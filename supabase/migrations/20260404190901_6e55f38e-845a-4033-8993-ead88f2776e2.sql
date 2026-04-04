ALTER TABLE public.patient_contracts
  ADD COLUMN IF NOT EXISTS signer_name text,
  ADD COLUMN IF NOT EXISTS signer_cpf text,
  ADD COLUMN IF NOT EXISTS signer_city text,
  ADD COLUMN IF NOT EXISTS agreed_terms boolean NOT NULL DEFAULT false;