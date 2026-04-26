import { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, DollarSign, Users, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calculateMemberRemuneration, isBillableStatus, isSessionStatus } from '@/utils/financialHelpers';
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
  definir_depois: 'A definir',
};

export default function MyCommissions() {
  const { user } = useAuth();
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [member, setMember] = useState<MemberRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [evolutions, setEvolutions] = useState<any[]>([]);
  const [patientsMap, setPatientsMap] = useState<Record<string, { name: string }>>({});
  const [history, setHistory] = useState<{ month: string; total: number }[]>([]);

  const monthStart = startOfMonth(refDate);
  const monthEnd = endOfMonth(refDate);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: m } = await supabase
        .from('organization_members')
        .select('id, organization_id, remuneration_type, remuneration_value, role_label')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      setMember(m as any);

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

      // Histórico últimos 6 meses
      const sixAgo = startOfMonth(subMonths(refDate, 5));
      const { data: histEvos } = await supabase
        .from('evolutions')
        .select('date, attendance_status')
        .eq('user_id', user.id)
        .gte('date', toLocalDateString(sixAgo))
        .lte('date', toLocalDateString(monthEnd));
      const histMap: Record<string, any[]> = {};
      (histEvos ?? []).forEach(e => {
        const key = e.date.slice(0, 7);
        if (!histMap[key]) histMap[key] = [];
        histMap[key].push({ attendanceStatus: e.attendance_status, date: e.date });
      });
      const hist: { month: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(refDate, i);
        const key = format(d, 'yyyy-MM');
        const evList = histMap[key] ?? [];
        const total = calculateMemberRemuneration({
          remunerationType: m?.remuneration_type ?? null,
          remunerationValue: m?.remuneration_value ? Number(m.remuneration_value) : null,
          evolutions: evList as any,
        });
        hist.push({ month: format(d, 'MMM/yy', { locale: ptBR }), total });
      }
      setHistory(hist);

      setLoading(false);
    })();
  }, [user, refDate]);

  const totalCommission = useMemo(() => {
    if (!member) return 0;
    return calculateMemberRemuneration({
      remunerationType: member.remuneration_type,
      remunerationValue: member.remuneration_value ? Number(member.remuneration_value) : null,
      evolutions: evolutions as any,
    });
  }, [member, evolutions]);

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

  const valuePerSession = member?.remuneration_type === 'por_sessao' && member.remuneration_value
    ? Number(member.remuneration_value) : null;
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
            <div>
              <p className="text-xs text-muted-foreground">Modelo de remuneração</p>
              <p className="text-base font-semibold text-foreground">
                {REM_TYPE_LABEL[member.remuneration_type ?? 'definir_depois'] ?? 'A definir'}
                {valuePerSession !== null && (
                  <Badge variant="secondary" className="ml-2">R$ {valuePerSession.toFixed(2)} / sessão</Badge>
                )}
              </p>
            </div>
            {member.role_label && (
              <Badge variant="outline">{member.role_label}</Badge>
            )}
          </div>
          {(!member.remuneration_type || member.remuneration_type === 'definir_depois') && (
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
                <TableHead className="text-center">Sessões</TableHead>
                <TableHead className="text-center">Faturáveis</TableHead>
                <TableHead className="text-center">Faltas</TableHead>
                {valuePerSession !== null && <TableHead className="text-right">Subtotal</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {perPatient.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-center">{p.sessions}</TableCell>
                  <TableCell className="text-center">{p.billable}</TableCell>
                  <TableCell className="text-center">{p.absences}</TableCell>
                  {valuePerSession !== null && (
                    <TableCell className="text-right font-medium">
                      R$ {(p.billable * valuePerSession).toFixed(2)}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}