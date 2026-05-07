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
  return out;
}
