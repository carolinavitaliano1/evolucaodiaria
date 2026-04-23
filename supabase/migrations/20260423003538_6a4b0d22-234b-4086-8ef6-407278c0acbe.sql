
-- Fix RLS: use SECURITY DEFINER function to bypass organizations RLS for anon insert check
DROP POLICY IF EXISTS "Anon can submit team applications" ON public.team_applications;

CREATE POLICY "Anon can submit team applications"
ON public.team_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.get_organization_for_application(organization_id) o
    WHERE o.applications_link_enabled = true
  )
);

-- Convert specialty to text[] to support multiple specialties; keep backward compat
ALTER TABLE public.team_applications
  ADD COLUMN IF NOT EXISTS specialties text[];

-- Backfill from existing single specialty column if present
UPDATE public.team_applications
SET specialties = ARRAY[specialty]
WHERE specialty IS NOT NULL AND specialty <> '' AND (specialties IS NULL OR array_length(specialties,1) IS NULL);
