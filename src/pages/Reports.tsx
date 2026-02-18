import { useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, PieChartIcon, TrendingUp, Users, Check, X, Download, Loader2, Smile, DollarSign, Table2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CHART_COLORS = ['#6366f1', '#ef4444', '#eab308'];
const PDF_COLORS = { primary: '#6366f1', destructive: '#ef4444', green: '#22c55e', yellow: '#eab308' };

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

const MOOD_LABELS: Record<string, { emoji: string; label: string }> = {
  otima: { emoji: '😄', label: 'Ótima' },
  boa: { emoji: '🙂', label: 'Boa' },
  neutra: { emoji: '😐', label: 'Neutra' },
  ruim: { emoji: '😟', label: 'Ruim' },
  muito_ruim: { emoji: '😢', label: 'Muito Ruim' },
};

export default function Reports() {
  const { clinics, patients, evolutions } = useApp();
  const [selectedClinic, setSelectedClinic] = useState<string>('all');
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [isExporting, setIsExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (period === 'week') {
      return {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
        label: 'Esta Semana'
      };
    } else {
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
        label: 'Este Mês'
      };
    }
  }, [period]);

  const filteredEvolutions = useMemo(() => {
    return evolutions.filter(e => {
      const matchesClinic = selectedClinic === 'all' || e.clinicId === selectedClinic;
      const evolutionDate = parseISO(e.date);
      const withinRange = isWithinInterval(evolutionDate, { start: dateRange.start, end: dateRange.end });
      return matchesClinic && withinRange;
    });
  }, [evolutions, selectedClinic, dateRange]);

  const attendanceStats = useMemo(() => {
    const present = filteredEvolutions.filter(e => e.attendanceStatus === 'presente').length;
    const absent = filteredEvolutions.filter(e => e.attendanceStatus === 'falta').length;
    const paidAbsent = filteredEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
    const total = present + absent + paidAbsent;
    const presenceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, paidAbsent, total, presenceRate };
  }, [filteredEvolutions]);

  // Mood stats
  const moodStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEvolutions.forEach(e => {
      if (e.mood) {
        stats[e.mood] = (stats[e.mood] || 0) + 1;
      }
    });
    return stats;
  }, [filteredEvolutions]);

  // Per-patient detailed stats
  const patientDetailedStats = useMemo(() => {
    const patientIds = [...new Set(filteredEvolutions.map(e => e.patientId))];
    return patientIds.map(pid => {
      const patient = patients.find(p => p.id === pid);
      const clinic = clinics.find(c => c.id === patient?.clinicId);
      const pEvolutions = filteredEvolutions.filter(e => e.patientId === pid);
      const present = pEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absent = pEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsent = pEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const total = present + absent + paidAbsent;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      
      // Revenue calculation
      let revenue = 0;
      if (patient?.paymentType === 'fixo' && patient.paymentValue) {
        revenue = patient.paymentValue;
      } else if (patient?.paymentValue) {
        const absenceType = clinic?.absencePaymentType || (clinic?.paysOnAbsence === false ? 'never' : 'always');
        let paidRegularAbsences = 0;
        if (absenceType === 'always') {
          paidRegularAbsences = absent;
        } else if (absenceType === 'confirmed_only') {
          paidRegularAbsences = pEvolutions.filter(e => e.attendanceStatus === 'falta' && e.confirmedAttendance).length;
        }
        revenue = (present + paidAbsent + paidRegularAbsences) * patient.paymentValue;
      }

      // Mood counts
      const moods: Record<string, number> = {};
      pEvolutions.forEach(e => {
        if (e.mood) moods[e.mood] = (moods[e.mood] || 0) + 1;
      });
      const predominantMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        patientName: patient?.name || 'Desconhecido',
        clinicName: clinic?.name || '-',
        present,
        absent,
        paidAbsent,
        total,
        rate,
        revenue,
        predominantMood,
        moods,
      };
    }).sort((a, b) => b.total - a.total);
  }, [filteredEvolutions, patients, clinics]);

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvolutions = filteredEvolutions.filter(e => e.date === dayStr);
      const present = dayEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absent = dayEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsent = dayEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      return {
        date: format(day, period === 'week' ? 'EEE' : 'dd', { locale: ptBR }),
        fullDate: format(day, 'dd/MM', { locale: ptBR }),
        Presenças: present,
        Faltas: absent,
        'Faltas Rem.': paidAbsent,
      };
    });
  }, [filteredEvolutions, dateRange, period]);

  const pieData = useMemo(() => [
    { name: 'Presenças', value: attendanceStats.present },
    { name: 'Faltas', value: attendanceStats.absent },
    { name: 'Faltas Rem.', value: attendanceStats.paidAbsent },
  ].filter(d => d.value > 0), [attendanceStats]);

  const clinicComparison = useMemo(() => {
    return clinics.map(clinic => {
      const clinicEvolutions = evolutions.filter(e => {
        const evolutionDate = parseISO(e.date);
        return e.clinicId === clinic.id && isWithinInterval(evolutionDate, { start: dateRange.start, end: dateRange.end });
      });
      const present = clinicEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absent = clinicEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const paidAbsent = clinicEvolutions.filter(e => e.attendanceStatus === 'falta_remunerada').length;
      const total = present + absent + paidAbsent;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        name: clinic.name.length > 15 ? clinic.name.slice(0, 15) + '...' : clinic.name,
        fullName: clinic.name,
        Presenças: present,
        Faltas: absent,
        'Faltas Rem.': paidAbsent,
        taxa: rate,
      };
    });
  }, [clinics, evolutions, dateRange]);

  const totalRevenue = useMemo(() => {
    return patientDetailedStats.reduce((sum, p) => sum + p.revenue, 0);
  }, [patientDetailedStats]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPos = margin;

      // Header
      pdf.setFillColor(99, 102, 241);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Diário do Terapeuta', margin, 18);
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Relatório Completo', margin, 28);
      
      pdf.setFontSize(10);
      const selectedClinicName = selectedClinic === 'all' 
        ? 'Todas as clínicas' 
        : clinics.find(c => c.id === selectedClinic)?.name || '';
      pdf.text(`${dateRange.label} | ${selectedClinicName}`, margin, 36);

      yPos = 50;

      // Date info
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(9);
      pdf.text(
        `Período: ${format(dateRange.start, 'dd/MM/yyyy', { locale: ptBR })} a ${format(dateRange.end, 'dd/MM/yyyy', { locale: ptBR })}`,
        margin, yPos
      );
      pdf.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth - margin - 60, yPos);
      
      yPos += 12;

      // Stats section
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo Geral', margin, yPos);
      yPos += 8;

      const cardWidth = (pageWidth - margin * 2 - 15) / 4;
      const cardHeight = 25;
      
      const statsCards = [
        { label: 'Total Atendimentos', value: String(attendanceStats.total), color: PDF_COLORS.primary },
        { label: 'Presenças', value: String(attendanceStats.present), color: PDF_COLORS.green },
        { label: 'Faltas', value: String(attendanceStats.absent), color: PDF_COLORS.destructive },
        { label: 'Taxa de Presença', value: `${attendanceStats.presenceRate}%`, color: PDF_COLORS.primary },
      ];

      statsCards.forEach((card, i) => {
        const x = margin + i * (cardWidth + 5);
        pdf.setFillColor(248, 250, 252);
        pdf.roundedRect(x, yPos, cardWidth, cardHeight, 3, 3, 'F');
        
        const rgb = hexToRgb(card.color);
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
        pdf.roundedRect(x, yPos, 3, cardHeight, 1, 1, 'F');
        
        pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
        pdf.setFontSize(16);
        pdf.setFont('helvetica', 'bold');
        pdf.text(card.value, x + 8, yPos + 12);
        
        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(card.label, x + 8, yPos + 20);
      });

      yPos += cardHeight + 15;

      // Patient table
      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detalhamento por Paciente', margin, yPos);
      yPos += 8;

      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Paciente', margin, yPos);
      pdf.text('Pres.', margin + 55, yPos);
      pdf.text('Faltas', margin + 70, yPos);
      pdf.text('F.Rem.', margin + 85, yPos);
      pdf.text('Taxa', margin + 100, yPos);
      pdf.text('Humor', margin + 115, yPos);
      pdf.text('Receita', margin + 140, yPos);
      yPos += 3;
      pdf.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 4;

      pdf.setFont('helvetica', 'normal');
      patientDetailedStats.forEach(p => {
        if (yPos > pageHeight - 20) { pdf.addPage(); yPos = margin; }
        pdf.setTextColor(50, 50, 50);
        pdf.text(p.patientName.substring(0, 25), margin, yPos);
        pdf.text(String(p.present), margin + 58, yPos);
        pdf.text(String(p.absent), margin + 73, yPos);
        pdf.text(String(p.paidAbsent), margin + 88, yPos);
        pdf.text(`${p.rate}%`, margin + 102, yPos);
        const moodLabel = p.predominantMood ? (MOOD_LABELS[p.predominantMood]?.label || '-') : '-';
        pdf.text(moodLabel, margin + 115, yPos);
        pdf.text(`R$ ${p.revenue.toFixed(2)}`, margin + 140, yPos);
        yPos += 5;
      });

      // Footer
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(150, 150, 150);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
        pdf.text('Diário do Terapeuta', margin, pageHeight - 10);
      }

      pdf.save(`relatorio-completo-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" ref={reportRef}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise completa de frequência, humor e faturamento</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Select value={period} onValueChange={(v: 'week' | 'month') => setPeriod(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semanal</SelectItem>
              <SelectItem value="month">Mensal</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedClinic} onValueChange={setSelectedClinic}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Todas as clínicas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as clínicas</SelectItem>
              {clinics.map(clinic => (
                <SelectItem key={clinic.id} value={clinic.id}>{clinic.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleExportPDF} disabled={isExporting} className="gap-2">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-500">{attendanceStats.present}</p>
                <p className="text-xs text-muted-foreground">Presenças</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <X className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-destructive">{attendanceStats.absent}</p>
                <p className="text-xs text-muted-foreground">Faltas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{attendanceStats.paidAbsent}</p>
                <p className="text-xs text-muted-foreground">Faltas Rem.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.presenceRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa Presença</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mood Summary */}
      {Object.keys(moodStats).length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Smile className="w-5 h-5" /> Distribuição de Humor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(MOOD_LABELS).map(([key, { emoji, label }]) => {
                const count = moodStats[key] || 0;
                if (count === 0) return null;
                const percent = attendanceStats.total > 0 ? Math.round((count / attendanceStats.total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3">
                    <span className="text-2xl">{emoji}</span>
                    <div>
                      <p className="font-bold text-foreground">{count}</p>
                      <p className="text-xs text-muted-foreground">{label} ({percent}%)</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div data-charts>
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="daily" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Diário</span>
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2">
              <PieChartIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Distribuição</span>
            </TabsTrigger>
            <TabsTrigger value="clinics" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Clínicas</span>
            </TabsTrigger>
            <TabsTrigger value="detailed" className="gap-2">
              <Table2 className="w-4 h-4" />
              <span className="hidden sm:inline">Detalhado</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Frequência Diária - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {dailyData.some(d => d.Presenças > 0 || d.Faltas > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey={period === 'week' ? 'date' : 'fullDate'} tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Presenças" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas Rem." fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Distribuição de Frequência - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {attendanceStats.total > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clinics">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Comparativo por Clínica - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {clinicComparison.some(c => c.Presenças > 0 || c.Faltas > 0) ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={clinicComparison} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Presenças" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Faltas Rem." fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de frequência para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detailed Patient Table */}
          <TabsContent value="detailed">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Relatório Detalhado por Paciente - {dateRange.label}</CardTitle>
              </CardHeader>
              <CardContent>
                {patientDetailedStats.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground">Paciente</th>
                          <th className="text-left py-3 px-2 font-medium text-muted-foreground hidden md:table-cell">Clínica</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Pres.</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Faltas</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">F.Rem.</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground">Taxa</th>
                          <th className="text-center py-3 px-2 font-medium text-muted-foreground hidden sm:table-cell">Humor</th>
                          <th className="text-right py-3 px-2 font-medium text-muted-foreground">Receita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {patientDetailedStats.map((p, i) => (
                          <tr key={i} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="py-3 px-2 font-medium text-foreground">{p.patientName}</td>
                            <td className="py-3 px-2 text-muted-foreground hidden md:table-cell">{p.clinicName}</td>
                            <td className="py-3 px-2 text-center text-green-500 font-semibold">{p.present}</td>
                            <td className="py-3 px-2 text-center text-destructive font-semibold">{p.absent}</td>
                            <td className="py-3 px-2 text-center text-amber-500 font-semibold">{p.paidAbsent}</td>
                            <td className="py-3 px-2 text-center">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                p.rate >= 80 ? 'bg-green-500/10 text-green-500' :
                                p.rate >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                                'bg-destructive/10 text-destructive'
                              }`}>
                                {p.rate}%
                              </span>
                            </td>
                            <td className="py-3 px-2 text-center hidden sm:table-cell">
                              {p.predominantMood ? (
                                <span title={MOOD_LABELS[p.predominantMood]?.label}>
                                  {MOOD_LABELS[p.predominantMood]?.emoji || '-'}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-foreground">
                              R$ {p.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                        {/* Totals row */}
                        <tr className="border-t-2 border-border font-bold">
                          <td className="py-3 px-2 text-foreground">Total</td>
                          <td className="py-3 px-2 hidden md:table-cell"></td>
                          <td className="py-3 px-2 text-center text-green-500">{attendanceStats.present}</td>
                          <td className="py-3 px-2 text-center text-destructive">{attendanceStats.absent}</td>
                          <td className="py-3 px-2 text-center text-amber-500">{attendanceStats.paidAbsent}</td>
                          <td className="py-3 px-2 text-center">{attendanceStats.presenceRate}%</td>
                          <td className="py-3 px-2 hidden sm:table-cell"></td>
                          <td className="py-3 px-2 text-right text-foreground">
                            R$ {totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Clinic Summary Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Resumo por Clínica</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Clínica</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Presenças</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Faltas</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">F.Rem.</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Total</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Taxa</th>
                </tr>
              </thead>
              <tbody>
                {clinicComparison.map((clinic, index) => (
                  <tr key={index} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-medium text-foreground">{clinic.fullName}</td>
                    <td className="py-3 px-4 text-center text-green-500 font-semibold">{clinic.Presenças}</td>
                    <td className="py-3 px-4 text-center text-destructive font-semibold">{clinic.Faltas}</td>
                    <td className="py-3 px-4 text-center text-amber-500 font-semibold">{clinic['Faltas Rem.']}</td>
                    <td className="py-3 px-4 text-center text-foreground">{clinic.Presenças + clinic.Faltas + clinic['Faltas Rem.']}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        clinic.taxa >= 80 ? 'bg-green-500/10 text-green-500' :
                        clinic.taxa >= 50 ? 'bg-yellow-500/10 text-yellow-500' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {clinic.taxa}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
