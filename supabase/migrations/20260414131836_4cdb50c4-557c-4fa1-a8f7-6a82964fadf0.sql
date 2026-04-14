-- Add therapist_reviewed column to portal_documents
ALTER TABLE public.portal_documents
ADD COLUMN therapist_reviewed boolean NOT NULL DEFAULT false;

-- Allow therapists to update their own portal_documents (to mark as reviewed)
CREATE POLICY "Therapists can update their portal documents"
ON public.portal_documents
FOR UPDATE
USING (auth.uid() = therapist_user_id)
WITH CHECK (auth.uid() = therapist_user_id);