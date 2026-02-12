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
  AlignCenter, AlignRight, AlignJustify, Image as ImageIcon, Type, List, Share2, Mail, Link2,
  MoveLeft, MoveHorizontal, MoveRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
// jsPDF now handled by generateReportPdf utility
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/react';

const CustomImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      dataAlign: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.dataAlign, style: `display:block;${attrs.dataAlign === 'center' ? 'margin:0 auto;' : attrs.dataAlign === 'right' ? 'margin-left:auto;margin-right:0;' : 'margin-right:auto;margin-left:0;'}${attrs.width ? `width:${attrs.width};` : ''}` }),
      },
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs) => attrs.width ? { width: attrs.width } : {},
      },
    };
  },
});
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

// loadImageFromUrl now handled by generateReportPdf utility

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
      const fileName = `report-images/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('attachments').upload(fileName, file);
      if (error) { toast.error('Erro ao enviar imagem'); return; }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    };
    input.click();
  };

  const resizeImage = (scale: number) => {
    const { state } = editor;
    const { selection } = state;
    const node = state.doc.nodeAt(selection.from);
    if (node?.type.name === 'image') {
      const currentWidth = node.attrs.width;
      let newWidth: string;
      if (currentWidth) {
        const num = parseInt(currentWidth);
        newWidth = `${Math.max(50, Math.min(1200, num * scale))}px`;
      } else {
        newWidth = scale > 1 ? '600px' : '300px';
      }
      editor.chain().focus().updateAttributes('image', { width: newWidth }).run();
    } else {
      toast.info('Selecione uma imagem primeiro');
    }
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

      <Button variant={editor.isActive('bold') ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('italic') ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('underline') ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant={editor.isActive('bulletList') ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addImage}><ImageIcon className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Type className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => resizeImage(0.75)}
        title="Diminuir imagem">🔍➖</Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => resizeImage(1.33)}
        title="Aumentar imagem">🔍➕</Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imagem à esquerda"
        onClick={() => { const { state } = editor; const node = state.doc.nodeAt(state.selection.from); if (node?.type.name === 'image') editor.chain().focus().updateAttributes('image', { dataAlign: 'left' }).run(); else toast.info('Selecione uma imagem'); }}>
        <MoveLeft className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imagem centralizada"
        onClick={() => { const { state } = editor; const node = state.doc.nodeAt(state.selection.from); if (node?.type.name === 'image') editor.chain().focus().updateAttributes('image', { dataAlign: 'center' }).run(); else toast.info('Selecione uma imagem'); }}>
        <MoveHorizontal className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" title="Imagem à direita"
        onClick={() => { const { state } = editor; const node = state.doc.nodeAt(state.selection.from); if (node?.type.name === 'image') editor.chain().focus().updateAttributes('image', { dataAlign: 'right' }).run(); else toast.info('Selecione uma imagem'); }}>
        <MoveRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export default function AIReports() {
  const { clinics, patients } = useApp();
  const { user } = useAuth();
  const { theme } = useTheme();
  const isLilas = theme === 'lilas';

  const [selectedPatient, setSelectedPatient] = useState('');
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('month');
  const [freeCommand, setFreeCommand] = useState('');
  const [guidedCommand, setGuidedCommand] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportTitle, setReportTitle] = useState('');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSavedDialog, setShowSavedDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveDestination, setSaveDestination] = useState<'patient' | 'clinic'>('patient');
  const [saveClinicId, setSaveClinicId] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomImage.configure({ allowBase64: false, inline: false, HTMLAttributes: { class: 'max-w-full rounded-lg cursor-pointer transition-all' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right', 'justify'], defaultAlignment: 'justify' }),
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
      body: { mode: 'guided', patientId: selectedPatient, period: selectedPeriod, command: guidedCommand || undefined },
      onDelta: (chunk) => {
        content += chunk;
        editor?.commands.setContent(markdownToHtml(content));
      },
      onDone: () => setIsGenerating(false),
      onError: (msg) => { toast.error(msg); setIsGenerating(false); },
    });
  }, [selectedPatient, selectedPeriod, editor, patients, guidedCommand]);

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
      // Always insert a new record (never update) so multiple saves create multiple entries
      const inserts: Array<{
        user_id: string;
        title: string;
        content: string;
        mode: string;
        patient_id: string | null;
        clinic_id: string | null;
      }> = [];

      if (saveDestination === 'patient' && selectedPatient) {
        // Find the patient's clinic to save in both places
        const pat = patients.find(p => p.id === selectedPatient);
        const patClinicId = pat?.clinicId || null;

        // Save with patient_id (appears in patient tab)
        inserts.push({
          user_id: user.id,
          title,
          content: htmlContent,
          mode: 'free',
          patient_id: selectedPatient,
          clinic_id: null,
        });

        // Also save with clinic_id (appears in clinic tab)
        if (patClinicId) {
          inserts.push({
            user_id: user.id,
            title,
            content: htmlContent,
            mode: 'free',
            patient_id: null,
            clinic_id: patClinicId,
          });
        }
      } else if (saveDestination === 'clinic' && saveClinicId) {
        inserts.push({
          user_id: user.id,
          title,
          content: htmlContent,
          mode: 'free',
          patient_id: null,
          clinic_id: saveClinicId,
        });
      }

      if (inserts.length === 0) {
        toast.error('Selecione onde salvar');
        setIsSaving(false);
        return;
      }

      const { error } = await supabase.from('saved_reports').insert(inserts);
      if (error) throw error;

      setCurrentReportId(null);
      toast.success('Relatório salvo!');
      loadSavedReports();
    } catch (e) {
      toast.error('Erro ao salvar relatório');
    } finally {
      setIsSaving(false);
    }
  }, [user, editor, reportTitle, selectedPatient, patients, saveDestination, saveClinicId, loadSavedReports]);

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

  const handleExportPDF = async () => {
    if (!editor) return;
    const htmlCheck = editor.getText();
    if (!htmlCheck.trim()) return;

    const { generateReportPdf } = await import('@/utils/generateReportPdf');
    const clinic = clinics.find(c => c.id === selectedClinic);
    const title = reportTitle || 'Relatório Clínico';

    await generateReportPdf({
      title,
      content: editor.getHTML(),
      fileName: `${title.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}`,
      clinicName: clinic?.name,
      clinicAddress: clinic?.address,
      clinicLetterhead: clinic?.letterhead,
      clinicEmail: clinic?.email,
      clinicCnpj: clinic?.cnpj,
      clinicPhone: clinic?.phone,
      clinicServicesDescription: clinic?.servicesDescription,
    });
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
          <Button size="sm" onClick={() => handleExportPDF()} className="gap-2">
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </div>

      {/* Save destination with integrated save button */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-secondary/50 rounded-xl border border-border">
        <span className="text-sm font-medium text-foreground">💾 Salvar em:</span>
        <div className="flex gap-2">
          <Button
            variant={saveDestination === 'patient' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSaveDestination('patient')}
            className="gap-1 text-xs"
          >
            📋 Pasta do Paciente
          </Button>
          <Button
            variant={saveDestination === 'clinic' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSaveDestination('clinic')}
            className="gap-1 text-xs"
          >
            🏥 Pasta da Clínica
          </Button>
        </div>
        {saveDestination === 'clinic' && (
          <Select value={saveClinicId} onValueChange={setSaveClinicId}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Selecione a clínica" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {saveDestination === 'patient' && (
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder="Selecione o paciente" />
            </SelectTrigger>
            <SelectContent>
              {patients.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {clinics.find(c => c.id === p.clinicId)?.name || ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button 
          size="sm" 
          onClick={handleSave} 
          disabled={isSaving || (saveDestination === 'patient' && !selectedPatient) || (saveDestination === 'clinic' && !saveClinicId)} 
          className="gap-2 ml-auto"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Relatório
        </Button>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select value={selectedClinic} onValueChange={setSelectedClinic}>
                  <SelectTrigger><SelectValue placeholder="Clínica (timbrado no PDF)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem timbrado</SelectItem>
                    {clinics.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              </div>
              <Textarea
                placeholder="Ex: Foque nos aspectos psicomotores, inclua recomendações para a escola..."
                value={guidedCommand}
                onChange={(e) => setGuidedCommand(e.target.value)}
                rows={2}
              />
              <Button onClick={generateGuided} disabled={isGenerating || !selectedPatient} className="gap-2">
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Gerar
              </Button>
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
        <CardHeader className="border-b border-border pb-3 bg-muted/30 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("w-5 h-5", isLilas ? "text-purple-400" : "text-primary")} />
            <span className="text-sm font-medium text-muted-foreground">Título do Relatório</span>
            {isGenerating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
          </div>
          <Input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            placeholder="Digite o título do relatório..."
            className="text-lg font-semibold h-11 bg-background/50 border-border"
          />
        </CardHeader>
        <EditorToolbar editor={editor} />
        <CardContent className="p-0">
          <EditorContent editor={editor} className="[&_.ProseMirror]:min-h-[400px] [&_.ProseMirror]:p-4 sm:[&_.ProseMirror]:p-6 [&_.ProseMirror_img]:rounded-lg [&_.ProseMirror_img]:my-4 [&_.ProseMirror_img]:cursor-pointer [&_.ProseMirror_img]:transition-all [&_.ProseMirror_img.ProseMirror-selectednode]:ring-2 [&_.ProseMirror_img.ProseMirror-selectednode]:ring-primary [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:mb-3 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-bold [&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:ml-6 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:ml-6 [&_.ProseMirror_p]:mb-0 [&_.ProseMirror_p]:leading-normal [&_.ProseMirror]:text-justify" />
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
