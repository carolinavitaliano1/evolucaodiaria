
-- Add payment due day to patients (day of month, 1-31)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS payment_due_day integer NULL;

-- Table to track per-patient monthly payment status
CREATE TABLE IF NOT EXISTS public.patient_payment_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  month integer NOT NULL,
  year integer NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  payment_date date NULL,
  notes text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (patient_id, month, year)
);

ALTER TABLE public.patient_payment_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own patient payment records"
  ON public.patient_payment_records
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
