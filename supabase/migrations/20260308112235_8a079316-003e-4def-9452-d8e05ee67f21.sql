
-- Add payment_date to private_appointments
ALTER TABLE public.private_appointments
  ADD COLUMN IF NOT EXISTS payment_date date NULL;

-- Create clinic_payment_records for tracking contratante clinic payments
CREATE TABLE IF NOT EXISTS public.clinic_payment_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  payment_date date NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (clinic_id, month, year)
);

ALTER TABLE public.clinic_payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own payment records"
  ON public.clinic_payment_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
