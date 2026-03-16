import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg, OrgMemberProfile } from '@/hooks/useClinicOrg';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users, ChevronLeft,
  ChevronRight, Crown, Shield, User, Download, Loader2
} from 'lucide-react';
import { format, subMonths, addMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

interface TeamFinancialReportProps {
  clinicId: string;
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  owner: <Crown className="w-3 h-3" />,
  admin: <Shield className="w-3 h-3" />,
  professional: <User className="w-3 h-3" />,
};

export function TeamFinancialReport({ clinicId }: TeamFinancialReportProps) {
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

  const monthlyEvolutions = useMemo(() => {
    return evolutions.filter(e => {
      if (!clinicPatients.some(p => p.id === e.patientId)) return false;
      const date = new Date(e.date + 'T12:00:00');
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [evolutions, clinicPatients, selectedMonth, selectedYear]);

  const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');

  // Calculate member remuneration based on their configured model
  const calculateMemberRemuneration = (member: typeof members[0], memberEvos: typeof monthlyEvolutions) => {
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

  // Stats per member — use each member's own remuneration model
  const memberStats = useMemo(() => {
    return members.map(member => {
      const memberEvos = monthlyEvolutions.filter(e => e.userId === member.userId);
      const sessions = memberEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
      const absences = memberEvos.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsences = memberEvos.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const revenue = calculateMemberRemuneration(member, memberEvos);
      return { member, sessions, absences, paidAbsences, revenue, evos: memberEvos };
    });
  }, [members, monthlyEvolutions]);

  // Filtered evolutions for consolidated view
  const filteredEvolutions = useMemo(() => {
    if (filterMemberId === 'all') return monthlyEvolutions;
    return monthlyEvolutions.filter(e => e.userId === filterMemberId);
  }, [monthlyEvolutions, filterMemberId]);

  const totalSessions = filteredEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
  const totalAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;

  const patientIdsInFilter = [...new Set(filteredEvolutions.map(e => e.patientId))];

  // Total = sum of each member's remuneration for the filtered scope
  const totalRevenue = useMemo(() => {
    if (filterMemberId === 'all') {
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

  const patientBreakdown = useMemo(() => {
    return patientIdsInFilter
      .map(patientId => {
        const patient = clinicPatients.find(p => p.id === patientId);
        if (!patient) return null;
        const patientEvos = filteredEvolutions.filter(e => e.patientId === patientId);
        const sessions = patientEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
        const absences = patientEvos.filter(e => e.attendanceStatus === 'falta').length;
        const paidAbsences = patientEvos.filter(e => e.attendanceStatus === 'falta_remunerada').length;
        // Author of the first evo (for org view)
        const authorId = (patientEvos[0] as any)?.user_id;
        const author = members.find(m => m.userId === authorId);
        return { patient, sessions, absences, paidAbsences, author };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null && p.sessions > 0)
      .sort((a, b) => b.sessions - a.sessions);
  }, [patientIdsInFilter, filteredEvolutions, clinicPatients, members]);

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

      // Header
      doc.setFontSize(16); doc.setTextColor(51, 51, 51);
      doc.text('RELATÓRIO FINANCEIRO DA EQUIPE', pw / 2, y, { align: 'center' }); y += 7;
      doc.setFontSize(10); doc.setTextColor(100, 100, 100);
      const clinicLabel = clinic?.name || 'Clínica';
      const filterLabel = filterMemberId === 'all' ? 'Todos os profissionais' : members.find(m => m.userId === filterMemberId)?.name || filterMemberId;
      doc.text(`${clinicLabel} — ${monthName.charAt(0).toUpperCase() + monthName.slice(1)} — ${filterLabel}`, pw / 2, y, { align: 'center' }); y += 10;

      // Summary
      doc.setFontSize(12); doc.setTextColor(51, 51, 51);
      doc.text('Resumo do Período', margin, y); y += 7;
      doc.setFontSize(10); doc.setTextColor(70, 70, 70);
      doc.text(`Faturamento Total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
      doc.text(`Sessões realizadas: ${totalSessions}`, margin, y); y += 5;
      doc.text(`Faltas remuneradas: ${totalPaidAbsences}`, margin, y); y += 5;
      doc.text(`Faltas: ${totalAbsences}`, margin, y); y += 12;

      // Per-member breakdown (only in "all" view)
      if (filterMemberId === 'all' && memberStats.length > 0) {
        addPageIfNeeded(20);
        doc.setFontSize(12); doc.setTextColor(51, 51, 51);
        doc.text('Faturamento por Profissional', margin, y); y += 7;

        doc.setFontSize(9); doc.setTextColor(100, 100, 100);
        doc.text('Profissional', margin, y);
        doc.text('Sessões', margin + 70, y);
        doc.text('Faltas', margin + 95, y);
        doc.text('Valor', pw - margin - 25, y);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 5;

        memberStats.forEach(({ member, sessions, absences, paidAbsences, revenue }) => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(51, 51, 51);
          doc.text((member.name || member.email).substring(0, 30), margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text(sessions.toString(), margin + 70, y);
          doc.text(absences.toString(), margin + 95, y);
          doc.text(`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pw - margin - 25, y);
          y += 6;
        });
        y += 5;
      }

      // Patient detail
      if (patientBreakdown.length > 0) {
        addPageIfNeeded(20);
        doc.setFontSize(12); doc.setTextColor(51, 51, 51);
        doc.text('Detalhamento por Paciente', margin, y); y += 7;

        doc.setFontSize(9); doc.setTextColor(100, 100, 100);
        doc.text('Paciente', margin, y);
        if (filterMemberId === 'all') doc.text('Profissional', margin + 50, y);
        doc.text('Sessões', margin + 100, y);
        doc.text('Valor', pw - margin - 25, y);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 5;

        patientBreakdown.forEach(({ patient, sessions, absences, paidAbsences, author }) => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(51, 51, 51);
          doc.text(patient.name.substring(0, 20), margin, y);
          if (filterMemberId === 'all' && author) {
            doc.setTextColor(100, 100, 100);
            doc.text((author.name || author.email).substring(0, 18), margin + 50, y);
          }
          doc.setTextColor(80, 80, 80);
          doc.text(sessions.toString(), margin + 105, y);
          y += 6;
        });

        addPageIfNeeded(10);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 6;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 51, 51);
        doc.text('Total', margin, y);
        doc.text(`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pw - margin - 25, y);
        doc.setFont('helvetica', 'normal');
      }

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(160, 160, 160);
        doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} — Página ${i}/${pages}`, pw / 2, 290, { align: 'center' });
      }

      doc.save(`financeiro-equipe-${format(selectedDate, 'yyyy-MM')}.pdf`);
      toast.success('Relatório exportado!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao exportar');
    } finally {
      setIsExporting(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isOrg) return null;

  const myMember = members.find(m => m.userId === user?.id);
  const canSeeAll = myMember?.role === 'owner' || myMember?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Month nav + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => subMonths(prev, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-bold text-foreground capitalize min-w-[160px] text-center">{monthName}</span>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDate(prev => addMonths(prev, 1))}>
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
          <Button size="sm" variant="outline" className="gap-2 h-8" onClick={handleExportPDF} disabled={isExporting}>
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-2xl p-4 border border-border">
          <DollarSign className="w-5 h-5 text-success mb-2" />
          <p className="text-xs text-muted-foreground">Remuneração</p>
          <p className="text-lg font-bold text-foreground">
            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {filterMemberId !== 'all' && (() => {
            const selM = members.find(m => m.userId === filterMemberId);
            if (!selM) return null;
            if (selM.remunerationType === 'fixo_mensal') return <p className="text-[10px] text-muted-foreground mt-0.5">💼 Valor Fixo Mensal (salário)</p>;
            if (selM.remunerationType === 'fixo_dia') {
              const days = new Set(filteredEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').map(e => e.date)).size;
              return <p className="text-[10px] text-muted-foreground mt-0.5">📅 Baseado em {days} dia{days !== 1 ? 's' : ''} trabalhado{days !== 1 ? 's' : ''}</p>;
            }
            if (selM.remunerationType === 'por_sessao') return <p className="text-[10px] text-muted-foreground mt-0.5">🔄 Baseado em {totalSessions} sessão{totalSessions !== 1 ? 'ões' : ''}</p>;
            return null;
          })()}
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <p className="text-xs text-muted-foreground">Sessões</p>
          <p className="text-lg font-bold text-foreground">{totalSessions}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <AlertTriangle className="w-5 h-5 text-warning mb-2" />
          <p className="text-xs text-muted-foreground">Faltas Rem.</p>
          <p className="text-lg font-bold text-foreground">{totalPaidAbsences}</p>
        </div>
        <div className="bg-card rounded-2xl p-4 border border-border">
          <TrendingDown className="w-5 h-5 text-destructive mb-2" />
          <p className="text-xs text-muted-foreground">Faltas</p>
          <p className="text-lg font-bold text-foreground">{totalAbsences}</p>
        </div>
      </div>

      {/* Per-member breakdown (admin/owner only, when "all" selected) */}
      {canSeeAll && filterMemberId === 'all' && memberStats.length > 0 && (
        <div className="bg-card rounded-2xl p-5 border border-border">
          <h3 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Faturamento por Profissional
          </h3>
          <div className="space-y-2">
            {memberStats
              .sort((a, b) => b.revenue - a.revenue)
              .map(({ member, sessions, absences, paidAbsences, revenue }) => (
                <div key={member.userId} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      {ROLE_ICONS[member.role]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {member.name || member.email}
                        {member.userId === user?.id && (
                          <span className="text-xs text-muted-foreground ml-1">(você)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessions} sessões
                        {paidAbsences > 0 && ` • ${paidAbsences} faltas rem.`}
                        {absences > 0 && ` • ${absences} faltas`}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-foreground shrink-0">
                    R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            {/* Total row */}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <p className="font-bold text-foreground text-sm">Total Consolidado</p>
              <p className="font-bold text-foreground">
                R$ {memberStats.reduce((s, m) => s + m.revenue, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Patient breakdown */}
      <div className="bg-card rounded-2xl p-5 border border-border">
        <h3 className="font-bold text-foreground mb-4">
          Detalhamento por Paciente
          {filterMemberId !== 'all' && (
            <span className="font-normal text-sm text-muted-foreground ml-2">
              — {members.find(m => m.userId === filterMemberId)?.name || members.find(m => m.userId === filterMemberId)?.email}
            </span>
          )}
        </h3>
        {patientBreakdown.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">Nenhum registro neste período</p>
        ) : (
          <div className="space-y-2">
            {patientBreakdown.map(({ patient, sessions, absences, paidAbsences, author }) => (
              <div key={patient.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground">{patient.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {sessions} sessões
                    {paidAbsences > 0 && ` • ${paidAbsences} faltas rem.`}
                    {absences > 0 && ` • ${absences} faltas`}
                    {filterMemberId === 'all' && author && (
                      <span className="ml-1">• {author.name || author.email}</span>
                    )}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground font-semibold shrink-0">
                  {sessions} sessões
                </p>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <p className="font-bold text-foreground text-sm">Total</p>
              <p className="font-bold text-foreground">
                R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
