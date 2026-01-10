-- Add column to track if clinic pays for patient absences
ALTER TABLE public.clinics 
ADD COLUMN pays_on_absence boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.clinics.pays_on_absence IS 'Whether the clinic pays the therapist when a patient misses a session';