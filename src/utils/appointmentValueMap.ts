import { supabase } from '@/integrations/supabase/client';

/**
 * Para cada paciente em `patientIds`, retorna um mapa
 *   patientId → { 'YYYY-MM-DD' → valor da sessão }
 *
 * Valor da sessão = valor do procedimento vinculado ao agendamento daquela
 * data; fallback para preço do clinic_package quando o agendamento tem
 * package_id em vez de procedure_id. Quando o agendamento não tem nenhum
 * dos dois, a data é omitida e o chamador cai na sua regra default
 * (paymentValue do paciente, etc.).
 *
 * Usa o intervalo [startDate, endDate] (YYYY-MM-DD).
 */
export async function loadAppointmentValueMap(params: {
  patientIds: string[];
  startDate: string;
  endDate: string;
}): Promise<Record<string, Record<string, number>>> {
  const { patientIds, startDate, endDate } = params;
  if (!patientIds.length) return {};

  const { data: appts } = await supabase
    .from('appointments' as any)
    .select('patient_id, date, procedure_id, package_id')
    .in('patient_id', patientIds)
    .gte('date', startDate)
    .lte('date', endDate);

  const rows = (appts || []) as any[];
  const procIds = Array.from(new Set(rows.map(r => r.procedure_id).filter(Boolean)));
  const pkgIds = Array.from(new Set(rows.map(r => r.package_id).filter(Boolean)));

  const [procRes, pkgRes] = await Promise.all([
    procIds.length
      ? supabase.from('procedures').select('id, value').in('id', procIds)
      : Promise.resolve({ data: [] as any[] }),
    pkgIds.length
      ? supabase.from('clinic_packages').select('id, price').in('id', pkgIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const procMap = new Map<string, number>(
    ((procRes.data || []) as any[]).map(p => [p.id, Number(p.value || 0)]),
  );
  const pkgMap = new Map<string, number>(
    ((pkgRes.data || []) as any[]).map(p => [p.id, Number(p.price || 0)]),
  );

  const out: Record<string, Record<string, number>> = {};
  for (const r of rows) {
    let v = 0;
    if (r.procedure_id && procMap.has(r.procedure_id)) v = procMap.get(r.procedure_id) || 0;
    else if (r.package_id && pkgMap.has(r.package_id)) v = pkgMap.get(r.package_id) || 0;
    if (v <= 0) continue;
    if (!out[r.patient_id]) out[r.patient_id] = {};
    // Se múltiplos agendamentos no mesmo dia, mantém o maior (procedimento > pacote já priorizado acima)
    const cur = out[r.patient_id][r.date] || 0;
    if (v > cur) out[r.patient_id][r.date] = v;
  }

  // ============================================================================
  // Histórico de repasse da clínica (clinic_payment_history)
  // Para cada evolução do período sem valor vindo de procedure/package, aplica
  // o valor vigente na clínica naquela data — espelha get_patient_monthly_revenue.
  // ============================================================================
  try {
    const [patientsRes, evosRes] = await Promise.all([
      supabase.from('patients').select('id, clinic_id').in('id', patientIds),
      supabase.from('evolutions').select('patient_id, date')
        .in('patient_id', patientIds)
        .gte('date', startDate)
        .lte('date', endDate),
    ]);
    const patientClinic = new Map<string, string | null>(
      ((patientsRes.data || []) as any[]).map(p => [p.id, p.clinic_id || null]),
    );
    const clinicIds = Array.from(new Set(
      (patientsRes.data || []).map((p: any) => p.clinic_id).filter(Boolean)
    ));
    if (clinicIds.length > 0) {
      const { data: histRows } = await supabase
        .from('clinic_payment_history')
        .select('clinic_id, effective_from, payment_amount')
        .in('clinic_id', clinicIds)
        .order('effective_from', { ascending: false });
      const histByClinic = new Map<string, { effective_from: string; payment_amount: number }[]>();
      for (const h of (histRows || []) as any[]) {
        const arr = histByClinic.get(h.clinic_id) || [];
        arr.push({ effective_from: h.effective_from, payment_amount: Number(h.payment_amount || 0) });
        histByClinic.set(h.clinic_id, arr);
      }
      const valueOnDate = (clinicId: string, date: string): number | null => {
        const arr = histByClinic.get(clinicId);
        if (!arr || !arr.length) return null;
        // arr already ordered desc by effective_from
        for (const row of arr) {
          if (row.effective_from <= date) return row.payment_amount;
        }
        return null;
      };
      for (const e of (evosRes.data || []) as any[]) {
        const pid = e.patient_id as string;
        const date = e.date as string;
        if (out[pid]?.[date]) continue; // já tem valor de proc/pkg
        const cid = patientClinic.get(pid);
        if (!cid) continue;
        const v = valueOnDate(cid, date);
        if (v == null || v <= 0) continue;
        if (!out[pid]) out[pid] = {};
        out[pid][date] = v;
      }
    }
  } catch (err) {
    console.warn('[appointmentValueMap] clinic_payment_history fallback skipped', err);
  }

  return out;
}
