UPDATE public.organization_members
SET permissions = '["dashboard.view","clinics.view","patients.view","patients.own_only","calendar.view","calendar.own_only","evolutions.view","evolutions.own_only","evolutions.create","evolutions.status_only","ai_evolutions.use","mural.view","tasks.view"]'::jsonb,
    role_label = COALESCE(NULLIF(role_label, ''), 'Terapeuta')
WHERE status = 'active'
  AND role = 'professional'
  AND (permissions IS NULL OR permissions = '{}'::jsonb OR permissions = '[]'::jsonb);