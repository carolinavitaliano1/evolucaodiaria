-- Add schedule_by_day column to clinics table for storing entry/exit times per day
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS schedule_by_day jsonb DEFAULT NULL;

-- Add is_archived column to clinics table
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS is_archived boolean DEFAULT false;

-- Add schedule_by_day column to patients table for storing entry/exit times per day
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS schedule_by_day jsonb DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN public.clinics.schedule_by_day IS 'JSON object with day names as keys and {start, end} time objects as values. Example: {"Segunda": {"start": "08:00", "end": "12:00"}}';
COMMENT ON COLUMN public.patients.schedule_by_day IS 'JSON object with day names as keys and {start, end} time objects as values. Example: {"Segunda": {"start": "08:00", "end": "12:00"}}';