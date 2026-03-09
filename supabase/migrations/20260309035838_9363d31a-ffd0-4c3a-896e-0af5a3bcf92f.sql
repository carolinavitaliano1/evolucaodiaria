
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS responsible_is_financial boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS financial_responsible_name text,
  ADD COLUMN IF NOT EXISTS financial_responsible_cpf text,
  ADD COLUMN IF NOT EXISTS financial_responsible_whatsapp text;
