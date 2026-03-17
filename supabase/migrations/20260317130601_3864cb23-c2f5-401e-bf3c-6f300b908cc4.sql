
-- Fix feed_posts RLS: ensure therapist can INSERT and patient can SELECT
DROP POLICY IF EXISTS "Therapist can manage own feed posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Portal patient can view own feed posts" ON public.feed_posts;

CREATE POLICY "Therapist can manage own feed posts"
  ON public.feed_posts
  FOR ALL
  TO authenticated
  USING (therapist_id = auth.uid())
  WITH CHECK (therapist_id = auth.uid());

CREATE POLICY "Portal patient can view own feed posts"
  ON public.feed_posts
  FOR SELECT
  TO authenticated
  USING (is_portal_patient(patient_id, auth.uid()));
