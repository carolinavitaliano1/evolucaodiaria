
-- 1) Remove the over-permissive enrollment policy that leaked all non-archived clinics across users.
-- Public enrollment must go exclusively through the SECURITY DEFINER RPC public.get_clinic_for_enrollment(_clinic_id).
DROP POLICY IF EXISTS "Anon can read clinic for enrollment" ON public.clinics;

-- 2) Add a RESTRICTIVE policy so archived clinics are NEVER returned via SELECT,
--    regardless of which permissive policy matches.
DROP POLICY IF EXISTS "Hide archived clinics" ON public.clinics;
CREATE POLICY "Hide archived clinics"
ON public.clinics
AS RESTRICTIVE
FOR SELECT
TO authenticated, anon
USING (is_archived IS DISTINCT FROM true);
