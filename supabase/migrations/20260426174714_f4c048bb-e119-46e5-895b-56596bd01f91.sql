ALTER TABLE public.organization_members
ADD COLUMN IF NOT EXISTS schedule_by_day JSONB;