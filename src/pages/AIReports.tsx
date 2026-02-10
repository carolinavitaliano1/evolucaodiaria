import { useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, FileText, Send, Loader2, Download, Copy, UserSearch, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

type Msg = { role: 'user' | 'assistant'; content: string };

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;

async function streamReport({
  body,
  onDelta,
  onDone,
  onError,
}: {
  body: Record<string, unknown>;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(REPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
    onError(data.error || `Erro ${resp.status}`);
    return;
  }

  if (!resp.body) { onError('Sem resposta'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + '\n' + textBuffer;
        break;
      }
    }
  }

  // flush remaining
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (raw.startsWith(':') || raw.trim() === '') continue;
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export default function AIReports() {
  const { clinics, patients } = useApp();
  const { theme } = useTheme();
  const isLilas = theme === 'lilas';

  // Guided mode state
  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');

  // Free mode state
  const [freeCommand, setFreeCommand] = useState('');

  // Shared state
  const [reportContent, setReportContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const generateGuided = useCallback(async () => {
    if (!selectedPatient) { toast.error('Selecione um paciente'); return; }
    setIsGenerating(true);
    setReportContent('');
    let content = '';

    await streamReport({
      body: { mode: 'guided', patientId: selectedPatient, period: selectedPeriod },
      onDelta: (chunk) => { content += chunk; setReportContent(content); },
      onDone: () => setIsGenerating(false),
      onError: (msg) => { toast.error(msg); setIsGenerating(false); },
    });
  }, [selectedPatient, selectedPeriod]);

  const generateFree = useCallback(async () => {
    if (!freeCommand.trim()) { toast.error('Digite um comando'); return; }
    setIsGenerating(true);
    setReportContent('');
    let content = '';

    await streamReport({
      body: { mode: 'free', command: freeCommand },
      onDelta: (chunk) => { content += chunk; setReportContent(content); },
      onDone: () => setIsGenerating(false),
      onError: (msg) => { toast.error(msg); setIsGenerating(false); },
    });
  }, [freeCommand]);

  const handleCopy = () => {
    navigator.clipboard.writeText(reportContent);
    toast.success('Relatório copiado!');
  };

  const handleExportPDF = () => {
    if (!reportContent) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;

    // Header
    pdf.setFillColor(124, 58, 237);
    pdf.rect(0, 0, pageWidth, 35, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Relatório Clínico', margin, 16);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Gerado por IA em ${new Date().toLocaleDateString('pt-BR')}`, margin, 28);

    // Content
    pdf.setTextColor(50, 50, 50);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');

    const lines = pdf.splitTextToSize(reportContent.replace(/[#*_`]/g, ''), pageWidth - margin * 2);
    let yPos = 45;

    for (const line of lines) {
      if (yPos > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPos = margin;
      }
      pdf.text(line, margin, yPos);
      yPos += 6;
    }

    // Footer on all pages
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth - margin - 20, pdf.internal.pageSize.getHeight() - 10);
      pdf.text('Diário do Terapeuta - IA', margin, pdf.internal.pageSize.getHeight() - 10);
    }

    pdf.save(`relatorio-ia-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado!');
  };

  // Simple markdown renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-foreground">{line.slice(4)}</h3>;
      if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-5 mb-2 text-foreground">{line.slice(3)}</h2>;
      if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3 text-foreground">{line.slice(2)}</h1>;
      if (line.startsWith('- ')) return <li key={i} className="ml-4 text-foreground/90">{line.slice(2)}</li>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-foreground">{line.slice(2, -2)}</p>;
      if (line.trim() === '') return <br key={i} />;
      // inline bold
      const parts = line.split(/\*\*(.*?)\*\*/g);
      if (parts.length > 1) {
        return <p key={i} className="text-foreground/90 leading-relaxed">{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</p>;
      }
      return <p key={i} className="text-foreground/90 leading-relaxed">{line}</p>;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className={cn("w-6 h-6", isLilas ? "text-purple-400" : "text-primary")} />
            Relatórios com IA
          </h1>
          <p className="text-muted-foreground">Gere relatórios profissionais automaticamente</p>
        </div>

        {reportContent && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
              <Copy className="w-4 h-4" /> Copiar
            </Button>
            <Button size="sm" onClick={handleExportPDF} className="gap-2">
              <Download className="w-4 h-4" /> Exportar PDF
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="guided" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="guided" className="gap-2">
            <UserSearch className="w-4 h-4" />
            Guiado
          </TabsTrigger>
          <TabsTrigger value="free" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Livre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guided">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Relatório por Paciente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Paciente</label>
                  <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um paciente" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(p => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — {clinics.find(c => c.id === p.clinicId)?.name || ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Período</label>
                  <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Último mês</SelectItem>
                      <SelectItem value="quarter">Último trimestre</SelectItem>
                      <SelectItem value="semester">Último semestre</SelectItem>
                      <SelectItem value="all">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={generateGuided} 
                disabled={isGenerating || !selectedPatient}
                className="gap-2 w-full sm:w-auto"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="free">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comando Livre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Descreva o relatório que deseja</label>
                <Textarea
                  placeholder="Ex: Gere um relatório mensal de frequência de todos os pacientes. Ou: Faça um resumo das evoluções do paciente João no último trimestre com análise de progresso."
                  value={freeCommand}
                  onChange={(e) => setFreeCommand(e.target.value)}
                  rows={4}
                />
              </div>

              <Button 
                onClick={generateFree} 
                disabled={isGenerating || !freeCommand.trim()}
                className="gap-2 w-full sm:w-auto"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gerar Relatório
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Report output */}
      {(reportContent || isGenerating) && (
        <Card className={cn(
          "glass-card overflow-hidden",
          isLilas && "border-purple-300/30"
        )}>
          <CardHeader className={cn(
            "border-b border-border",
            isLilas ? "bg-gradient-to-r from-purple-500/10 to-violet-500/10" : "bg-muted/30"
          )}>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className={cn("w-5 h-5", isLilas ? "text-purple-400" : "text-primary")} />
              Relatório Gerado
              {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 prose prose-sm max-w-none">
            {renderMarkdown(reportContent)}
            {isGenerating && <span className="inline-block w-2 h-5 bg-primary animate-pulse ml-1" />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
