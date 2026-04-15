CREATE OR REPLACE FUNCTION public.get_patient_monthly_revenue(_patient_id uuid, _month integer, _year integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _revenue numeric := 0;
  _payment_value numeric;
  _payment_type text;
  _evo record;
  _group_price numeric;
  _member_paying boolean;
  _member_value numeric;
BEGIN
  -- Get patient payment config
  SELECT payment_value, payment_type INTO _payment_value, _payment_type
  FROM patients WHERE id = _patient_id;

  _payment_value := COALESCE(_payment_value, 0);

  -- If fixed monthly, just return payment_value (no session calculation)
  IF _payment_type IN ('fixo', 'mensal') THEN
    RETURN _payment_value;
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
      -- Group session: check member config first
      SELECT tgm.is_paying, tgm.member_payment_value
      INTO _member_paying, _member_value
      FROM therapeutic_group_members tgm
      WHERE tgm.group_id = _evo.group_id AND tgm.patient_id = _patient_id;

      IF _member_paying IS NOT NULL AND _member_paying = false THEN
        -- Not paying in this group
        CONTINUE;
      END IF;

      IF _member_value IS NOT NULL THEN
        _revenue := _revenue + _member_value;
      ELSE
        -- Use group default price
        SELECT COALESCE(tg.default_price, 0) INTO _group_price
        FROM therapeutic_groups tg WHERE tg.id = _evo.group_id;
        _revenue := _revenue + COALESCE(_group_price, 0);
      END IF;
    ELSE
      -- Individual session
      _revenue := _revenue + _payment_value;
    END IF;
  END LOOP;

  RETURN _revenue;
END;
$$;