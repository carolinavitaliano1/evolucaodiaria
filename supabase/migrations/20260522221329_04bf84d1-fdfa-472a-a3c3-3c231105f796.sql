
DROP POLICY IF EXISTS "Anon can read patient by intake_token" ON public.patients;
DROP POLICY IF EXISTS "Anon can update patient by intake_token" ON public.patients;
DROP POLICY IF EXISTS "Public intake token lookup" ON public.patients;

CREATE OR REPLACE FUNCTION public.get_patient_by_intake_token(_token uuid)
RETURNS TABLE(id uuid, name text, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.status
  FROM public.patients p
  WHERE p.intake_token = _token AND _token IS NOT NULL
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_patient_by_intake_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_patient_by_intake_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_patient_intake(_token uuid, _data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _patient_id uuid;
  _user_id uuid;
  _patient_name text;
BEGIN
  IF _token IS NULL THEN RETURN false; END IF;

  SELECT p.id, p.user_id, p.name INTO _patient_id, _user_id, _patient_name
  FROM public.patients p WHERE p.intake_token = _token LIMIT 1;
  IF _patient_id IS NULL THEN RETURN false; END IF;

  UPDATE public.patients SET
    birthdate = COALESCE((_data->>'birthdate')::date, birthdate),
    cpf = COALESCE(_data->>'cpf', cpf),
    phone = COALESCE(_data->>'phone', phone),
    whatsapp = COALESCE(_data->>'whatsapp', whatsapp),
    email = COALESCE(_data->>'email', email),
    observations = COALESCE(_data->>'observations', observations),
    responsible_name = COALESCE(_data->>'responsible_name', responsible_name),
    responsible_whatsapp = COALESCE(_data->>'responsible_whatsapp', responsible_whatsapp),
    responsible_cpf = COALESCE(_data->>'responsible_cpf', responsible_cpf),
    financial_responsible_name = COALESCE(_data->>'financial_responsible_name', financial_responsible_name),
    financial_responsible_whatsapp = COALESCE(_data->>'financial_responsible_whatsapp', financial_responsible_whatsapp),
    financial_responsible_cpf = COALESCE(_data->>'financial_responsible_cpf', financial_responsible_cpf),
    status = 'pendente_revisao',
    updated_at = now()
  WHERE id = _patient_id;

  IF _user_id IS NOT NULL THEN
    INSERT INTO public.patient_intake_forms (
      patient_id, therapist_user_id, full_name, birthdate, cpf, phone, whatsapp, email,
      gender, address, responsible_name, responsible_phone, responsible_cpf,
      financial_responsible_name, financial_responsible_phone, financial_responsible_cpf,
      how_found, health_info, submitted_at
    ) VALUES (
      _patient_id, _user_id, _patient_name,
      (_data->>'birthdate')::date,
      _data->>'cpf', _data->>'phone', _data->>'whatsapp', _data->>'email',
      _data->>'gender', _data->>'address',
      _data->>'responsible_name', _data->>'responsible_whatsapp', _data->>'responsible_cpf',
      _data->>'financial_responsible_name', _data->>'financial_responsible_whatsapp', _data->>'financial_responsible_cpf',
      _data->>'how_found', _data->>'observations', now()
    )
    ON CONFLICT (patient_id) DO UPDATE SET
      full_name = EXCLUDED.full_name, birthdate = EXCLUDED.birthdate, cpf = EXCLUDED.cpf,
      phone = EXCLUDED.phone, whatsapp = EXCLUDED.whatsapp, email = EXCLUDED.email,
      gender = EXCLUDED.gender, address = EXCLUDED.address,
      responsible_name = EXCLUDED.responsible_name, responsible_phone = EXCLUDED.responsible_phone, responsible_cpf = EXCLUDED.responsible_cpf,
      financial_responsible_name = EXCLUDED.financial_responsible_name,
      financial_responsible_phone = EXCLUDED.financial_responsible_phone,
      financial_responsible_cpf = EXCLUDED.financial_responsible_cpf,
      how_found = EXCLUDED.how_found, health_info = EXCLUDED.health_info,
      submitted_at = EXCLUDED.submitted_at;
  END IF;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_patient_intake(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_patient_intake(uuid, jsonb) TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.internal_notifications;
CREATE POLICY "Authenticated users can create notifications"
ON public.internal_notifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by_user_id);
