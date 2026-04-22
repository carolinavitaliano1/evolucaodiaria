ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS departure_date date,
  ADD COLUMN IF NOT EXISTS departure_reason text;

-- Backfill: pacientes hoje arquivados recebem departure_date = updated_at
UPDATE public.patients
SET departure_date = updated_at::date
WHERE is_archived = true AND departure_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_departure_date ON public.patients(departure_date);