CREATE TABLE public.waitlist_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  birthdate DATE,
  gender TEXT,
  address TEXT,
  reason TEXT,
  preferred_days TEXT[],
  preferred_time TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

-- Anon and authenticated can insert (public form)
CREATE POLICY "Anyone can submit waitlist entry"
  ON public.waitlist_entries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Therapist (clinic owner) can view entries for their clinics
CREATE POLICY "Clinic owner can view waitlist"
  ON public.waitlist_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = waitlist_entries.clinic_id AND c.user_id = auth.uid()
    )
    OR is_clinic_org_owner(clinic_id, auth.uid())
    OR is_clinic_org_member(clinic_id, auth.uid())
  );

-- Therapist can update entries (change status, add notes)
CREATE POLICY "Clinic owner can update waitlist"
  ON public.waitlist_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = waitlist_entries.clinic_id AND c.user_id = auth.uid()
    )
    OR is_clinic_org_owner(clinic_id, auth.uid())
  );

-- Therapist can delete entries
CREATE POLICY "Clinic owner can delete waitlist"
  ON public.waitlist_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clinics c
      WHERE c.id = waitlist_entries.clinic_id AND c.user_id = auth.uid()
    )
    OR is_clinic_org_owner(clinic_id, auth.uid())
  );