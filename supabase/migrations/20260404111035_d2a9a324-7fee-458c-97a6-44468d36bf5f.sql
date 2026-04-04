
-- Add portal_account_id to portal_messages to isolate conversations per portal account
ALTER TABLE public.portal_messages ADD COLUMN portal_account_id uuid REFERENCES public.patient_portal_accounts(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX idx_portal_messages_portal_account_id ON public.portal_messages(portal_account_id);

-- Backfill existing messages: match by patient_id + therapist_user_id
UPDATE public.portal_messages pm
SET portal_account_id = (
  SELECT ppa.id FROM public.patient_portal_accounts ppa
  WHERE ppa.patient_id = pm.patient_id
    AND ppa.therapist_user_id = pm.therapist_user_id
  LIMIT 1
)
WHERE pm.portal_account_id IS NULL;
