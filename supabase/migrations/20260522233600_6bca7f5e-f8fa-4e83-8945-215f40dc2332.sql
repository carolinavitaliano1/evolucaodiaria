
ALTER TABLE public.video_sessions
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS max_participants integer,
  ADD COLUMN IF NOT EXISTS estimated_cost_cents integer;

CREATE OR REPLACE VIEW public.video_usage_monthly AS
SELECT
  therapist_user_id,
  clinic_id,
  date_trunc('month', COALESCE(ended_at, started_at, created_at))::date AS month,
  COUNT(*) FILTER (WHERE duration_seconds IS NOT NULL) AS sessions_count,
  COALESCE(SUM(duration_seconds), 0) AS total_seconds,
  ROUND(COALESCE(SUM(duration_seconds), 0) / 60.0, 1) AS total_minutes,
  COALESCE(SUM(estimated_cost_cents), 0) AS total_cost_cents
FROM public.video_sessions
WHERE duration_seconds IS NOT NULL
GROUP BY therapist_user_id, clinic_id, date_trunc('month', COALESCE(ended_at, started_at, created_at));

GRANT SELECT ON public.video_usage_monthly TO authenticated;
