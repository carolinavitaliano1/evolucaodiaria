-- Add per-patient payment visibility override
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS show_payment_in_portal BOOLEAN NOT NULL DEFAULT false;