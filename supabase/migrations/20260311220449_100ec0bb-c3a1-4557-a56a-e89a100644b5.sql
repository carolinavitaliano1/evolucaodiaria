-- Add payment_info column to patients for PIX key / payment instructions
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS payment_info TEXT DEFAULT NULL;
