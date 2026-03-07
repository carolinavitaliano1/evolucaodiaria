
-- Add permissions JSONB column and custom role_label to organization_members
ALTER TABLE public.organization_members 
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS role_label TEXT;
