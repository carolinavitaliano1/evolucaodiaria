import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg } from '@/hooks/useClinicOrg';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users,
  ChevronLeft, ChevronRight, Crown, Shield, User, Download, Loader2,
  Trophy, Medal
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface TeamFinancialDashboardProps {
  clinicId: string;
  organizationId?: string | null;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  professional: <User className="w-3 h-3" />,
};

const RANK_ICONS = [
  <Trophy className="w-4 h-4 text-yellow-500" />,
  <Medal className="w-4 h-4 text-slate-400" />,
  <Medal className="w-4 h-4 text-amber-600" />,
];

export function TeamFinancialDashboard({ clinicId }: TeamFinancialDashboardProps) {
  const { clinics, patients, evolutions } = useApp();
  const { user } = useAuth();
  const { isOrg, members, loading: orgLoading } = useClinicOrg(clinicId);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterMemberId, setFilterMemberId] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);

  const clinic = clinics.find(c => c.id === clinicId);
  const selectedMonth = selectedDate.getMonth();
  const selectedYear = selectedDate.getFullYear();
  const monthName = format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR });

  const clinicPatients = useMemo(
    () => patients.filter(p => p.clinicId === clinicId),
    [patients, clinicId]
  );

  const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');

  // Calculate member remuneration based on their configured model
  const calculateMemberRemuneration = (member: typeof members[0], memberEvos: typeof evolutions) => {
    const { remunerationType, remunerationValue } = member;
    if (!remunerationValue || remunerationType === 'definir_depois' || !remunerationType) return 0;

    if (remunerationType === 'fixo_mensal') {
      // Fixed monthly salary — always the same value, regardless of sessions
      return remunerationValue;
    }

    if (remunerationType === 'fixo_dia') {
      // Fixed daily rate × distinct days with "presente" evolutions
      const presentDays = new Set(
        memberEvos
          .filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao')
          .map(e => e.date)
      );
      return presentDays.size * remunerationValue;
    }

    if (remunerationType === 'por_sessao') {
      // Per session: count presente + reposicao
      const sessions = memberEvos.filter(e =>
        e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao'
      ).length;
      return sessions * remunerationValue;
    }

    return 0;
  };

  // Current month evolutions
  const monthlyEvolutions = useMemo(() => {
    return evolutions.filter(e => {
      if (!clinicPatients.some(p => p.id === e.patientId)) return false;
      const date = new Date(e.date + 'T12:00:00');
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [evolutions, clinicPatients, selectedMonth, selectedYear]);

  // Filtered evolutions
  const filteredEvolutions = useMemo(() => {
    if (filterMemberId === 'all') return monthlyEvolutions;
    return monthlyEvolutions.filter(e => e.userId === filterMemberId);
  }, [monthlyEvolutions, filterMemberId]);

  const totalSessions = filteredEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
  const totalAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;

  // Total remuneration: sum each member's own model for the filtered scope
  const patientIdsInFilter = [...new Set(filteredEvolutions.map(e => e.patientId))];
  const totalRevenue = useMemo(() => {
    if (filterMemberId === 'all') {
      // Sum all members' remuneration
      return members.reduce((sum, member) => {
        const memberEvos = monthlyEvolutions.filter(e => e.userId === member.userId);
        return sum + calculateMemberRemuneration(member, memberEvos);
      }, 0);
    } else {
      const member = members.find(m => m.userId === filterMemberId);
      if (!member) return 0;
      return calculateMemberRemuneration(member, filteredEvolutions);
    }
  }, [members, monthlyEvolutions, filteredEvolutions, filterMemberId]);

  // Per-member stats
  const memberStats = useMemo(() => {
    return members.map(member => {
      const memberEvos = monthlyEvolutions.filter(e => e.userId === member.userId);
      const sessions = memberEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
      const absences = memberEvos.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsences = memberEvos.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const revenue = calculateMemberRemuneration(member, memberEvos);
      return { member, sessions, absences, paidAbsences, revenue };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [members, monthlyEvolutions]);

  const maxMemberRevenue = memberStats[0]?.revenue || 1;

  // Patient breakdown (sessions info only — revenue is by member model, not per-patient)
  const patientBreakdown = useMemo(() => {
    return patientIdsInFilter
      .map(patientId => {
        const patient = clinicPatients.find(p => p.id === patientId);
        if (!patient) return null;
        const patientEvos = filteredEvolutions.filter(e => e.patientId === patientId);
        const sessions = patientEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
        const absences = patientEvos.filter(e => e.attendanceStatus === 'falta').length;
        const paidAbsences = patientEvos.filter(e => e.attendanceStatus === 'falta_remunerada').length;
        const authorId = (patientEvos[0] as any)?.user_id;
        const author = members.find(m => m.userId === authorId);
        return { patient, sessions, absences, paidAbsences, author };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null && p.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
  }, [patientIdsInFilter, filteredEvolutions, clinicPatients, members]);

  // 6-month history chart data
  const chartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(selectedDate, 5 - i);
      const m = date.getMonth();
      const y = date.getFullYear();
      const monthEvos = evolutions.filter(e => {
        if (!clinicPatients.some(p => p.id === e.patientId)) return false;
        const d = new Date(e.date + 'T12:00:00');
        return d.getMonth() === m && d.getFullYear() === y;
      });
      const filteredMonthEvos = filterMemberId === 'all'
        ? monthEvos
        : monthEvos.filter(e => (e as any).user_id === filterMemberId);

      // Revenue: sum each member's remuneration for this month
      const revenue = filterMemberId === 'all'
        ? members.reduce((sum, member) => {
            const memberEvos = monthEvos.filter(e => (e as any).user_id === member.userId);
            return sum + calculateMemberRemuneration(member, memberEvos);
          }, 0)
        : (() => {
            const member = members.find(m => m.userId === filterMemberId);
            if (!member) return 0;
            return calculateMemberRemuneration(member, filteredMonthEvos);
          })();
      const sessions = filteredMonthEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;

      return {
        month: format(date, 'MMM', { locale: ptBR }).replace('.', ''),
        faturamento: revenue,
        sessoes: sessions,
      };
    });
  }, [evolutions, clinicPatients, selectedDate, filterMemberId]);

  const myMember = members.find(m => m.userId === user?.id);
  const canSeeAll = myMember?.role === 'owner' || myMember?.role === 'admin';

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pw = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      const addPageIfNeeded = (needed = 10) => {
        if (y + needed > 278) { doc.addPage(); y = 20; }
      };

      const clinicLabel = clinic?.name || 'Clínica';
      const filterLabel = filterMemberId === 'all'
        ? 'Todos os profissionais'
        : members.find(m => m.userId === filterMemberId)?.name || filterMemberId;
      const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      // ── Header ──
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pw, 28, 'F');
      doc.setFontSize(14); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
      doc.text('EXTRATO FINANCEIRO DA EQUIPE', pw / 2, 13, { align: 'center' });
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.text(`${clinicLabel} — ${monthLabel} — ${filterLabel}`, pw / 2, 21, { align: 'center' });
      y = 38;

      // ── Summary cards row ──
      const cardW = (pw - margin * 2 - 9) / 4;
      const cards = [
        { label: 'Faturamento', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { label: 'Sessões', value: totalSessions.toString() },
        { label: 'Faltas Rem.', value: totalPaidAbsences.toString() },
        { label: 'Faltas', value: totalAbsences.toString() },
      ];
      cards.forEach((card, i) => {
        const cx = margin + i * (cardW + 3);
        doc.setFillColor(245, 245, 250);
        doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
        doc.setFontSize(7); doc.setTextColor(120, 120, 140); doc.setFont('helvetica', 'normal');
        doc.text(card.label, cx + cardW / 2, y + 6, { align: 'center' });
        doc.setFontSize(10); doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
        doc.text(card.value, cx + cardW / 2, y + 13, { align: 'center' });
      });
      y += 26;

      // ── 6-Month History Table ──
      addPageIfNeeded(40);
      doc.setFontSize(11); doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
      doc.text('Evolução dos últimos 6 meses', margin, y); y += 7;

      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
      doc.text('Mês', margin, y);
      doc.text('Sessões', margin + 60, y);
      doc.text('Faturamento', margin + 110, y);
      y += 3;
      doc.setDrawColor(210, 210, 220); doc.line(margin, y, pw - margin, y); y += 4;

      chartData.forEach((row, idx) => {
        addPageIfNeeded(7);
        const isCurrentMonth = idx === chartData.length - 1;
        if (isCurrentMonth) {
          doc.setFillColor(235, 233, 255);
          doc.rect(margin - 2, y - 4, pw - margin * 2 + 4, 8, 'F');
        }
        doc.setFont('helvetica', isCurrentMonth ? 'bold' : 'normal');
        doc.setTextColor(isCurrentMonth ? 60 : 90, isCurrentMonth ? 50 : 80, isCurrentMonth ? 200 : 120);
        doc.text(row.month.charAt(0).toUpperCase() + row.month.slice(1), margin, y);
        doc.setTextColor(50, 50, 70);
        doc.text(row.sessoes.toString(), margin + 60, y);
        doc.text(`R$ ${row.faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 110, y);
        y += 7;
      });
      y += 6;

      // ── Member Ranking ──
      if (canSeeAll && filterMemberId === 'all' && memberStats.length > 0) {
        addPageIfNeeded(30);
        doc.setFontSize(11); doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
        doc.text('Ranking de Profissionais', margin, y); y += 7;

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
        doc.text('#', margin, y);
        doc.text('Profissional', margin + 12, y);
        doc.text('Sessões', margin + 95, y);
        doc.text('Faturamento', margin + 125, y);
        y += 3;
        doc.setDrawColor(210, 210, 220); doc.line(margin, y, pw - margin, y); y += 4;

        memberStats.forEach(({ member, sessions, revenue }, i) => {
          addPageIfNeeded(7);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 80);
          doc.text((i + 1).toString(), margin + 2, y);
          doc.text((member.name || member.email).substring(0, 28), margin + 12, y);
          doc.text(sessions.toString(), margin + 95, y);
          doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
          doc.setTextColor(i === 0 ? 79 : 50, i === 0 ? 70 : 50, i === 0 ? 229 : 70);
          doc.text(`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 125, y);
          y += 7;
        });

        // Total row
        y += 2;
        doc.setDrawColor(210, 210, 220); doc.line(margin, y, pw - margin, y); y += 5;
        doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50); doc.setFontSize(9);
        doc.text('Total Consolidado', margin + 12, y);
        doc.text(`R$ ${memberStats.reduce((s, m) => s + m.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 125, y);
        y += 10;
      }

      // ── Patient Breakdown ──
      if (patientBreakdown.length > 0) {
        addPageIfNeeded(30);
        doc.setFontSize(11); doc.setTextColor(30, 30, 50); doc.setFont('helvetica', 'bold');
        doc.text('Detalhamento por Paciente', margin, y); y += 7;

        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100);
        doc.text('Paciente', margin, y);
        if (filterMemberId === 'all') doc.text('Profissional', margin + 60, y);
        doc.text('Sessões', margin + 105, y);
        doc.text('Faturamento', pw - margin - 35, y);
        y += 3;
        doc.setDrawColor(210, 210, 220); doc.line(margin, y, pw - margin, y); y += 4;

        patientBreakdown.forEach(({ patient, sessions, author }) => {
          addPageIfNeeded(7);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 70);
          doc.text(patient.name.substring(0, 22), margin, y);
          if (filterMemberId === 'all' && author) {
            doc.setTextColor(100, 100, 120);
            doc.text((author.name || author.email).substring(0, 18), margin + 60, y);
          }
          doc.setTextColor(50, 50, 70);
          doc.text(sessions.toString(), margin + 108, y);
          y += 7;
        });

        addPageIfNeeded(10);
        y += 2;
        doc.setDrawColor(210, 210, 220); doc.line(margin, y, pw - margin, y); y += 5;
        doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 50);
        doc.text('Total', margin, y);
        doc.text(`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pw - margin - 35, y);
      }

      // ── Page footer ──
      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFillColor(245, 245, 250);
        doc.rect(0, 284, pw, 13, 'F');
        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 160);
        doc.text(
          `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} — ${clinicLabel} — Página ${i}/${pages}`,
          pw / 2, 291, { align: 'center' }
        );
      }

      doc.save(`extrato-equipe-${format(selectedDate, 'yyyy-MM')}.pdf`);
      toast.success('Extrato exportado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar extrato');
    } finally {
      setIsExporting(false);
    }
  };

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
      {/* ── Controls bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-bold text-foreground capitalize min-w-[160px] text-center text-sm">{monthName}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {canSeeAll && (
            <Select value={filterMemberId} onValueChange={setFilterMemberId}>
              <SelectTrigger className="h-8 text-sm w-auto min-w-[180px]">
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
          <Button size="sm" variant="default" className="gap-2 h-8" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Exportar Extrato
          </Button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: <DollarSign className="w-5 h-5 text-success" />, label: 'Faturamento', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
          { icon: <TrendingUp className="w-5 h-5 text-primary" />, label: 'Sessões', value: totalSessions.toString() },
          { icon: <AlertTriangle className="w-5 h-5 text-warning" />, label: 'Faltas Rem.', value: totalPaidAbsences.toString() },
          { icon: <TrendingDown className="w-5 h-5 text-destructive" />, label: 'Faltas', value: totalAbsences.toString() },
        ].map(card => (
          <div key={card.label} className="bg-card rounded-2xl p-4 border border-border">
            {card.icon}
            <p className="text-xs text-muted-foreground mt-2">{card.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── 6-Month Bar Chart ── */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-primary" />
          Evolução dos últimos 6 meses
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              className="fill-muted-foreground"
            />
            <YAxis
              yAxisId="sessions"
              orientation="right"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
              labelStyle={{ fontWeight: 700, color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [
                name === 'faturamento'
                  ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  : value,
                name === 'faturamento' ? 'Faturamento' : 'Sessões'
              ]}
            />
            <Legend
              formatter={(value) => value === 'faturamento' ? 'Faturamento' : 'Sessões'}
              wrapperStyle={{ fontSize: '12px' }}
            />
            <Bar yAxisId="revenue" dataKey="faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Bar yAxisId="sessions" dataKey="sessoes" fill="hsl(var(--primary) / 0.3)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Member Ranking ── */}
      {canSeeAll && filterMemberId === 'all' && memberStats.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Ranking de Profissionais
          </h3>
          <div className="space-y-3">
            {memberStats.map(({ member, sessions, absences, paidAbsences, revenue }, i) => (
              <div key={member.userId} className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-secondary/30 border-border'
              )}>
                <div className="w-7 h-7 flex items-center justify-center shrink-0">
                  {i < 3 ? RANK_ICONS[i] : <span className="text-sm font-bold text-muted-foreground">{i + 1}</span>}
                </div>
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                  {ROLE_ICONS[member.role]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {member.name || member.email}
                      {member.userId === user?.id && (
                        <span className="text-xs text-muted-foreground ml-1 font-normal">(você)</span>
                      )}
                    </p>
                  </div>
                  <Progress
                    value={maxMemberRevenue > 0 ? (revenue / maxMemberRevenue) * 100 : 0}
                    className="h-1.5 mb-1"
                  />
                  <p className="text-xs text-muted-foreground">
                    {sessions} sessões
                    {paidAbsences > 0 && ` · ${paidAbsences} faltas rem.`}
                    {absences > 0 && ` · ${absences} faltas`}
                  </p>
                </div>
                <p className={cn('font-bold shrink-0 text-sm', i === 0 ? 'text-primary' : 'text-foreground')}>
                  R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-2 border-t border-border">
              <p className="font-bold text-foreground text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                Total Consolidado
              </p>
              <p className="font-bold text-foreground">
                R$ {memberStats.reduce((s, m) => s + m.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Patient Breakdown ── */}
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
            <p className="text-sm text-muted-foreground">Nenhum dado financeiro para este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-3 text-xs font-semibold text-muted-foreground">Paciente</th>
                  {filterMemberId === 'all' && canSeeAll && (
                    <th className="text-left py-2 pr-3 text-xs font-semibold text-muted-foreground">Profissional</th>
                  )}
                  <th className="text-center py-2 pr-3 text-xs font-semibold text-muted-foreground">Sessões</th>
                  <th className="text-center py-2 pr-3 text-xs font-semibold text-muted-foreground">F. Rem.</th>
                  <th className="text-center py-2 pr-3 text-xs font-semibold text-muted-foreground">Faltas</th>
                  <th className="text-right py-2 text-xs font-semibold text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {patientBreakdown.map(({ patient, sessions, absences, paidAbsences, author }) => (
                  <tr key={patient.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-2.5 pr-3 font-medium text-foreground max-w-[140px] truncate">{patient.name}</td>
                    {filterMemberId === 'all' && canSeeAll && (
                      <td className="py-2.5 pr-3 text-muted-foreground text-xs max-w-[120px] truncate">
                        {author ? (author.name || author.email.split('@')[0]) : '—'}
                      </td>
                    )}
                    <td className="py-2.5 pr-3 text-center text-foreground">{sessions}</td>
                    <td className="py-2.5 pr-3 text-center text-warning">{paidAbsences || '—'}</td>
                    <td className="py-2.5 pr-3 text-center text-destructive">{absences || '—'}</td>
                    <td className="py-2.5 text-right font-semibold text-muted-foreground text-xs">
                      {sessions} sess.
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={filterMemberId === 'all' && canSeeAll ? 5 : 4} className="py-2.5 font-bold text-foreground">Total</td>
                  <td className="py-2.5 text-right font-bold text-foreground">
                    R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
