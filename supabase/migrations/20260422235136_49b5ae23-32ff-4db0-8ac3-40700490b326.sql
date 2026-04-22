ALTER TABLE public.team_applications
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS birthdate date;