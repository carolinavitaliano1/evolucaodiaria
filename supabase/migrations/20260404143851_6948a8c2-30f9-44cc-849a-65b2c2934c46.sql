
-- 1. Drop the overly permissive enrollment policy that leaks all clinics to authenticated users
DROP POLICY IF EXISTS "Public can read clinic info for enrollment" ON public.clinics;

-- 2. Recreate it for ANON only (visitors without session)
CREATE POLICY "Anon can read clinic for enrollment"
ON public.clinics
FOR SELECT
TO anon
USING (is_archived IS DISTINCT FROM true);

-- 3. Create a security definer function so authenticated users can also look up a single clinic for enrollment
CREATE OR REPLACE FUNCTION public.get_clinic_for_enrollment(_clinic_id uuid)
RETURNS TABLE(id uuid, name text, address text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.address
  FROM public.clinics c
  WHERE c.id = _clinic_id
    AND c.is_archived IS DISTINCT FROM true;
$$;
