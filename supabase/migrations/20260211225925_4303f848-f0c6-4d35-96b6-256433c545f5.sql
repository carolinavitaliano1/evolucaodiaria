
ALTER TABLE public.saved_reports ADD COLUMN clinic_id uuid REFERENCES public.clinics(id) ON DELETE SET NULL;
