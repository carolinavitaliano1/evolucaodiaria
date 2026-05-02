ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS absence_charge_mode text NOT NULL DEFAULT 'integral',
  ADD COLUMN IF NOT EXISTS absence_charge_amount numeric;