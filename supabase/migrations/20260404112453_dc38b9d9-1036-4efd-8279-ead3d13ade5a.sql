
-- Create helper function to check portal account ownership
CREATE OR REPLACE FUNCTION public.is_portal_account_owner(_account_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patient_portal_accounts
    WHERE id = _account_id AND user_id = _user_id AND status = 'active'
  );
$$;

-- Drop old patient policies
DROP POLICY IF EXISTS "Patient can read portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Patient can insert portal messages" ON public.portal_messages;
DROP POLICY IF EXISTS "Patient can update message read status" ON public.portal_messages;

-- Recreate with portal_account_id scoping
CREATE POLICY "Patient can read portal messages"
  ON public.portal_messages FOR SELECT TO authenticated
  USING (is_portal_account_owner(portal_account_id, auth.uid()));

CREATE POLICY "Patient can insert portal messages"
  ON public.portal_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_type = 'patient'
    AND is_portal_account_owner(portal_account_id, auth.uid())
  );

CREATE POLICY "Patient can update message read status"
  ON public.portal_messages FOR UPDATE TO authenticated
  USING (is_portal_account_owner(portal_account_id, auth.uid()));
