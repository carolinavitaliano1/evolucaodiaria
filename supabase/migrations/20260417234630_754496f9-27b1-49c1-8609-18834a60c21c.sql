-- 1. Adicionar patient_id em private_appointments
ALTER TABLE public.private_appointments
ADD COLUMN IF NOT EXISTS patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_private_appointments_patient_id 
ON public.private_appointments(patient_id);

-- 2. Atualizar RPC para incluir private_appointments no faturamento do paciente
CREATE OR REPLACE FUNCTION public.get_patient_monthly_revenue(_patient_id uuid, _month integer, _year integer)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _revenue numeric := 0;
  _payment_value numeric;
  _payment_type text;
  _evo record;
  _group_price numeric;
  _member_paying boolean;
  _member_value numeric;
  _services_revenue numeric := 0;
BEGIN
  -- Get patient payment config
  SELECT payment_value, payment_type INTO _payment_value, _payment_type
  FROM patients WHERE id = _patient_id;

  _payment_value := COALESCE(_payment_value, 0);

  -- Sum private_appointments (serviços avulsos) for this patient in the month
  SELECT COALESCE(SUM(price), 0) INTO _services_revenue
  FROM private_appointments
  WHERE patient_id = _patient_id
    AND EXTRACT(MONTH FROM date) = _month
    AND EXTRACT(YEAR FROM date) = _year
    AND status != 'cancelado';

  -- If fixed monthly, return payment_value + services
  IF _payment_type IN ('fixo', 'mensal') THEN
    RETURN _payment_value + _services_revenue;
  END IF;

  -- Loop through billable evolutions for the month
  FOR _evo IN
    SELECT e.id, e.group_id, e.attendance_status
    FROM evolutions e
    WHERE e.patient_id = _patient_id
      AND EXTRACT(MONTH FROM e.date) = _month
      AND EXTRACT(YEAR FROM e.date) = _year
      AND e.attendance_status IN ('presente', 'reposicao', 'falta_cobrada')
  LOOP
    IF _evo.group_id IS NOT NULL THEN
      SELECT tgm.is_paying, tgm.member_payment_value
      INTO _member_paying, _member_value
      FROM therapeutic_group_members tgm
      WHERE tgm.group_id = _evo.group_id AND tgm.patient_id = _patient_id;

      IF _member_paying IS NOT NULL AND _member_paying = false THEN
        CONTINUE;
      END IF;

      IF _member_value IS NOT NULL THEN
        _revenue := _revenue + _member_value;
      ELSE
        SELECT COALESCE(tg.default_price, 0) INTO _group_price
        FROM therapeutic_groups tg WHERE tg.id = _evo.group_id;
        _revenue := _revenue + COALESCE(_group_price, 0);
      END IF;
    ELSE
      _revenue := _revenue + _payment_value;
    END IF;
  END LOOP;

  RETURN _revenue + _services_revenue;
END;
$function$;

-- 3. Permitir que pacientes do portal vejam seus próprios serviços
DROP POLICY IF EXISTS "Portal patient can view own services" ON public.private_appointments;
CREATE POLICY "Portal patient can view own services"
ON public.private_appointments
FOR SELECT
TO authenticated
USING (patient_id IS NOT NULL AND is_portal_patient(patient_id, auth.uid()));