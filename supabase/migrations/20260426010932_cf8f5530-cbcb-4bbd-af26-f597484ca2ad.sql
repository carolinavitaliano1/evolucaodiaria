-- Permission key 'commissions.view' is enforced application-side via the
-- permissions JSONB column on organization_members. Backfill it for every
-- existing professional member so they immediately see "Minhas Comissões".

UPDATE public.organization_members
SET permissions = (
  CASE
    WHEN permissions IS NULL OR jsonb_typeof(permissions) <> 'array'
      THEN '["commissions.view"]'::jsonb
    WHEN NOT (permissions @> '["commissions.view"]'::jsonb)
      THEN permissions || '["commissions.view"]'::jsonb
    ELSE permissions
  END
),
updated_at = now()
WHERE role = 'professional'
  AND status = 'active';