ALTER TABLE public.health_plans
  ADD COLUMN IF NOT EXISTS passthrough_value numeric NOT NULL DEFAULT 0;