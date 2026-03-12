
-- Add status and intake_token to patients table
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo',
  ADD COLUMN IF NOT EXISTS intake_token uuid DEFAULT gen_random_uuid();

-- Index for fast lookup by token
CREATE INDEX IF NOT EXISTS patients_intake_token_idx ON public.patients(intake_token);

-- Allow public (anon) to look up a patient by intake_token (read-only, no auth required)
DROP POLICY IF EXISTS "Public intake token lookup" ON public.patients;
CREATE POLICY "Public intake token lookup"
  ON public.patients FOR SELECT
  TO anon
  USING (intake_token IS NOT NULL);
