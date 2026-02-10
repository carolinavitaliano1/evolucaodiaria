import { useState, useCallback, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sparkles, FileText, Send, Loader2, Download, Copy, UserSearch, MessageSquare,
  Save, FolderOpen, Trash2, Bold, Italic, Underline as UnderlineIcon, AlignLeft,
  AlignCenter, AlignRight, Image as ImageIcon, Type, List, Share2, Mail, Link2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import FontSize from '@tiptap/extension-font-size';

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-report`;

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || '';
}

async function streamReport({
  body, onDelta, onDone, onError,
}: {
  body: Record<string, unknown>;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const token = await getAuthToken();
  const resp = await fetch(REPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
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

function markdownToHtml(md: string): string {
  let html = md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
  return html;
}

interface SavedReport {
  id: string;
  title: string;
  content: string;
  mode: string;
  patient_id: string | null;
  created_at: string;
  updated_at: string;
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      // Upload to Supabase storage
      const fileName = `report-images/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('attachments').upload(fileName, file);
      if (error) { toast.error('Erro ao enviar imagem'); return; }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    };
    input.click();
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30 rounded-t-lg">
      <Select
        value={editor.getAttributes('textStyle').fontFamily || 'sans-serif'}
        onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sans-serif">Sans Serif</SelectItem>
          <SelectItem value="serif">Serif</SelectItem>
          <SelectItem value="monospace">Monospace</SelectItem>
          <SelectItem value="Georgia">Georgia</SelectItem>
          <SelectItem value="Arial">Arial</SelectItem>
          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={editor.getAttributes('textStyle').fontSize || '16px'}
        onValueChange={(v) => editor.chain().focus().setFontSize(v).run()}
      >
        <SelectTrigger className="w-[80px] h-8 text-xs">
          <SelectValue placeholder="Tam." />
        </SelectTrigger>
        <SelectContent>
          {['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'].map(s => (
            <SelectItem key={s} value={s}>{s.replace('px', '')}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        variant={editor.isActive('bold') ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBold().run()}
      ><Bold className="w-3.5 h-3.5" /></Button>

      <Button
        variant={editor.isActive('italic') ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      ><Italic className="w-3.5 h-3.5" /></Button>

      <Button
        variant={editor.isActive('underline') ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      ><UnderlineIcon className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      ><AlignLeft className="w-3.5 h-3.5" /></Button>

      <Button
        variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      ><AlignCenter className="w-3.5 h-3.5" /></Button>

      <Button
        variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      ><AlignRight className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button
        variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      ><List className="w-3.5 h-3.5" /></Button>

      <Button
        variant="ghost" size="icon" className="h-8 w-8"
        onClick={addImage}
      ><ImageIcon className="w-3.5 h-3.5" /></Button>

      <Button
        variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
        size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      ><Type className="w-3.5 h-3.5" /></Button>
    </div>
  );
}

export default function AIReports() {
  const { clinics, patients } = useApp();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isLilas = theme === 'lilas';

  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [freeCommand, setFreeCommand] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      ImageExt.configure({ allowBase64: false, HTMLAttributes: { class: 'max-w-full rounded-lg cursor-pointer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      UnderlineExt,
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content: '<p>Gere um relatório para começar a editar...</p>',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none' },
    },
  });

  // Load saved reports
  const loadSavedReports = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('saved_reports')
      .select('*')
      .order('updated_at', { ascending: false });
    if (!error && data) setSavedReports(data as SavedReport[]);
  }, [user]);

  useEffect(() => { loadSavedReports(); }, [loadSavedReports]);

  const generateGuided = useCallback(async () => {
    if (!selectedPatient) { toast.error('Selecione um paciente'); return; }
    setIsGenerating(true);
    let content = '';

    const patientName = patients.find(p => p.id === selectedPatient)?.name || 'Paciente';
    setReportTitle(`Relatório - ${patientName}`);
    setCurrentReportId(null);

    await streamReport({
      body: { mode: 'guided', patientId: selectedPatient, period: selectedPeriod },
      onDelta: (chunk) => {
        content += chunk;
        editor?.commands.setContent(markdownToHtml(content));
      },
      onDone: () => setIsGenerating(false),
      onError: (msg) => { toast.error(msg); setIsGenerating(false); },
    });
  }, [selectedPatient, selectedPeriod, editor, patients]);

  const generateFree = useCallback(async () => {
    if (!freeCommand.trim()) { toast.error('Digite um comando'); return; }
    setIsGenerating(true);
    let content = '';

    setReportTitle(`Relatório - ${new Date().toLocaleDateString('pt-BR')}`);
    setCurrentReportId(null);

    await streamReport({
      body: { mode: 'free', command: freeCommand },
      onDelta: (chunk) => {
        content += chunk;
        editor?.commands.setContent(markdownToHtml(content));
      },
      onDone: () => setIsGenerating(false),
      onError: (msg) => { toast.error(msg); setIsGenerating(false); },
    });
  }, [freeCommand, editor]);

  const handleSave = useCallback(async () => {
    if (!user || !editor) return;
    const title = reportTitle || `Relatório ${new Date().toLocaleDateString('pt-BR')}`;
    const htmlContent = editor.getHTML();
    setIsSaving(true);

    try {
      if (currentReportId) {
        const { error } = await supabase
          .from('saved_reports')
          .update({ title, content: htmlContent })
          .eq('id', currentReportId);
        if (error) throw error;
        toast.success('Relatório atualizado!');
      } else {
        const { data, error } = await supabase
          .from('saved_reports')
          .insert({
            user_id: user.id,
            title,
            content: htmlContent,
            mode: 'free',
            patient_id: selectedPatient || null,
          })
          .select()
          .single();
        if (error) throw error;
        setCurrentReportId(data.id);
        toast.success('Relatório salvo!');
      }
      loadSavedReports();
    } catch (e) {
      toast.error('Erro ao salvar relatório');
    } finally {
      setIsSaving(false);
    }
  }, [user, editor, reportTitle, currentReportId, selectedPatient, loadSavedReports]);

  const handleLoadReport = (report: SavedReport) => {
    editor?.commands.setContent(report.content);
    setReportTitle(report.title);
    setCurrentReportId(report.id);
    setShowSavedDialog(false);
    toast.success('Relatório carregado!');
  };

  const handleDeleteReport = async (id: string) => {
    const { error } = await supabase.from('saved_reports').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setSavedReports(prev => prev.filter(r => r.id !== id));
    if (currentReportId === id) { setCurrentReportId(null); }
    toast.success('Relatório excluído!');
  };

  const handleCopy = () => {
    const text = editor?.getText() || '';
    navigator.clipboard.writeText(text);
    toast.success('Copiado!');
  };

  const handleExportPDF = () => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim()) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 22;
    const contentWidth = pageWidth - margin * 2;
    const title = reportTitle || 'Relatório Clínico';
    const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const footerY = pageHeight - 12;

    // Helper: check page break
    const checkPage = (y: number, needed = 20) => {
      if (y > pageHeight - needed) {
        pdf.addPage();
        return 22;
      }
      return y;
    };

    // ==========================================
    // COVER / HEADER — centered, institutional
    // ==========================================
    let yPos = 35;
    pdf.setTextColor(30, 30, 30);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('RELATÓRIO CLÍNICO EVOLUTIVO', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Subtle divider
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.4);
    pdf.line(margin + 30, yPos, pageWidth - margin - 30, yPos);
    yPos += 8;

    // Report title & date
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(50, 50, 50);
    pdf.text(title, pageWidth / 2, yPos, { align: 'center' });
    yPos += 7;

    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(120, 120, 120);
    pdf.text(`Data de Emissão: ${dateStr}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 12;

    // Light divider
    pdf.setDrawColor(210, 210, 210);
    pdf.setLineWidth(0.2);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // ==========================================
    // BODY — parse text intelligently
    // ==========================================
    const rawLines = text.split('\n');
    let inTable = false;
    let tableRows: string[][] = [];
    let tableColWidths: number[] = [];

    const flushTable = () => {
      if (tableRows.length === 0) return;
      
      const cols = tableRows[0].length;
      const colW = contentWidth / cols;
      const rowH = 7;
      
      // Check if table fits
      const tableHeight = tableRows.length * rowH + 2;
      yPos = checkPage(yPos, tableHeight + 10);

      for (let r = 0; r < tableRows.length; r++) {
        const row = tableRows[r];
        const isHeader = r === 0;
        
        if (isHeader) {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, yPos - 4.5, contentWidth, rowH, 'F');
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          pdf.setTextColor(40, 40, 40);
        } else {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          // Alternate row shading
          if (r % 2 === 0) {
            pdf.setFillColor(250, 250, 250);
            pdf.rect(margin, yPos - 4.5, contentWidth, rowH, 'F');
          }
        }

        // Draw cell borders
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.15);
        pdf.line(margin, yPos + 2.5, pageWidth - margin, yPos + 2.5);

        for (let c = 0; c < row.length; c++) {
          const cellX = margin + c * colW + 3;
          const cellText = (row[c] || '').trim();
          const truncated = cellText.length > 45 ? cellText.slice(0, 42) + '...' : cellText;
          pdf.text(truncated, cellX, yPos);
        }
        yPos += rowH;
        yPos = checkPage(yPos);
      }
      yPos += 5;
      tableRows = [];
      inTable = false;
    };

    for (let li = 0; li < rawLines.length; li++) {
      const rawLine = rawLines[li];
      const trimmed = rawLine.trim();

      // Skip markdown-style dividers (---, ***, ===)
      if (/^[-*=]{3,}$/.test(trimmed)) continue;
      // Skip table separator rows (|---|---|)
      if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;

      // Detect table rows
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed.split('|').filter(c => c.trim() !== '');
        if (cells.length >= 2) {
          inTable = true;
          tableRows.push(cells.map(c => c.trim()));
          continue;
        }
      }

      // If we were in a table, flush it
      if (inTable) flushTable();

      // Empty line → spacing
      if (trimmed === '') { yPos += 3; continue; }

      // Detect numbered section headings: "1.", "2.", "1.1", "3.1."
      const isSectionHeading = /^\d+(\.\d+)?\.?\s/.test(trimmed) && trimmed.length < 100;
      // Detect ALL CAPS headings
      const isAllCaps = trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80 && !/^\d/.test(trimmed);
      // Detect markdown headings
      const isMdHeading = /^#{1,3}\s/.test(trimmed);

      if (isSectionHeading || isAllCaps || isMdHeading) {
        yPos += 5;
        yPos = checkPage(yPos, 15);

        const headingText = trimmed.replace(/^#{1,3}\s/, '');

        // Draw a subtle left accent bar for section headings
        if (isSectionHeading) {
          pdf.setFillColor(80, 80, 80);
          pdf.rect(margin - 1, yPos - 4, 1.5, 5, 'F');
        }

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(isSectionHeading ? 11.5 : 11);
        pdf.setTextColor(25, 25, 25);
        const headingLines = pdf.splitTextToSize(headingText, contentWidth - 5);
        for (const hl of headingLines) {
          yPos = checkPage(yPos, 10);
          pdf.text(hl, margin + 2, yPos);
          yPos += 6;
        }
        yPos += 2;

        // Reset to body style
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(45, 45, 45);
        continue;
      }

      // Bullet / numbered list items
      const isBullet = /^[-•]\s/.test(trimmed);
      const isNumberedItem = /^\d+\)\s/.test(trimmed);

      if (isBullet || isNumberedItem) {
        const itemText = isBullet ? trimmed.slice(2) : trimmed;
        const prefix = isBullet ? '•' : '';
        const indent = isBullet ? 6 : 0;
        const displayText = isBullet ? `${prefix}  ${itemText}` : itemText;
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(45, 45, 45);
        const wrapped = pdf.splitTextToSize(displayText, contentWidth - indent);

        for (let w = 0; w < wrapped.length; w++) {
          yPos = checkPage(yPos);
          pdf.text(wrapped[w], margin + indent, yPos);
          yPos += 5;
        }
        yPos += 1.5;
        continue;
      }

      // Regular paragraph text
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(45, 45, 45);
      const wrapped = pdf.splitTextToSize(trimmed, contentWidth);
      for (const wl of wrapped) {
        yPos = checkPage(yPos);
        pdf.text(wl, margin, yPos);
        yPos += 5;
      }
      yPos += 2;
    }

    // Flush any remaining table
    if (inTable) flushTable();

    // ==========================================
    // SIGNATURE SECTION
    // ==========================================
    yPos += 10;
    yPos = checkPage(yPos, 40);

    // Divider before signature
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 15;

    // Signature line
    const sigLineW = 65;
    const sigX = pageWidth / 2 - sigLineW / 2;
    pdf.setDrawColor(100, 100, 100);
    pdf.setLineWidth(0.3);
    pdf.line(sigX, yPos, sigX + sigLineW, yPos);
    yPos += 5;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 60);
    pdf.text('Responsável Técnico', pageWidth / 2, yPos, { align: 'center' });
    yPos += 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(130, 130, 130);
    pdf.text('(Assinatura e Carimbo)', pageWidth / 2, yPos, { align: 'center' });

    // ==========================================
    // FOOTER — all pages, centered page number
    // ==========================================
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setTextColor(170, 170, 170);
      pdf.setFontSize(7.5);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Página ${i} de ${total}`, pageWidth / 2, footerY, { align: 'center' });
    }

    pdf.save(`${title.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF exportado!');
  };

  const handleShareEmail = () => {
    const text = editor?.getText() || '';
    const subject = encodeURIComponent(reportTitle || 'Relatório Clínico');
    const body = encodeURIComponent(text);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleShareLink = async () => {
    const text = editor?.getText() || '';
    if (!text.trim()) { toast.error('Nada para compartilhar'); return; }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Texto do relatório copiado! Cole em qualquer app para compartilhar.');
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className={cn("w-6 h-6", isLilas ? "text-purple-400" : "text-primary")} />
            Relatórios com IA
          </h1>
          <p className="text-muted-foreground">Gere, edite e salve relatórios profissionais</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { loadSavedReports(); setShowSavedDialog(true); }} className="gap-2">
            <FolderOpen className="w-4 h-4" /> Salvos ({savedReports.length})
          </Button>
          <Button variant="outline" size="sm" onClick={handleShareEmail} className="gap-2">
            <Mail className="w-4 h-4" /> E-mail
          </Button>
          <Button variant="outline" size="sm" onClick={handleShareLink} className="gap-2">
            <Link2 className="w-4 h-4" /> Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
          <Button size="sm" onClick={() => handleExportPDF()} className="gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="guided" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="guided" className="gap-2">
            <UserSearch className="w-4 h-4" /> Guiado
          </TabsTrigger>
          <TabsTrigger value="free" className="gap-2">
            <MessageSquare className="w-4 h-4" /> Livre
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guided">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><FileText className="w-5 h-5" /> Relatório por Paciente</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                  <SelectTrigger><SelectValue placeholder="Selecione um paciente" /></SelectTrigger>
                  <SelectContent>
                    {patients.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {clinics.find(c => c.id === p.clinicId)?.name || ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Último mês</SelectItem>
                    <SelectItem value="quarter">Último trimestre</SelectItem>
                    <SelectItem value="semester">Último semestre</SelectItem>
                    <SelectItem value="all">Todo o período</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={generateGuided} disabled={isGenerating || !selectedPatient} className="gap-2">
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Gerar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="free">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Comando Livre</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Ex: Gere um relatório mensal de frequência de todos os pacientes..."
                value={freeCommand}
                onChange={(e) => setFreeCommand(e.target.value)}
                rows={3}
              />
              <Button onClick={generateFree} disabled={isGenerating || !freeCommand.trim()} className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gerar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Editor */}
      <Card className="glass-card overflow-hidden">
        <CardHeader className="border-b border-border pb-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <Sparkles className={cn("w-5 h-5", isLilas ? "text-purple-400" : "text-primary")} />
            <Input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              placeholder="Título do relatório..."
              className="text-lg font-semibold border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
            />
            {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <EditorToolbar editor={editor} />
        <CardContent className="p-0">
          <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-6 [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4 [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_p]:mb-2 [&_.ProseMirror_p]:leading-relaxed" />
        </CardContent>
      </Card>

      {/* Saved Reports Dialog */}
      <Dialog open={showSavedDialog} onOpenChange={setShowSavedDialog}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Relatórios Salvos</DialogTitle></DialogHeader>
          {savedReports.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum relatório salvo ainda.</p>
          ) : (
            <div className="space-y-2">
              {savedReports.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                  <button
                    className="flex-1 text-left"
                    onClick={() => handleLoadReport(r)}
                  >
                    <p className="font-medium text-foreground text-sm">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeleteReport(r.id); }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
