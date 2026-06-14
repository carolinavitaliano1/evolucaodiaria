
-- 1) Tabela de histórico de repasse por clínica
CREATE TABLE IF NOT EXISTS public.clinic_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  effective_from date NOT NULL,
  payment_type text,
  payment_amount numeric NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_payment_history_clinic_date
  ON public.clinic_payment_history (clinic_id, effective_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_payment_history TO authenticated;
GRANT ALL ON public.clinic_payment_history TO service_role;

ALTER TABLE public.clinic_payment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owner manages history"
ON public.clinic_payment_history FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.user_id = auth.uid())
  OR public.is_clinic_org_owner(clinic_id, auth.uid())
  OR public.is_clinic_org_member(clinic_id, auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.clinics c WHERE c.id = clinic_id AND c.user_id = auth.uid())
  OR public.is_clinic_org_owner(clinic_id, auth.uid())
  OR public.is_clinic_org_member(clinic_id, auth.uid())
);

-- 2) Seed: linha inicial preservando o valor atual de todas as clínicas Contratante 'sessao'
INSERT INTO public.clinic_payment_history (clinic_id, effective_from, payment_type, payment_amount)
SELECT c.id, '2000-01-01'::date, c.payment_type, c.payment_amount
FROM public.clinics c
WHERE c.payment_amount IS NOT NULL
  AND c.payment_type = 'sessao'
  AND NOT EXISTS (
    SELECT 1 FROM public.clinic_payment_history h WHERE h.clinic_id = c.id
  );

-- 3) Atualiza função de cálculo para considerar o histórico
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
  _services_revenue numeric := 0;
  _package_id uuid;
  _pkg_lancamento text;
  _pkg_valor_total numeric;
  _pkg_session_limit int;
  _pkg_type text;
  _package_assigned_at timestamptz;
  _per_session_value numeric := 0;
  _sessions_used_total int := 0;
  _sessions_in_month int := 0;
  _sessions_scheduled_in_month int := 0;
  _has_billable_in_month boolean := false;
  _clinic_id uuid;
  _clinic_payment_type text;
  _clinic_absence_payment_type text;
  _clinic_pays_on_absence boolean;
  _clinic_absence_charge_mode text;
  _clinic_absence_charge_amount numeric;
  _resolved_absence_type text;
  _should_charge_absence boolean;
  _absence_value numeric;
  _schedule_by_day jsonb;
  _weekdays text[];
  _ym_start date;
  _ym_end date;
  _d date;
  _dow_label text;
  _appt_proc_id uuid;
  _appt_pkg_id uuid;
  _proc_value numeric;
  _session_value numeric;
  _hist_value numeric;
BEGIN
  SELECT payment_value, payment_type, package_id, package_assigned_at, clinic_id
    INTO _payment_value, _payment_type, _package_id, _package_assigned_at, _clinic_id
  FROM patients WHERE id = _patient_id;

  _payment_value := COALESCE(_payment_value, 0);

  SELECT COALESCE(SUM(price), 0) INTO _services_revenue
  FROM private_appointments
  WHERE patient_id = _patient_id
    AND EXTRACT(MONTH FROM date) = _month
    AND EXTRACT(YEAR FROM date) = _year
    AND status != 'cancelado';

  IF _clinic_id IS NOT NULL THEN
    SELECT payment_type, absence_payment_type, pays_on_absence,
           absence_charge_mode, absence_charge_amount
      INTO _clinic_payment_type, _clinic_absence_payment_type, _clinic_pays_on_absence,
           _clinic_absence_charge_mode, _clinic_absence_charge_amount
    FROM clinics WHERE id = _clinic_id;

    IF _clinic_payment_type IN ('fixo_mensal','fixo','mensal','fixo_diario','fixo_dia') THEN
      RETURN _services_revenue;
    END IF;
  END IF;

  _resolved_absence_type := COALESCE(
    CASE WHEN _clinic_absence_payment_type IN ('never','always','confirmed_only')
         THEN _clinic_absence_payment_type ELSE NULL END,
    CASE WHEN _clinic_pays_on_absence = false THEN 'never' ELSE 'always' END
  );

  IF _package_id IS NOT NULL THEN
    SELECT lancamento_tipo, COALESCE(valor_total, price), session_limit, package_type
      INTO _pkg_lancamento, _pkg_valor_total, _pkg_session_limit, _pkg_type
    FROM clinic_packages WHERE id = _package_id;

    _pkg_valor_total := COALESCE(_pkg_valor_total, 0);

    IF _pkg_lancamento = 'valor_total' THEN
      IF _pkg_type = 'mensal' THEN
        SELECT EXISTS (
          SELECT 1 FROM evolutions
          WHERE patient_id = _patient_id
            AND EXTRACT(MONTH FROM date) = _month
            AND EXTRACT(YEAR FROM date) = _year
            AND attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado')
        ) INTO _has_billable_in_month;
        IF _has_billable_in_month THEN
          _revenue := _revenue + _pkg_valor_total;
        END IF;
      ELSE
        IF _package_assigned_at IS NOT NULL
           AND EXTRACT(MONTH FROM _package_assigned_at) = _month
           AND EXTRACT(YEAR  FROM _package_assigned_at) = _year THEN
          _revenue := _revenue + _pkg_valor_total;
        END IF;
      END IF;

      RETURN _revenue + _services_revenue;
    END IF;

    IF _pkg_lancamento = 'valor_procedimento' THEN
      IF _pkg_type = 'por_sessao' THEN
        _per_session_value := _pkg_valor_total;
      ELSIF _pkg_type = 'personalizado' AND _pkg_session_limit IS NOT NULL AND _pkg_session_limit > 0 THEN
        _per_session_value := _pkg_valor_total / _pkg_session_limit;
      ELSIF _pkg_type = 'mensal' THEN
        SELECT schedule_by_day, weekdays INTO _schedule_by_day, _weekdays
        FROM patients WHERE id = _patient_id;

        _ym_start := make_date(_year, _month, 1);
        _ym_end := (_ym_start + interval '1 month' - interval '1 day')::date;
        _sessions_scheduled_in_month := 0;
        _d := _ym_start;
        WHILE _d <= _ym_end LOOP
          _dow_label := CASE EXTRACT(DOW FROM _d)::int
            WHEN 0 THEN 'Domingo' WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta' WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' WHEN 6 THEN 'Sábado'
          END;
          IF _schedule_by_day IS NOT NULL AND _schedule_by_day ? _dow_label THEN
            _sessions_scheduled_in_month := _sessions_scheduled_in_month + 1;
          ELSIF _weekdays IS NOT NULL AND _dow_label = ANY(_weekdays) THEN
            _sessions_scheduled_in_month := _sessions_scheduled_in_month + 1;
          END IF;
          _d := _d + 1;
        END LOOP;

        IF _sessions_scheduled_in_month > 0 THEN
          _per_session_value := _pkg_valor_total / _sessions_scheduled_in_month;
        ELSE
          _per_session_value := 0;
        END IF;
      ELSE
        _per_session_value := 0;
      END IF;

      IF _pkg_type = 'personalizado' AND _pkg_session_limit IS NOT NULL AND _pkg_session_limit > 0 THEN
        SELECT COUNT(*) INTO _sessions_used_total
        FROM evolutions
        WHERE patient_id = _patient_id
          AND attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado')
          AND (_package_assigned_at IS NULL OR date >= _package_assigned_at::date);

        SELECT COUNT(*) INTO _sessions_in_month
        FROM evolutions
        WHERE patient_id = _patient_id
          AND attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado')
          AND EXTRACT(MONTH FROM date) = _month
          AND EXTRACT(YEAR FROM date) = _year;

        IF _sessions_used_total > _pkg_session_limit THEN
          _sessions_in_month := GREATEST(0, _sessions_in_month - (_sessions_used_total - _pkg_session_limit));
        END IF;

        _revenue := _revenue + (_sessions_in_month * _per_session_value);
      ELSE
        SELECT COUNT(*) INTO _sessions_in_month
        FROM evolutions
        WHERE patient_id = _patient_id
          AND attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado')
          AND EXTRACT(MONTH FROM date) = _month
          AND EXTRACT(YEAR FROM date) = _year;

        _revenue := _revenue + (_sessions_in_month * _per_session_value);
      END IF;

      RETURN _revenue + _services_revenue;
    END IF;
  END IF;

  FOR _evo IN
    SELECT id, attendance_status, group_id, confirmed_attendance, date
    FROM evolutions
    WHERE patient_id = _patient_id
      AND EXTRACT(MONTH FROM date) = _month
      AND EXTRACT(YEAR FROM date) = _year
  LOOP
    IF _evo.group_id IS NOT NULL THEN
      SELECT price INTO _group_price FROM therapeutic_groups WHERE id = _evo.group_id;
      _group_price := COALESCE(_group_price, 0);
      IF _evo.attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado') THEN
        _revenue := _revenue + _group_price;
      ELSIF _evo.attendance_status = 'falta' THEN
        _should_charge_absence := (
          _resolved_absence_type = 'always'
          OR (_resolved_absence_type = 'confirmed_only' AND _evo.confirmed_attendance = true)
        );
        IF _should_charge_absence THEN
          _revenue := _revenue + _group_price;
        END IF;
      END IF;
    ELSE
      _appt_proc_id := NULL;
      _appt_pkg_id := NULL;
      _session_value := _payment_value;

      SELECT a.procedure_id, a.package_id
        INTO _appt_proc_id, _appt_pkg_id
      FROM appointments a
      WHERE a.patient_id = _patient_id
        AND a.date = _evo.date
      ORDER BY (a.procedure_id IS NOT NULL) DESC,
               (a.package_id IS NOT NULL) DESC,
               a.created_at DESC
      LIMIT 1;

      IF _appt_proc_id IS NOT NULL THEN
        SELECT COALESCE(value, 0) INTO _proc_value FROM procedures WHERE id = _appt_proc_id;
        _session_value := COALESCE(_proc_value, _payment_value);
      ELSIF _appt_pkg_id IS NOT NULL THEN
        SELECT COALESCE(price, 0) INTO _proc_value FROM clinic_packages WHERE id = _appt_pkg_id;
        _session_value := COALESCE(_proc_value, _payment_value);
      ELSIF _clinic_id IS NOT NULL THEN
        -- Histórico de repasse da clínica vigente na data da sessão
        SELECT payment_amount INTO _hist_value
        FROM clinic_payment_history
        WHERE clinic_id = _clinic_id
          AND effective_from <= _evo.date
        ORDER BY effective_from DESC
        LIMIT 1;
        IF _hist_value IS NOT NULL THEN
          _session_value := _hist_value;
        END IF;
      END IF;

      IF _evo.attendance_status IN ('presente','reposicao','anteposicao','falta_remunerada','feriado_remunerado') THEN
        _revenue := _revenue + _session_value;
      ELSIF _evo.attendance_status = 'falta' THEN
        _should_charge_absence := (
          _resolved_absence_type = 'always'
          OR (_resolved_absence_type = 'confirmed_only' AND _evo.confirmed_attendance = true)
        );
        IF _should_charge_absence THEN
          IF _clinic_absence_charge_mode = 'parcial' THEN
            _absence_value := COALESCE(_clinic_absence_charge_amount, 0);
          ELSE
            _absence_value := _session_value;
          END IF;
          _revenue := _revenue + _absence_value;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN _revenue + _services_revenue;
END;
$function$;
