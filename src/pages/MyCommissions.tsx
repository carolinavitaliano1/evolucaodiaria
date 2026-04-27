import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, DollarSign, Users, CheckCircle2, XCircle, TrendingUp, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  calculateMemberRemunerationByPlans,
  isBillableStatus,
  isSessionStatus,
  type RemunerationPlan,
  type PlanBreakdownEntry,
} from '@/utils/financialHelpers';
import { toLocalDateString } from '@/lib/utils';

interface MemberRow {
  id: string;
  organization_id: string;
  remuneration_type: string | null;
  remuneration_value: number | null;
  role_label: string | null;
}

const REM_TYPE_LABEL: Record<string, string> = {
  por_sessao: 'Por sessão',
  fixo_mensal: 'Fixo mensal',
  fixo_dia: 'Fixo por dia trabalhado',
  pacote: 'Pacote',
  definir_depois: 'A definir',
};

const planTypeShortLabel = (t: string) =>
  t === 'por_sessao' ? 'sessão'
  : t === 'fixo_mensal' ? 'mensal'
  : t === 'fixo_dia' ? 'diário'
  : t === 'pacote' ? 'pacote'
  : t;

export default function MyCommissions() {
  const { user } = useAuth();
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, { name: string }>>({});
  const [history, setHistory] = useState<{ month: string; total: number }[]>([]);
  const [plans, setPlans] = useState<RemunerationPlan[]>([]);
  const [assignmentPlanMap, setAssignmentPlanMap] = useState<Record<string, string | null>>({});

  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    const { data: m } = await supabase
      .from('organization_members')
      .select('id, organization_id, remuneration_type, remuneration_value, role_label')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    setMember(m as any);

    // Múltiplos planos do membro + atribuições por paciente
    let memberPlans: RemunerationPlan[] = [];
    const planMap: Record<string, string | null> = {};
    if (m?.id) {
      const [plansRes, assignsRes] = await Promise.all([
        supabase
          .from('member_remuneration_plans' as any)
          .select('id, member_id, name, remuneration_type, remuneration_value, is_default, package_id')
          .eq('member_id', m.id)
          .order('is_default', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('therapist_patient_assignments')
          .select('patient_id, remuneration_plan_id')
          .eq('member_id', m.id),
      ]);
      memberPlans = ((plansRes.data ?? []) as any[]).map((p: any) => ({
        id: p.id,
        member_id: p.member_id,
        name: p.name,
        remuneration_type: p.remuneration_type,
        remuneration_value: Number(p.remuneration_value) || 0,
        is_default: !!p.is_default,
        package_id: p.package_id ?? null,
      }));
      ((assignsRes.data ?? []) as any[]).forEach((a: any) => {
        planMap[a.patient_id] = a.remuneration_plan_id ?? null;
      });
    }
    setPlans(memberPlans);
    setAssignmentPlanMap(planMap);

    const startStr = toLocalDateString(monthStart);
    const endStr = toLocalDateString(monthEnd);

    const { data: evos } = await supabase
      .from('evolutions')
      .select('id, patient_id, date, attendance_status, group_id, clinic_id')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .lte('date', endStr);

    const evoList = (evos ?? []).map(e => ({
      id: e.id,
      patientId: e.patient_id,
      date: e.date,
      attendanceStatus: e.attendance_status,
      groupId: e.group_id,
    }));
    setEvolutions(evoList);

    const patientIds = Array.from(new Set(evoList.map(e => e.patientId).filter(Boolean)));
    if (patientIds.length) {
      const { data: pats } = await supabase
        .from('patients')
        .select('id, name')
        .in('id', patientIds);
      const map: Record<string, { name: string }> = {};
      (pats ?? []).forEach(p => { map[p.id] = { name: p.name }; });
      setPatientsMap(map);
    } else {
      setPatientsMap({});
    }

    // Histórico últimos 6 meses (precisa de patient_id para resolver plano por paciente)
    const sixAgo = startOfMonth(subMonths(refDate, 5));
    const { data: histEvos } = await supabase
      .from('evolutions')
      .select('patient_id, date, attendance_status, group_id')
      .eq('user_id', user.id)
      .gte('date', toLocalDateString(sixAgo))
      .lte('date', toLocalDateString(monthEnd));
    const histMap: Record<string, any[]> = {};
    (histEvos ?? []).forEach(e => {
      const key = e.date.slice(0, 7);
      if (!histMap[key]) histMap[key] = [];
      histMap[key].push({
        patientId: e.patient_id,
        attendanceStatus: e.attendance_status,
        date: e.date,
        groupId: e.group_id,
      });
    });
    const hist: { month: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(refDate, i);
      const key = format(d, 'yyyy-MM');
      const evList = histMap[key] ?? [];
      const { total } = calculateMemberRemunerationByPlans({
        plans: memberPlans,
        assignmentPlanMap: planMap,
        evolutions: evList as any,
        legacyType: m?.remuneration_type ?? null,
        legacyValue: m?.remuneration_value ? Number(m.remuneration_value) : null,
      });
      hist.push({ month: format(d, 'MMM/yy', { locale: ptBR }), total });
    }
    setHistory(hist);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, refDate]);

  // Realtime: recarrega quando planos do membro ou atribuições mudam
  useEffect(() => {
    if (!member?.id) return;
    const channel = supabase
      .channel(`my-commissions-${member.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'member_remuneration_plans', filter: `member_id=eq.${member.id}` },
        () => { loadAll(); },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'therapist_patient_assignments', filter: `member_id=eq.${member.id}` },
        () => { loadAll(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.id]);

  // Cálculo principal usando múltiplos planos
  const remunerationCalc = useMemo(() => {
    return calculateMemberRemunerationByPlans({
      plans,
      assignmentPlanMap,
      evolutions: evolutions as any,
      legacyType: member?.remuneration_type ?? null,
      legacyValue: member?.remuneration_value ? Number(member.remuneration_value) : null,
    });
  }, [plans, assignmentPlanMap, evolutions, member]);

  const totalCommission = remunerationCalc.total;
  const breakdown = remunerationCalc.breakdown;
  const usedLegacy = remunerationCalc.usedLegacy;

  const defaultPlan = plans.find(p => p.is_default) || plans[0] || null;
  const resolvePlanForPatient = (patientId: string): RemunerationPlan | null => {
    const planId = assignmentPlanMap[patientId];
    if (planId) {
      const found = plans.find(p => p.id === planId);
      if (found) return found;
    }
    return defaultPlan;
  };

  const billableCount = evolutions.filter(e => isBillableStatus(e.attendanceStatus)).length;
  const sessionsCount = evolutions.filter(e => isSessionStatus(e.attendanceStatus)).length;
  const absencesCount = evolutions.filter(e => e.attendanceStatus === 'falta').length;
  const uniquePatients = new Set(evolutions.filter(e => e.patientId).map(e => e.patientId)).size;

  // Detalhamento por paciente
  const perPatient = useMemo(() => {
    const map: Record<string, { name: string; sessions: number; billable: number; absences: number }> = {};
    evolutions.forEach(e => {
      if (!e.patientId) return;
      const k = e.patientId;
      if (!map[k]) map[k] = { name: patientsMap[k]?.name ?? 'Paciente', sessions: 0, billable: 0, absences: 0 };
      if (isSessionStatus(e.attendanceStatus)) map[k].sessions++;
      if (isBillableStatus(e.attendanceStatus)) map[k].billable++;
      if (e.attendanceStatus === 'falta') map[k].absences++;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.billable - a.billable);
  }, [evolutions, patientsMap]);

  // Subtotal por linha (só faz sentido para planos por_sessao)
  // Subtotal por linha — agora também suporta plano "pacote" (valor fixo por paciente/mês).
  const subtotalForPatient = (patientId: string, billable: number): number | null => {
    const plan = resolvePlanForPatient(patientId);
    if (!plan) {
      if (member?.remuneration_type === 'por_sessao' && member.remuneration_value) {
        return billable * Number(member.remuneration_value);
      }
      if (member?.remuneration_type === 'pacote' && member.remuneration_value) {
        return billable > 0 ? Number(member.remuneration_value) : 0;
      }
      return null;
    }
    if (plan.remuneration_type === 'por_sessao') {
      return billable * Number(plan.remuneration_value);
    }
    if (plan.remuneration_type === 'pacote') {
      return billable > 0 ? Number(plan.remuneration_value) : 0;
    }
    return null;
  };

  // Valor por sessão exibido na tabela: pacote → total ÷ sessões realizadas no mês
  // (ex: R$ 300 / 4 sessões = R$ 75 por sessão). Por sessão → o próprio valor do plano.
  const perSessionForPatient = (patientId: string, billable: number): number | null => {
    const plan = resolvePlanForPatient(patientId);
    const type = plan?.remuneration_type ?? member?.remuneration_type ?? null;
    const value = plan ? Number(plan.remuneration_value) : Number(member?.remuneration_value ?? 0);
    if (!type || !value) return null;
    if (type === 'por_sessao') return value;
    if (type === 'pacote') return billable > 0 ? value / billable : value;
    return null;
  };

  const showSubtotalColumn = perPatient.some(p => {
    const plan = resolvePlanForPatient(p.id);
    const type = plan?.remuneration_type ?? member?.remuneration_type ?? null;
    if (type === 'por_sessao' || type === 'pacote') {
      const value = plan ? Number(plan.remuneration_value) : Number(member?.remuneration_value ?? 0);
      return !!value;
    }
    return false;
  });

  const showPerSessionColumn = showSubtotalColumn;

  const maxHist = Math.max(...history.map(h => h.total), 1);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-24 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-primary" /> Minhas Comissões
          </h1>
          <p className="text-sm text-muted-foreground">
            Seus ganhos com base nos atendimentos registrados.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setRefDate(subMonths(refDate, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-[140px] text-center">
            {format(refDate, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => setRefDate(addMonths(refDate, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Modelo de remuneração */}
      {member && (
        <Card className="p-4 bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Modelo de remuneração</p>
              {plans.length > 0 ? (
                <>
                  <p className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {plans.length} {plans.length === 1 ? 'plano cadastrado' : 'planos cadastrados'}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {plans.map(p => (
                      <Badge
                        key={p.id}
                        variant={p.is_default ? 'default' : 'secondary'}
                        className="text-[11px]"
                      >
                        {p.name} · R$ {Number(p.remuneration_value).toFixed(2)}/{planTypeShortLabel(p.remuneration_type)}
                        {p.is_default && plans.length > 1 ? ' ★' : ''}
                      </Badge>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-base font-semibold text-foreground">
                  {REM_TYPE_LABEL[member.remuneration_type ?? 'definir_depois'] ?? 'A definir'}
                  {member.remuneration_type === 'por_sessao' && member.remuneration_value && (
                    <Badge variant="secondary" className="ml-2">
                      R$ {Number(member.remuneration_value).toFixed(2)} / sessão
                    </Badge>
                  )}
                </p>
              )}
            </div>
            {member.role_label && (
              <Badge variant="outline">{member.role_label}</Badge>
            )}
          </div>
          {plans.length === 0 && (!member.remuneration_type || member.remuneration_type === 'definir_depois') && (
            <p className="mt-2 text-xs text-amber-600">
              ⚠️ Sua remuneração ainda não foi definida pelo administrador da clínica. Solicite a configuração para visualizar seus ganhos.
            </p>
          )}
        </Card>
      )}

      {/* Cards resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total a receber</span>
            <DollarSign className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">
            R$ {totalCommission.toFixed(2)}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Sessões realizadas</span>
            <CheckCircle2 className="w-4 h-4 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{sessionsCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{billableCount} faturáveis</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Faltas</span>
            <XCircle className="w-4 h-4 text-destructive" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{absencesCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Pacientes atendidos</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground mt-1">{uniquePatients}</p>
        </Card>
      </div>

      {/* Detalhamento por modalidade (planos) */}
      {!usedLegacy && breakdown.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Detalhamento por modalidade</h2>
          </div>
          <div className="space-y-2">
            {breakdown.map((b: PlanBreakdownEntry) => {
              const daysForPlan = b.type === 'fixo_dia'
                ? new Set(
                    evolutions
                      .filter(e =>
                        isBillableStatus(e.attendanceStatus) &&
                        ((assignmentPlanMap[e.patientId] || defaultPlan?.id) === b.planId),
                      )
                      .map(e => e.date),
                  ).size
                : 0;
              const countLabel =
                b.type === 'por_sessao' ? `${b.sessionsCount} sessão${b.sessionsCount !== 1 ? 'ões' : ''}`
                : b.type === 'fixo_dia' ? `${daysForPlan} dia${daysForPlan !== 1 ? 's' : ''}`
                : b.type === 'pacote' ? `${b.patientsCount} paciente${b.patientsCount !== 1 ? 's' : ''}`
                : 'mensal';
              return (
                <div key={b.planId} className="flex items-center justify-between gap-3 p-2.5 rounded-md border bg-muted/20">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{b.planName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {REM_TYPE_LABEL[b.type] ?? b.type} · R$ {Number(b.value).toFixed(2)} · {countLabel}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground shrink-0">
                    R$ {b.subtotal.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Histórico 6 meses */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Histórico (últimos 6 meses)</h2>
        </div>
        <div className="flex items-end gap-3 h-32">
          {history.map(h => (
            <div key={h.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors"
                   style={{ height: `${(h.total / maxHist) * 100}%`, minHeight: h.total > 0 ? '4px' : '2px' }}
                   title={`R$ ${h.total.toFixed(2)}`} />
              <span className="text-[10px] text-muted-foreground capitalize">{h.month}</span>
              <span className="text-[10px] font-medium">R${h.total.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Detalhamento por paciente */}
      <Card className="p-5">
        <h2 className="text-sm font-semibold mb-3">Detalhamento por paciente</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : perPatient.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum atendimento registrado neste mês.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paciente</TableHead>
                {plans.length > 0 && <TableHead>Plano</TableHead>}
                <TableHead className="text-center">Sessões</TableHead>
                <TableHead className="text-center">Faturáveis</TableHead>
                <TableHead className="text-center">Faltas</TableHead>
                {showPerSessionColumn && <TableHead className="text-right">Valor/sessão</TableHead>}
                {showSubtotalColumn && <TableHead className="text-right">Subtotal</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perPatient.map(p => {
                const plan = resolvePlanForPatient(p.id);
                const subtotal = subtotalForPatient(p.id, p.billable);
                const perSessionVal = perSessionForPatient(p.id, p.billable);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    {plans.length > 0 && (
                      <TableCell>
                        {plan ? (
                          <Badge variant="outline" className="text-[10px]">
                            {plan.name}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-center">{p.sessions}</TableCell>
                    <TableCell className="text-center">{p.billable}</TableCell>
                    <TableCell className="text-center">{p.absences}</TableCell>
                    {showPerSessionColumn && (
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {perSessionVal !== null
                          ? `R$ ${perSessionVal.toFixed(2)}`
                          : <span>—</span>}
                      </TableCell>
                    )}
                    {showSubtotalColumn && (
                      <TableCell className="text-right font-medium">
                        {subtotal !== null
                          ? `R$ ${subtotal.toFixed(2)}`
                          : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
