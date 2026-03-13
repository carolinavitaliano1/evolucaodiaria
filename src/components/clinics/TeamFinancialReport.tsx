import { useState, useMemo } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useClinicOrg, OrgMemberProfile, calcMemberRemuneration } from '@/hooks/useClinicOrg';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, Users, ChevronLeft,
  ChevronRight, Crown, Shield, User, Download, Loader2, AlertCircle
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
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

  // Stats per member using new remuneration logic
  const memberStats = useMemo(() => {
    return members.map(member => {
      const memberEvos = monthlyEvolutions.filter(e => (e as any).user_id === member.userId);
      const sessions = memberEvos.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
      const absences = memberEvos.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsences = memberEvos.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const { amount: revenue, label: remunerationLabel, isUndefined } = calcMemberRemuneration(member, memberEvos);
      return { member, sessions, absences, paidAbsences, revenue, remunerationLabel, isUndefined, evos: memberEvos };
    });
  }, [members, monthlyEvolutions]);

  // Filtered evolutions for consolidated view
  const filteredEvolutions = useMemo(() => {
    if (filterMemberId === 'all') return monthlyEvolutions;
    return monthlyEvolutions.filter(e => (e as any).user_id === filterMemberId);
  }, [monthlyEvolutions, filterMemberId]);

  const totalSessions = filteredEvolutions.filter(e => e.attendanceStatus === 'presente' || e.attendanceStatus === 'reposicao').length;
  const totalAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta').length;
  const totalPaidAbsences = filteredEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;

  const totalRevenue = useMemo(() => {
    if (filterMemberId === 'all') {
      return memberStats.reduce((s, m) => s + m.revenue, 0);
    }
    const member = members.find(m => m.userId === filterMemberId);
    if (!member) return 0;
    return calcMemberRemuneration(member, filteredEvolutions).amount;
  }, [memberStats, filterMemberId, members, filteredEvolutions]);

  const patientBreakdown = useMemo(() => {
    const patientIds = [...new Set(filteredEvolutions.map(e => e.patientId))];
    return patientIds
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
      .filter((p): p is NonNullable<typeof p> => p !== null && (p.sessions > 0 || p.absences > 0))
      .sort((a, b) => b.sessions - a.sessions);
  }, [filteredEvolutions, clinicPatients, members]);

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
      doc.text(`Remuneração Total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin, y); y += 5;
      doc.text(`Sessões realizadas: ${totalSessions}`, margin, y); y += 5;
      doc.text(`Faltas remuneradas: ${totalPaidAbsences}`, margin, y); y += 5;
      doc.text(`Faltas: ${totalAbsences}`, margin, y); y += 12;

      // Per-member breakdown (only in "all" view)
      if (filterMemberId === 'all' && memberStats.length > 0) {
        addPageIfNeeded(20);
        doc.setFontSize(12); doc.setTextColor(51, 51, 51);
        doc.text('Remuneração por Profissional', margin, y); y += 7;

        doc.setFontSize(9); doc.setTextColor(100, 100, 100);
        doc.text('Profissional', margin, y);
        doc.text('Sessões', margin + 65, y);
        doc.text('Modelo', margin + 90, y);
        doc.text('Valor', pw - margin - 25, y);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 5;

        memberStats.forEach(({ member, sessions, revenue, remunerationLabel, isUndefined }) => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(51, 51, 51);
          doc.text((member.name || member.email).substring(0, 28), margin, y);
          doc.setTextColor(80, 80, 80);
          doc.text(sessions.toString(), margin + 65, y);
          doc.setTextColor(100, 100, 120);
          doc.text(isUndefined ? '—' : remunerationLabel, margin + 90, y);
          doc.setTextColor(isUndefined ? 160 : 51, isUndefined ? 160 : 51, isUndefined ? 160 : 51);
          doc.text(isUndefined ? 'Não definida' : `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, pw - margin - 25, y);
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
        doc.text('Faltas', pw - margin - 25, y);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 5;

        patientBreakdown.forEach(({ patient, sessions, absences, author }) => {
          addPageIfNeeded(8);
          doc.setFontSize(9); doc.setTextColor(51, 51, 51);
          doc.text(patient.name.substring(0, 20), margin, y);
          if (filterMemberId === 'all' && author) {
            doc.setTextColor(100, 100, 100);
            doc.text((author.name || author.email).substring(0, 18), margin + 50, y);
          }
          doc.setTextColor(80, 80, 80);
          doc.text(sessions.toString(), margin + 105, y);
          doc.text(absences.toString(), pw - margin - 25, y);
          y += 6;
        });

        addPageIfNeeded(10);
        y += 3;
        doc.setDrawColor(200, 200, 200); doc.line(margin, y, pw - margin, y); y += 6;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(51, 51, 51);
        doc.text('Total de Sessões', margin, y);
        doc.text(totalSessions.toString(), margin + 105, y);
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
            Remuneração por Profissional
          </h3>
          <div className="space-y-2">
            {memberStats
              .sort((a, b) => b.revenue - a.revenue)
              .map(({ member, sessions, absences, paidAbsences, revenue, remunerationLabel, isUndefined }) => (
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
                  <div className="text-right shrink-0">
                    {isUndefined ? (
                      <div className="flex items-center gap-1 text-warning text-xs">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Não definida
                      </div>
                    ) : (
                      <>
                        <p className="font-bold text-foreground">
                          R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant="secondary" className="text-[10px] mt-0.5 py-0 h-4">{remunerationLabel}</Badge>
                      </>
                    )}
                  </div>
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

      {/* Single member remuneration card */}
      {filterMemberId !== 'all' && (() => {
        const memberStat = memberStats.find(ms => ms.member.userId === filterMemberId);
        if (!memberStat) return null;
        return (
          <div className="bg-card rounded-2xl p-5 border border-border">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-success" />
              Remuneração do Mês
            </h3>
            {memberStat.isUndefined ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertCircle className="w-4 h-4 text-warning shrink-0" />
                <p className="text-sm text-warning font-medium">Remuneração não definida — contate o administrador.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-foreground">
                    R$ {memberStat.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <Badge variant="secondary" className="mt-1">{memberStat.remunerationLabel}</Badge>
                </div>
                <div className="text-right text-sm text-muted-foreground space-y-1">
                  <p><span className="font-medium text-foreground">{memberStat.sessions}</span> sessões</p>
                  {memberStat.paidAbsences > 0 && <p><span className="font-medium text-warning">{memberStat.paidAbsences}</span> faltas rem.</p>}
                  {memberStat.absences > 0 && <p><span className="font-medium text-destructive">{memberStat.absences}</span> faltas</p>}
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <DollarSign className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum atendimento neste período.</p>
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
                  <th className="text-center py-2 text-xs font-semibold text-muted-foreground">Faltas</th>
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
                    <td className="py-2.5 text-center text-destructive">{absences || '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={filterMemberId === 'all' && canSeeAll ? 4 : 3} className="py-2.5 font-bold text-foreground">Total</td>
                  <td className="py-2.5 text-center font-bold text-foreground">{totalSessions}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
