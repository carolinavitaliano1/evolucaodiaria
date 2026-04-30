-- 1) Adicionar coluna para registrar quando o pacote foi associado ao paciente
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS package_assigned_at timestamptz;

-- Backfill: para pacientes que já têm package_id, usa contract_start_date ou created_at
UPDATE public.patients
SET package_assigned_at = COALESCE(contract_start_date::timestamptz, created_at)
WHERE package_id IS NOT NULL AND package_assigned_at IS NULL;

-- 2) Trigger: quando package_id mudar (NULL→algo, ou trocar de pacote), grava package_assigned_at = now()
CREATE OR REPLACE FUNCTION public.set_package_assigned_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.package_id IS NOT NULL AND NEW.package_assigned_at IS NULL THEN
      NEW.package_assigned_at := COALESCE(NEW.contract_start_date::timestamptz, now());
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.package_id IS DISTINCT FROM OLD.package_id THEN
    IF NEW.package_id IS NULL THEN
      NEW.package_assigned_at := NULL;
    ELSE
      NEW.package_assigned_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_package_assigned_at ON public.patients;
CREATE TRIGGER trg_set_package_assigned_at
BEFORE INSERT OR UPDATE OF package_id ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.set_package_assigned_at();

-- 3) Atualizar get_patient_monthly_revenue para considerar lancamento_tipo do pacote
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
  -- pacote
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
  _clinic_id uuid;
  _schedule_by_day jsonb;
  _weekdays text[];
  -- helpers
  _ym_start date;
  _ym_end date;
  _d date;
  _dow_label text;
BEGIN
  SELECT payment_value, payment_type, package_id, package_assigned_at, clinic_id
    INTO _payment_value, _payment_type, _package_id, _package_assigned_at, _clinic_id
  FROM patients WHERE id = _patient_id;

  _payment_value := COALESCE(_payment_value, 0);

  -- Receita de serviços avulsos (private_appointments) — sempre soma
  SELECT COALESCE(SUM(price), 0) INTO _services_revenue
  FROM private_appointments
  WHERE patient_id = _patient_id
    AND EXTRACT(MONTH FROM date) = _month
    AND EXTRACT(YEAR FROM date) = _year
    AND status != 'cancelado';

  -- ============ FLUXO COM PACOTE ============
  IF _package_id IS NOT NULL THEN
    SELECT lancamento_tipo, COALESCE(valor_total, price), session_limit, package_type
      INTO _pkg_lancamento, _pkg_valor_total, _pkg_session_limit, _pkg_type
    FROM clinic_packages WHERE id = _package_id;

    _pkg_valor_total := COALESCE(_pkg_valor_total, 0);

    -- A) Lançamento valor_total: paga uma vez no mês de associação do pacote
    IF _pkg_lancamento = 'valor_total' THEN
      IF _package_assigned_at IS NOT NULL
         AND EXTRACT(MONTH FROM _package_assigned_at) = _month
         AND EXTRACT(YEAR  FROM _package_assigned_at) = _year THEN
        _revenue := _revenue + _pkg_valor_total;
      END IF;

      -- Pacientes com pacote em modo "valor_total" não geram receita extra por sessão
      RETURN _revenue + _services_revenue;
    END IF;

    -- B) Lançamento valor_procedimento: por sessão
    IF _pkg_lancamento = 'valor_procedimento' THEN
      -- Calcula valor por sessão conforme tipo de pacote
      IF _pkg_type = 'por_sessao' THEN
        _per_session_value := _pkg_valor_total;
      ELSIF _pkg_type = 'personalizado' AND _pkg_session_limit IS NOT NULL AND _pkg_session_limit > 0 THEN
        _per_session_value := _pkg_valor_total / _pkg_session_limit;
      ELSIF _pkg_type = 'mensal' THEN
        -- divide pelo número real de sessões agendadas no mês (schedule_by_day OU weekdays)
        SELECT schedule_by_day, weekdays INTO _schedule_by_day, _weekdays
        FROM patients WHERE id = _patient_id;

        _ym_start := make_date(_year, _month, 1);
        _ym_end := (_ym_start + interval '1 month' - interval '1 day')::date;
        _sessions_scheduled_in_month := 0;
        _d := _ym_start;
        WHILE _d <= _ym_end LOOP
          _dow_label := CASE EXTRACT(DOW FROM _d)::int
            WHEN 0 THEN 'Domingo'
            WHEN 1 THEN 'Segunda'
            WHEN 2 THEN 'Terça'
            WHEN 3 THEN 'Quarta'
            WHEN 4 THEN 'Quinta'
            WHEN 5 THEN 'Sexta'
            WHEN 6 THEN 'Sábado'
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

      -- Para 'personalizado': respeitar teto de session_limit (ciclo único, sem renovação)
      IF _pkg_type = 'personalizado' AND _pkg_session_limit IS NOT NULL AND _pkg_session_limit > 0 THEN
        SELECT COUNT(*) INTO _sessions_used_total
        FROM evolutions e
        WHERE e.patient_id = _patient_id
          AND e.attendance_status IN ('presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado')
          AND (
            _package_assigned_at IS NULL
            OR e.date >= _package_assigned_at::date
          );
      END IF;

      _sessions_in_month := 0;

      -- Conta sessões do mês (em ordem cronológica, por causa do teto)
      FOR _evo IN
        SELECT e.id, e.group_id, e.date
        FROM evolutions e
        WHERE e.patient_id = _patient_id
          AND EXTRACT(MONTH FROM e.date) = _month
          AND EXTRACT(YEAR  FROM e.date) = _year
          AND e.attendance_status IN ('presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado')
          AND (_package_assigned_at IS NULL OR e.date >= _package_assigned_at::date)
        ORDER BY e.date ASC
      LOOP
        IF _evo.group_id IS NOT NULL THEN
          -- Sessões em grupo seguem a regra antiga (preço do grupo / membro)
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
          -- Sessão individual paga via pacote
          IF _pkg_type = 'personalizado' AND _pkg_session_limit IS NOT NULL AND _pkg_session_limit > 0 THEN
            -- Aplica teto: só conta enquanto (used antes do mês + count atual no mês) < session_limit
            DECLARE
              _used_before_month int;
            BEGIN
              SELECT COUNT(*) INTO _used_before_month
              FROM evolutions e2
              WHERE e2.patient_id = _patient_id
                AND e2.attendance_status IN ('presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado')
                AND e2.group_id IS NULL
                AND (_package_assigned_at IS NULL OR e2.date >= _package_assigned_at::date)
                AND e2.date < make_date(_year, _month, 1);

              IF (_used_before_month + _sessions_in_month) < _pkg_session_limit THEN
                _revenue := _revenue + _per_session_value;
                _sessions_in_month := _sessions_in_month + 1;
              END IF;
            END;
          ELSE
            -- mensal e por_sessao: renovação automática, sempre lança
            _revenue := _revenue + _per_session_value;
            _sessions_in_month := _sessions_in_month + 1;
          END IF;
        END IF;
      END LOOP;

      RETURN _revenue + _services_revenue;
    END IF;
  END IF;

  -- ============ FLUXO SEM PACOTE (legado) ============
  IF _payment_type IN ('fixo', 'mensal') THEN
    RETURN _payment_value + _services_revenue;
  END IF;

  FOR _evo IN
    SELECT e.id, e.group_id, e.attendance_status
    FROM evolutions e
    WHERE e.patient_id = _patient_id
      AND EXTRACT(MONTH FROM e.date) = _month
      AND EXTRACT(YEAR FROM e.date) = _year
      AND e.attendance_status IN ('presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado')
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