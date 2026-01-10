-- Add digital signature column to evolutions table
ALTER TABLE public.evolutions ADD COLUMN IF NOT EXISTS signature TEXT;