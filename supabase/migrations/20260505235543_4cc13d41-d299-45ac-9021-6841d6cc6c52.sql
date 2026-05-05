UPDATE public.organization_members
SET permissions = permissions || '["commissions.view"]'::jsonb
WHERE status = 'active'
  AND role = 'professional'
  AND NOT (permissions ? 'commissions.view');