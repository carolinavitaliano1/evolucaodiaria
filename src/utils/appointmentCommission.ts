import { supabase } from '@/integrations/supabase/client';

/**
 * Cálculo de comissão baseado nos agendamentos com procedimento/pacote vinculados.
 * 
 * Regra:
 * - Apenas agendamentos com status billable contam (atendido/confirmado).
 * - Para cada agendamento:
 *    - Se tem procedure_id → base = procedure.value, lookup em procedure_commissions
 *      (por procedimento + member_id do terapeuta). Fallback: commission_type/value globais
 *      do procedimento.
 *    - Se tem package_id → base = clinic_package.price, lookup em package_commissions.
 * - Tipo 'porcentagem' → comissão = base * (valor/100). 'valor_fixo' → comissão = valor.
 */

export interface AppointmentCommissionRow {
  appointmentId: string;
  date: string;
  time: string;
  patientId: string | null;
  patientName?: string;
  source: 'procedure' | 'package' | 'none';
  sourceName: string;
  base: number;
  commission: number;
  commissionType?: 'valor_fixo' | 'porcentagem' | null;
  commissionValue?: number | null;
}

export interface AppointmentCommissionResult {
  rows: AppointmentCommissionRow[];
  totalBase: number;
  totalCommission: number;
}

const BILLABLE_STATUSES = new Set(['atendido', 'confirmado']);
const BILLABLE_EVO_STATUSES = new Set([
  'presente', 'reposicao', 'falta_remunerada', 'feriado_remunerado',
]);

interface CalcInput {
  /** uuid do user (auth.users.id) do terapeuta */
  therapistUserId: string;
  /** opcional: limita a uma clínica */
  clinicId?: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

export async function calculateCommissionFromAppointments(
  input: CalcInput,
): Promise<AppointmentCommissionResult> {
  // 1. Carrega o member_id do terapeuta (pode haver vários se for de várias orgs;
  //    pegamos o member_id da clínica em questão se fornecida).
  let memberIds: string[] = [];
  if (input.clinicId) {
    const { data: clinicRow } = await supabase
      .from('clinics')
      .select('organization_id')
      .eq('id', input.clinicId)
      .maybeSingle();
    const orgId = (clinicRow as any)?.organization_id;
    if (orgId) {
      const { data: m } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', input.therapistUserId)
        .eq('organization_id', orgId)
        .eq('status', 'active');
      memberIds = ((m || []) as any[]).map(r => r.id);
    }
  }
  if (memberIds.length === 0) {
    const { data: m } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', input.therapistUserId)
      .eq('status', 'active');
    memberIds = ((m || []) as any[]).map(r => r.id);
  }

  // 2. Carrega agendamentos do terapeuta no período
  let q = supabase
    .from('appointments' as any)
    .select('id, date, time, patient_id, status, procedure_id, package_id, clinic_id')
    .eq('therapist_user_id', input.therapistUserId)
    .gte('date', input.startDate)
    .lte('date', input.endDate);
  if (input.clinicId) q = q.eq('clinic_id', input.clinicId);
  const { data: appts } = await q;
  const allAppts = (appts || []) as any[];

  // Carrega evoluções faturáveis no período para considerar agendamentos
  // que ainda estão como 'agendado' mas que já tiveram presença registrada.
  const apptPatientIds = Array.from(new Set(allAppts.map(a => a.patient_id).filter(Boolean)));
  let evoKeySet = new Set<string>();
  if (apptPatientIds.length) {
    const { data: evos } = await supabase
      .from('evolutions')
      .select('patient_id, date, attendance_status, user_id')
      .in('patient_id', apptPatientIds)
      .gte('date', input.startDate)
      .lte('date', input.endDate)
      .eq('user_id', input.therapistUserId);
    ((evos || []) as any[]).forEach(e => {
      if (BILLABLE_EVO_STATUSES.has(e.attendance_status)) {
        evoKeySet.add(`${e.patient_id}|${e.date}`);
      }
    });
  }

  const appointments = allAppts.filter(a =>
    BILLABLE_STATUSES.has(a.status) || evoKeySet.has(`${a.patient_id}|${a.date}`)
  );

  if (appointments.length === 0) {
    return { rows: [], totalBase: 0, totalCommission: 0 };
  }

  const procIds = Array.from(new Set(appointments.map(a => a.procedure_id).filter(Boolean)));
  const pkgIds = Array.from(new Set(appointments.map(a => a.package_id).filter(Boolean)));
  const patientIds = Array.from(new Set(appointments.map(a => a.patient_id).filter(Boolean)));

  const [procRes, pkgRes, patRes, procCommRes, pkgCommRes] = await Promise.all([
    procIds.length
      ? supabase.from('procedures').select('id, name, value, commission_type, commission_value').in('id', procIds)
      : Promise.resolve({ data: [] as any[] }),
    pkgIds.length
      ? supabase.from('clinic_packages').select('id, name, price').in('id', pkgIds)
      : Promise.resolve({ data: [] as any[] }),
    patientIds.length
      ? supabase.from('patients').select('id, name').in('id', patientIds)
      : Promise.resolve({ data: [] as any[] }),
    procIds.length && memberIds.length
      ? supabase.from('procedure_commissions' as any)
          .select('procedure_id, member_id, commission_value, commission_type')
          .in('procedure_id', procIds)
          .in('member_id', memberIds)
      : Promise.resolve({ data: [] as any[] }),
    pkgIds.length && memberIds.length
      ? supabase.from('package_commissions' as any)
          .select('package_id, member_id, commission_value, commission_type')
          .in('package_id', pkgIds)
          .in('member_id', memberIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const procMap = new Map<string, any>(((procRes.data || []) as any[]).map(p => [p.id, p]));
  const pkgMap = new Map<string, any>(((pkgRes.data || []) as any[]).map(p => [p.id, p]));
  const patMap = new Map<string, any>(((patRes.data || []) as any[]).map(p => [p.id, p]));
  const procCommMap = new Map<string, any>(
    ((procCommRes.data || []) as any[]).map(c => [c.procedure_id, c]),
  );
  const pkgCommMap = new Map<string, any>(
    ((pkgCommRes.data || []) as any[]).map(c => [c.package_id, c]),
  );

  const rows: AppointmentCommissionRow[] = appointments.map(a => {
    let source: 'procedure' | 'package' | 'none' = 'none';
    let sourceName = '—';
    let base = 0;
    let commType: 'valor_fixo' | 'porcentagem' | null = null;
    let commVal: number | null = null;

    if (a.procedure_id && procMap.has(a.procedure_id)) {
      source = 'procedure';
      const proc = procMap.get(a.procedure_id);
      sourceName = proc.name;
      base = Number(proc.value || 0);
      const override = procCommMap.get(a.procedure_id);
      if (override) {
        commType = override.commission_type;
        commVal = Number(override.commission_value || 0);
      } else {
        commType = proc.commission_type;
        commVal = Number(proc.commission_value || 0);
      }
    } else if (a.package_id && pkgMap.has(a.package_id)) {
      source = 'package';
      const pkg = pkgMap.get(a.package_id);
      sourceName = `Pacote: ${pkg.name}`;
      base = Number(pkg.price || 0);
      const override = pkgCommMap.get(a.package_id);
      if (override) {
        commType = override.commission_type;
        commVal = Number(override.commission_value || 0);
      }
    }

    let commission = 0;
    if (commType && commVal != null) {
      commission = commType === 'porcentagem' ? base * (commVal / 100) : commVal;
    }

    const pat = a.patient_id ? patMap.get(a.patient_id) : null;
    return {
      appointmentId: a.id,
      date: a.date,
      time: a.time,
      patientId: a.patient_id,
      patientName: pat?.name,
      source,
      sourceName,
      base,
      commission,
      commissionType: commType,
      commissionValue: commVal,
    };
  });

  const totalBase = rows.reduce((s, r) => s + r.base, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);

  return { rows, totalBase, totalCommission };
}
