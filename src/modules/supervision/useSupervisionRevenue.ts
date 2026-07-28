import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BILLABLE_STATUSES } from './types';

export interface SupervisionRevenue {
  /** Faturamento previsto de supervisão no mês. */
  revenue: number;
  /** Total já recebido (registros de pagamento marcados como pagos). */
  paid: number;
  /** Sessões faturáveis no mês. */
  sessionCount: number;
  /** Supervisionandos com movimentação no mês. */
  superviseeCount: number;
  loading: boolean;
  reload: () => void;
}

/**
 * Receita do módulo de Supervisão para um mês/ano.
 * - `payment_type = 'sessao'`: valor × sessões faturáveis (presente/falta cobrada).
 * - `payment_type = 'mensal'`: mensalidade cobrada se houve ao menos uma sessão faturável.
 */
export function useSupervisionRevenue(month: number, year: number): SupervisionRevenue {
  const [state, setState] = useState({ revenue: 0, paid: 0, sessionCount: 0, superviseeCount: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const [{ data: supervisees }, { data: sessions }, { data: payments }] = await Promise.all([
      supabase.from('supervisees').select('id, payment_type, payment_value, status'),
      supabase.from('supervision_sessions').select('id, supervisee_id, attendance_status, date')
        .gte('date', iso(start)).lte('date', iso(end)),
      supabase.from('supervision_payments').select('amount, status, reference_month, reference_year')
        .eq('reference_month', month + 1).eq('reference_year', year),
    ]);

    const billable = (sessions || []).filter((s: any) => BILLABLE_STATUSES.includes(s.attendance_status));
    const bySupervisee = new Map<string, number>();
    billable.forEach((s: any) => bySupervisee.set(s.supervisee_id, (bySupervisee.get(s.supervisee_id) || 0) + 1));

    let revenue = 0;
    (supervisees || []).forEach((sv: any) => {
      const count = bySupervisee.get(sv.id) || 0;
      const value = Number(sv.payment_value) || 0;
      if (!value) return;
      if (sv.payment_type === 'mensal') {
        if (count > 0) revenue += value;
      } else {
        revenue += value * count;
      }
    });

    const paid = (payments || [])
      .filter((p: any) => p.status === 'pago')
      .reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

    setState({
      revenue,
      paid,
      sessionCount: billable.length,
      superviseeCount: bySupervisee.size,
    });
    setLoading(false);
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  return { ...state, loading, reload: load };
}
