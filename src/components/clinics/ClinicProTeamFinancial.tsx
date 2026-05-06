import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign, TrendingUp, ChevronLeft, ChevronRight, Crown, Shield, User,
  Loader2, Trophy, Medal, Receipt, Briefcase, Wallet,
} from 'lucide-react';
import { format, subMonths, addMonths, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateCommissionFromAppointments, type AppointmentCommissionRow } from '@/utils/appointmentCommission';
import { toLocalDateString } from '@/lib/utils';

interface Props {
  clinicId: string;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  professional: <User className="w-3 h-3" />,
};

const RANK_ICONS = [
  <Trophy key="1" className="w-4 h-4 text-yellow-500" />,
  <Medal key="2" className="w-4 h-4 text-slate-400" />,
  <Medal key="3" className="w-4 h-4 text-amber-600" />,
];

interface MemberAggregate {
  userId: string;
  rows: AppointmentCommissionRow[];
  totalBase: number;
  totalCommission: number;
  appointmentsCount: number;
}

/**
 * Painel de Equipe específico para clínicas tipo "clinica" (Clínica Pro).
 * Lê os agendamentos do mês com procedure_id/package_id e usa
 * `calculateCommissionFromAppointments` para apurar:
 *  - Faturamento bruto (soma das bases dos procedimentos/pacotes)
 *  - Comissão de cada profissional (override por procedimento_commissions/package_commissions
 *    com fallback no commission_type/value globais do procedimento)
 *  - Saldo da clínica (faturamento − comissões)
 */
export function ClinicProTeamFinancial({ clinicId }: Props) {
  const { clinics } = useApp();
  const { user } = useAuth();
  const { members, loading: orgLoading, isOrg } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [calcLoading, setCalcLoading] = useState(false);
  const [byMember, setByMember] = useState<MemberAggregate[]>([]);

  const clinic = clinics.find(c => c.id === clinicId);
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const myMember = members.find(m => m.userId === user?.id);
  const canSeeAll = myMember?.role === 'owner' || myMember?.role === 'admin';

  // Recarrega comissões sempre que mês ou clínica mudar
  useEffect(() => {
    if (!isOrg || members.length === 0) {
      setByMember([]);
      return;
    }
    const start = toLocalDateString(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    const end = toLocalDateString(endOfMonth(selectedDate));
    setCalcLoading(true);
    Promise.all(
      members.map(async (m) => {
        const res = await calculateCommissionFromAppointments({
          therapistUserId: m.userId,
          clinicId,
          startDate: start,
          endDate: end,
        });
        return {
          userId: m.userId,
          rows: res.rows,
          totalBase: res.totalBase,
          totalCommission: res.totalCommission,
          appointmentsCount: res.rows.length,
        } satisfies MemberAggregate;
      }),
    )
      .then(setByMember)
      .finally(() => setCalcLoading(false));
  }, [clinicId, members, selectedDate, isOrg]);

  // Recortes para os totais
  const filteredAggregates = useMemo(() => {
    if (filterMemberId === 'all') return byMember;
    return byMember.filter(b => b.userId === filterMemberId);
  }, [byMember, filterMemberId]);

  const totalBase = filteredAggregates.reduce((s, b) => s + b.totalBase, 0);
  const totalCommission = filteredAggregates.reduce((s, b) => s + b.totalCommission, 0);
  const totalClinicShare = totalBase - totalCommission;
  const totalAppointments = filteredAggregates.reduce((s, b) => s + b.appointmentsCount, 0);

  // Ranking ordenado pelo total de comissão de cada profissional
  const ranking = useMemo(() => {
    return [...byMember]
      .map(b => ({
        ...b,
        member: members.find(m => m.userId === b.userId),
      }))
      .filter(b => b.member)
      .sort((a, b) => b.totalCommission - a.totalCommission);
  }, [byMember, members]);

  const maxCommission = ranking[0]?.totalCommission || 1;

  // Detalhamento por paciente (linhas planas dos rows filtrados)
  const patientBreakdown = useMemo(() => {
    const map = new Map<string, { patientId: string | null; patientName: string; sessions: number; base: number; commission: number }>();
    filteredAggregates.forEach(agg => {
      agg.rows.forEach(r => {
        const key = r.patientId || `__sem__${r.patientName || 'Sem paciente'}`;
        const cur = map.get(key) || {
          patientId: r.patientId,
          patientName: r.patientName || 'Sem paciente',
          sessions: 0,
          base: 0,
          commission: 0,
        };
        cur.sessions += 1;
        cur.base += r.base;
        cur.commission += r.commission;
        map.set(key, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.base - a.base);
  }, [filteredAggregates]);

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOrg) return null;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-bold text-foreground capitalize min-w-[140px] sm:min-w-[160px] text-center text-sm">{monthName}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        {canSeeAll && (
          <Select value={filterMemberId} onValueChange={setFilterMemberId}>
            <SelectTrigger className="h-8 text-sm w-full sm:w-auto sm:min-w-[200px]">
              <SelectValue placeholder="Profissional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              {members.map(m => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name || m.email}{m.userId === user?.id ? ' (você)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary cards (refletem a realidade da clínica:
          faturamento bruto, comissões pagas à equipe, saldo da clínica e nº de atendimentos). */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <Briefcase className="w-5 h-5 text-success" />
          <p className="text-xs text-muted-foreground mt-2">Faturamento Bruto</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            R$ {totalBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Soma de procedimentos/pacotes</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <Receipt className="w-5 h-5 text-primary" />
          <p className="text-xs text-muted-foreground mt-2">Comissões da Equipe</p>
          <p className="text-lg font-bold text-foreground mt-0.5">
            R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">A pagar aos profissionais</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <Wallet className="w-5 h-5 text-emerald-500" />
          <p className="text-xs text-muted-foreground mt-2">Saldo da Clínica</p>
          <p className={cn(
            'text-lg font-bold mt-0.5',
            totalClinicShare >= 0 ? 'text-foreground' : 'text-destructive',
          )}>
            R$ {totalClinicShare.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Faturamento − Comissões</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <TrendingUp className="w-5 h-5 text-violet-500" />
          <p className="text-xs text-muted-foreground mt-2">Atendimentos</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{totalAppointments}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Realizados/confirmados</p>
        </div>
      </div>

      {calcLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Calculando comissões…
        </div>
      )}

      {/* Ranking de profissionais */}
      {canSeeAll && filterMemberId === 'all' && ranking.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-yellow-500" /> Ranking de Profissionais
          </h3>
          <div className="space-y-3">
            {ranking.map(({ member, totalCommission: comm, totalBase: base, appointmentsCount }, i) => (
              <div key={member!.userId} className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-secondary/30 border-border',
              )}>
                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                  {i < 3 ? RANK_ICONS[i] : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  {ROLE_ICONS[member!.role]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {member!.name || member!.email}
                    {member!.userId === user?.id && (
                      <span className="text-xs text-muted-foreground ml-1 font-normal">(você)</span>
                    )}
                  </p>
                  <Progress value={maxCommission > 0 ? (comm / maxCommission) * 100 : 0} className="h-1.5 my-1" />
                  <p className="text-xs text-muted-foreground">
                    {appointmentsCount} atendimento{appointmentsCount !== 1 ? 's' : ''} · Faturado R$ {base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <p className={cn('font-bold shrink-0 text-sm', i === 0 ? 'text-primary' : 'text-foreground')}>
                  R$ {comm.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <p className="font-bold text-foreground text-sm">Total Comissões</p>
              <p className="font-bold text-foreground">
                R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Detalhamento por paciente */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="font-bold text-foreground mb-4 text-sm">
          Detalhamento por Paciente
          {filterMemberId !== 'all' && (
            <span className="font-normal text-muted-foreground ml-2">
              — {members.find(m => m.userId === filterMemberId)?.name || members.find(m => m.userId === filterMemberId)?.email}
            </span>
          )}
        </h3>

        {patientBreakdown.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <DollarSign className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Nenhum atendimento com procedimento ou pacote vinculado neste período.
            </p>
            <p className="text-xs text-muted-foreground">
              Cadastre o procedimento/pacote ao agendar e marque o atendimento como concluído.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-muted-foreground">Paciente</th>
                  <th className="text-center py-2 pr-3 text-xs font-semibold text-muted-foreground">Sessões</th>
                  <th className="text-right py-2 pr-3 text-xs font-semibold text-muted-foreground">Faturamento</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patientBreakdown.map(p => (
                  <tr key={p.patientId || p.patientName} className="hover:bg-accent/40 transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-foreground max-w-[180px] truncate">{p.patientName}</td>
                    <td className="py-2.5 pr-3 text-center text-foreground">{p.sessions}</td>
                    <td className="py-2.5 pr-3 text-right text-foreground">
                      R$ {p.base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 text-right font-semibold text-primary">
                      R$ {p.commission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="py-2.5 font-bold text-foreground">Total</td>
                  <td className="py-2.5 text-center font-bold text-foreground">{totalAppointments}</td>
                  <td className="py-2.5 text-right font-bold text-foreground">
                    R$ {totalBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 text-right font-bold text-primary">
                    R$ {totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ClinicProTeamFinancial;