ALTER TABLE public.therapeutic_groups 
ADD COLUMN payment_type text DEFAULT 'por_sessao',
ADD COLUMN package_id uuid REFERENCES public.clinic_packages(id) ON DELETE SET NULL;