-- Normaliza dados existentes
UPDATE public.clinics
SET absence_payment_type = 'always',
    pays_on_absence = true
WHERE absence_payment_type IS DISTINCT FROM 'always'
   OR pays_on_absence IS DISTINCT FROM true;

-- Garante defaults coerentes para novos registros
ALTER TABLE public.clinics
  ALTER COLUMN absence_payment_type SET DEFAULT 'always',
  ALTER COLUMN pays_on_absence SET DEFAULT true;