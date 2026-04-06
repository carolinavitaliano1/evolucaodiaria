ALTER TABLE public.therapeutic_group_members
  ADD COLUMN is_paying boolean NOT NULL DEFAULT true,
  ADD COLUMN member_payment_value numeric DEFAULT NULL;