import { useState, useMemo, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart3, PieChartIcon, TrendingUp, Users, Check, X, Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CHART_COLORS = ['#6366f1', '#ef4444'];
const PDF_COLORS = { primary: '#6366f1', destructive: '#ef4444', green: '#22c55e', yellow: '#eab308' };

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

export default function Reports() {
  const { clinics, evolutions } = useApp();
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
    const total = present + absent;
    const presenceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, presenceRate };
  }, [filteredEvolutions]);

  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayEvolutions = filteredEvolutions.filter(e => e.date === dayStr);
      const present = dayEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absent = dayEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      return {
        date: format(day, period === 'week' ? 'EEE' : 'dd', { locale: ptBR }),
        fullDate: format(day, 'dd/MM', { locale: ptBR }),
        Presenças: present,
        Faltas: absent,
      };
    });
  }, [filteredEvolutions, dateRange, period]);

  const pieData = useMemo(() => [
    { name: 'Presenças', value: attendanceStats.present },
    { name: 'Faltas', value: attendanceStats.absent },
  ], [attendanceStats]);

  const clinicComparison = useMemo(() => {
    return clinics.map(clinic => {
      const clinicEvolutions = evolutions.filter(e => {
        const evolutionDate = parseISO(e.date);
        return e.clinicId === clinic.id && isWithinInterval(evolutionDate, { start: dateRange.start, end: dateRange.end });
      });
      const present = clinicEvolutions.filter(e => e.attendanceStatus === 'presente').length;
      const absent = clinicEvolutions.filter(e => e.attendanceStatus === 'falta').length;
      const total = present + absent;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      return {
        name: clinic.name.length > 15 ? clinic.name.slice(0, 15) + '...' : clinic.name,
        fullName: clinic.name,
        Presenças: present,
        Faltas: absent,
        taxa: rate,
      };
    });
  }, [clinics, evolutions, dateRange]);

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
      pdf.text('Relatório de Frequência', margin, 28);
      
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

      // Capture charts
      const chartsEl = reportRef.current.querySelector('[data-charts]') as HTMLElement;
      if (chartsEl) {
        const canvas = await html2canvas(chartsEl, { scale: 2, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        if (yPos + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
        }
        
        pdf.addImage(imgData, 'PNG', margin, yPos, imgWidth, Math.min(imgHeight, 100));
        yPos += Math.min(imgHeight, 100) + 10;
      }

      // Table
      if (yPos > pageHeight - 80) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setTextColor(50, 50, 50);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Resumo por Clínica', margin, yPos);
      yPos += 10;

      const colWidths = [70, 30, 30, 25, 25];
      const tableX = margin;
      
      pdf.setFillColor(248, 250, 252);
      pdf.rect(tableX, yPos, pageWidth - margin * 2, 10, 'F');
      
      pdf.setTextColor(100, 100, 100);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Clínica', tableX + 3, yPos + 7);
      pdf.text('Presenças', tableX + colWidths[0] + 3, yPos + 7);
      pdf.text('Faltas', tableX + colWidths[0] + colWidths[1] + 3, yPos + 7);
      pdf.text('Total', tableX + colWidths[0] + colWidths[1] + colWidths[2] + 3, yPos + 7);
      pdf.text('Taxa', tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 3, yPos + 7);
      
      yPos += 10;

      clinicComparison.forEach((clinic, i) => {
        if (yPos > pageHeight - 20) {
          pdf.addPage();
          yPos = margin;
        }

        if (i % 2 === 0) {
          pdf.setFillColor(252, 252, 253);
          pdf.rect(tableX, yPos, pageWidth - margin * 2, 10, 'F');
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50, 50, 50);
        pdf.setFontSize(9);
        
        const clinicName = clinic.fullName.length > 35 ? clinic.fullName.slice(0, 35) + '...' : clinic.fullName;
        pdf.text(clinicName, tableX + 3, yPos + 7);
        
        const greenRgb = hexToRgb(PDF_COLORS.green);
        pdf.setTextColor(greenRgb[0], greenRgb[1], greenRgb[2]);
        pdf.text(String(clinic.Presenças), tableX + colWidths[0] + 10, yPos + 7);
        
        const redRgb = hexToRgb(PDF_COLORS.destructive);
        pdf.setTextColor(redRgb[0], redRgb[1], redRgb[2]);
        pdf.text(String(clinic.Faltas), tableX + colWidths[0] + colWidths[1] + 10, yPos + 7);
        
        pdf.setTextColor(50, 50, 50);
        pdf.text(String(clinic.Presenças + clinic.Faltas), tableX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPos + 7);
        
        const rateColor = clinic.taxa >= 80 ? PDF_COLORS.green : clinic.taxa >= 50 ? PDF_COLORS.yellow : PDF_COLORS.destructive;
        const rateRgb = hexToRgb(rateColor);
        pdf.setTextColor(rateRgb[0], rateRgb[1], rateRgb[2]);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${clinic.taxa}%`, tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, yPos + 7);
        
        yPos += 10;
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

      pdf.save(`relatorio-frequencia-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
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
          <p className="text-muted-foreground">Análise de frequência e atendimentos</p>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.total}</p>
                <p className="text-xs text-muted-foreground">Total Atendimentos</p>
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
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{attendanceStats.presenceRate}%</p>
                <p className="text-xs text-muted-foreground">Taxa de Presença</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div data-charts>
        <Tabs defaultValue="daily" className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-3">
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
              <span className="hidden sm:inline">Por Clínica</span>
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
        </Tabs>
      </div>

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
                    <td className="py-3 px-4 text-center text-foreground">{clinic.Presenças + clinic.Faltas}</td>
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
