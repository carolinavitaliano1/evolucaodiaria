
-- Add payment data columns to clinics table
ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS payment_pix_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_pix_name TEXT,
  ADD COLUMN IF NOT EXISTS payment_bank_details TEXT,
  ADD COLUMN IF NOT EXISTS show_payment_in_portal BOOLEAN NOT NULL DEFAULT false;
