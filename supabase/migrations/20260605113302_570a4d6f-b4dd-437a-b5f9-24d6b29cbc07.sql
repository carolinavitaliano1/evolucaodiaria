CREATE TABLE public.admin_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  name text,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'pending',
  invited_at timestamptz,
  registered_at timestamptz,
  last_email_at timestamptz,
  last_email_subject text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX admin_contacts_email_unique ON public.admin_contacts (lower(email));
CREATE INDEX admin_contacts_status_idx ON public.admin_contacts (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_contacts TO authenticated;
GRANT ALL ON public.admin_contacts TO service_role;

ALTER TABLE public.admin_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App owner manages admin_contacts"
ON public.admin_contacts
FOR ALL
TO authenticated
USING (public.is_app_owner(auth.uid()))
WITH CHECK (public.is_app_owner(auth.uid()));

CREATE TRIGGER update_admin_contacts_updated_at
BEFORE UPDATE ON public.admin_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-mark contact as registered when matching profile is created
CREATE OR REPLACE FUNCTION public.mark_admin_contact_registered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    UPDATE public.admin_contacts
    SET status = 'registered',
        registered_at = COALESCE(registered_at, now()),
        updated_at = now()
    WHERE lower(email) = lower(NEW.email)
      AND status <> 'registered';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER mark_admin_contact_registered_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.mark_admin_contact_registered();