import { useState, useEffect, useMemo, useRef } from 'react';
import { isPatientActiveOn } from '@/utils/dateHelpers';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradeBlock } from '@/components/UpgradeBlock';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PatientSearchSelect } from '@/components/ui/patient-search-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Loader2, Sparkles, Save, Download, Upload, FileText, Image as ImageIcon, Trash2,
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, Type, Stamp, Plus, X, FileType, Pencil, FolderPlus, BookOpen, Paperclip,
} from 'lucide-react';
import { generateAIDocumentPdf, ExtraSignature } from '@/utils/generateAIDocumentPdf';
import { generateAIDocumentDocx } from '@/utils/aiDocumentDocxExport';

import { useEditor, EditorContent, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import UnderlineExt from '@tiptap/extension-underline';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import FontSize from '@tiptap/extension-font-size';

const CustomImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('width') || el.style.width || null,
        renderHTML: (attrs) => attrs.width ? { width: attrs.width, style: `width:${attrs.width}` } : {},
      },
    };
  },
});

interface DocRow {
  id: string;
  title: string;
  doc_type: string;
  patient_id: string;
  clinic_id: string;
  content: string;
  file_url: string | null;
  file_path: string | null;
  created_at: string;
}

interface StampRow {
  id: string;
  name: string;
  clinical_area: string | null;
  cbo: string | null;
  stamp_image: string | null;
  signature_image: string | null;
  is_default: boolean | null;
}

interface DocTemplateRow {
  id: string;
  name: string;
  default_title: string | null;
  instructions: string;
  example_text: string;
}

const DOC_TYPES = [
  { value: 'declaracao', label: 'Declaração de Comparecimento' },
  { value: 'frequencia', label: 'Ficha de Frequência' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'livre', label: 'Documento Livre / Personalizado' },
];

const docTypeLabel = (t: string) => DOC_TYPES.find(d => d.value === t)?.label || t;

// =======================================================================
// EDITOR TOOLBAR
// =======================================================================
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const addImage = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Sessão inválida'); return; }
      const path = `${user.id}/doc-ia-images/${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) { toast.error('Erro ao enviar imagem'); return; }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
    };
    input.click();
  };

  const resizeImage = (scale: number) => {
    const { state } = editor;
    const node = state.doc.nodeAt(state.selection.from);
    if (node?.type.name === 'image') {
      const cur = node.attrs.width;
      const num = cur ? parseInt(cur) : 400;
      const next = `${Math.max(50, Math.min(1200, Math.round(num * scale)))}px`;
      editor.chain().focus().updateAttributes('image', { width: next }).run();
    } else {
      toast.info('Selecione uma imagem primeiro');
    }
  };

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-muted/30 rounded-t-lg">
      <Select
        value={editor.getAttributes('textStyle').fontFamily || 'Georgia'}
        onValueChange={(v) => editor.chain().focus().setFontFamily(v).run()}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Fonte" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Georgia">Georgia</SelectItem>
          <SelectItem value="Arial">Arial</SelectItem>
          <SelectItem value="Times New Roman">Times New Roman</SelectItem>
          <SelectItem value="Calibri">Calibri</SelectItem>
          <SelectItem value="Verdana">Verdana</SelectItem>
          <SelectItem value="Courier New">Courier New</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={editor.getAttributes('textStyle').fontSize || '14px'}
        onValueChange={(v) => editor.chain().focus().setFontSize(v).run()}
      >
        <SelectTrigger className="w-[80px] h-8 text-xs"><SelectValue placeholder="Tam." /></SelectTrigger>
        <SelectContent>
          {['10px','11px','12px','13px','14px','16px','18px','20px','24px','28px','32px','36px'].map(s => (
            <SelectItem key={s} value={s}>{s.replace('px','')}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant={editor.isActive('bold') ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('italic') ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('underline') ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant={editor.isActive({ textAlign: 'left' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'center' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'right' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive({ textAlign: 'justify' }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant={editor.isActive('bulletList') ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></Button>
      <Button variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Type className="w-3.5 h-3.5" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={addImage} title="Inserir imagem"><ImageIcon className="w-3.5 h-3.5" /></Button>

      <div className="w-px h-8 bg-border mx-1" />

      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => resizeImage(0.8)} title="Diminuir imagem">🔍−</Button>
      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => resizeImage(1.25)} title="Aumentar imagem">🔍+</Button>
    </div>
  );
}

// =======================================================================
// MAIN PAGE
// =======================================================================
export default function DocIA() {
  const { patients, clinics, addAttachment } = useApp();
  const { user } = useAuth();
  const { hasAI, loading: featureLoading } = useFeatureAccess();

  // Tab 1: Timbrado
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [headerText, setHeaderText] = useState('');
  const [footerText, setFooterText] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [savingTimbrado, setSavingTimbrado] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // Tab 3: Criar
  const [createPatientId, setCreatePatientId] = useState('');
  const [createDocType, setCreateDocType] = useState('declaracao');
  const [instructions, setInstructions] = useState('');
  const [exampleText, setExampleText] = useState('');
  const [draftTitle, setDraftTitle] = useState('');
  const [generatingText, setGeneratingText] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf');
  const [hasDraft, setHasDraft] = useState(false);

  // Custom templates (saved models for "Documento Livre")
  const [templates, setTemplates] = useState<DocTemplateRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [extractingExample, setExtractingExample] = useState(false);
  const exampleFileRef = useRef<HTMLInputElement>(null);

  // Stamp + extra signatures
  const [stamps, setStamps] = useState<StampRow[]>([]);
  const [includeStamp, setIncludeStamp] = useState(false);
  const [selectedStampId, setSelectedStampId] = useState<string>('');
  const [extraSignatures, setExtraSignatures] = useState<ExtraSignature[]>([]);

  // Tab 2: Histórico
  const [history, setHistory] = useState<DocRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingToFolderId, setSavingToFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('create');

  const [profile, setProfile] = useState<{ name?: string; cpf?: string; professional_id?: string } | null>(null);

  // ---------- Editor ----------
  const editor = useEditor({
    extensions: [
      StarterKit,
      CustomImage.configure({ allowBase64: false, inline: false, HTMLAttributes: { class: 'max-w-full rounded' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left','center','right','justify'], defaultAlignment: 'justify' }),
      UnderlineExt,
      TextStyle,
      FontFamily,
      FontSize,
    ],
    content: '<p style="text-align:justify"></p>',
    editorProps: {
      attributes: { class: 'prose prose-sm max-w-none p-6 min-h-[400px] focus:outline-none bg-white text-black' },
    },
  });

  useEffect(() => {
    if (clinics.length > 0 && !selectedClinicId) {
      const first = clinics.find(c => !c.isArchived) || clinics[0];
      setSelectedClinicId(first.id);
    }
  }, [clinics, selectedClinicId]);

  useEffect(() => {
    if (!selectedClinicId) return;
    (async () => {
      const { data } = await supabase.from('clinics')
        .select('document_logo_url, document_header_text, document_footer_text')
        .eq('id', selectedClinicId).maybeSingle();
      setLogoUrl((data as any)?.document_logo_url || null);
      setHeaderText((data as any)?.document_header_text || '');
      setFooterText((data as any)?.document_footer_text || '');
    })();
  }, [selectedClinicId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: stampList }] = await Promise.all([
        supabase.from('profiles').select('name, cpf, professional_id').eq('user_id', user.id).maybeSingle(),
        supabase.from('stamps').select('id, name, clinical_area, cbo, stamp_image, signature_image, is_default').eq('user_id', user.id),
      ]);
      setProfile(prof || null);
      const list = (stampList as StampRow[]) || [];
      setStamps(list);
      const def = list.find(s => s.is_default && s.stamp_image) || list.find(s => s.stamp_image);
      if (def) setSelectedStampId(def.id);
    })();
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data, error } = await supabase
      .from('patient_documents')
      .select('id, title, doc_type, patient_id, clinic_id, content, file_url, file_path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar histórico');
    setHistory((data as DocRow[]) || []);
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, [user]);

  const loadTemplates = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('doc_ia_templates')
      .select('id, name, default_title, instructions, example_text')
      .eq('user_id', user.id)
      .order('name', { ascending: true });
    if (error) { console.error('[DocIA] loadTemplates', error); return; }
    setTemplates((data as DocTemplateRow[]) || []);
  };
  useEffect(() => { loadTemplates(); }, [user]);

  const applyTemplate = (id: string) => {
    setSelectedTemplateId(id);
    if (!id) return;
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setCreateDocType('livre');
    setInstructions(t.instructions || '');
    setExampleText(t.example_text || '');
    if (t.default_title) setDraftTitle(t.default_title);
    toast.success(`Modelo "${t.name}" aplicado`);
  };

  const handleSaveAsTemplate = async () => {
    if (!user) return;
    const name = newTemplateName.trim();
    if (!name) { toast.error('Dê um nome ao modelo'); return; }
    if (!instructions.trim() && !exampleText.trim()) {
      toast.error('Preencha instruções ou exemplo antes de salvar o modelo');
      return;
    }
    setSavingTemplate(true);
    const { error } = await supabase.from('doc_ia_templates').insert({
      user_id: user.id,
      name,
      default_title: draftTitle || name,
      instructions,
      example_text: exampleText,
    });
    setSavingTemplate(false);
    if (error) { toast.error('Erro ao salvar modelo: ' + error.message); return; }
    toast.success('Modelo salvo!');
    setNewTemplateName('');
    loadTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Excluir este modelo?')) return;
    const { error } = await supabase.from('doc_ia_templates').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir modelo'); return; }
    if (selectedTemplateId === id) setSelectedTemplateId('');
    toast.success('Modelo excluído');
    loadTemplates();
  };

  // Extract plain text from .pdf, .docx or .txt and append to exampleText
  const handleExampleFileUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error('Máximo 20MB'); return; }
    setExtractingExample(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let text = '';
      if (ext === 'pdf') {
        const buf = await file.arrayBuffer();
        const pdfjsLib: any = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
        const parts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          parts.push((content.items as any[]).map(it => it.str).join(' '));
        }
        text = parts.join('\n\n').trim();
      } else if (ext === 'docx') {
        const buf = await file.arrayBuffer();
        const mammoth: any = await import('mammoth/mammoth.browser');
        const result = await mammoth.extractRawText({ arrayBuffer: buf });
        text = (result?.value || '').trim();
      } else if (ext === 'txt' || file.type.startsWith('text/')) {
        text = (await file.text()).trim();
      } else {
        toast.error('Formato não suportado. Use .pdf, .docx ou .txt');
        return;
      }
      if (!text) { toast.error('Não foi possível extrair texto deste arquivo (talvez esteja escaneado)'); return; }
      setExampleText(prev => prev ? `${prev}\n\n--- Exemplo: ${file.name} ---\n${text}` : text);
      toast.success(`Exemplo "${file.name}" anexado (${text.length} caracteres)`);
    } catch (e: any) {
      console.error('[DocIA] example extract error', e);
      toast.error('Erro ao ler arquivo: ' + (e?.message || 'desconhecido'));
    } finally {
      setExtractingExample(false);
      if (exampleFileRef.current) exampleFileRef.current.value = '';
    }
  };

  // ---------- Handlers ----------
  const handleLogoUpload = async (file: File) => {
    if (!user || !selectedClinicId) return;
    if (!file.type.startsWith('image/')) { toast.error('Selecione uma imagem'); return; }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/clinic-logos/${selectedClinicId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast.success('Logo carregada — clique em Salvar para aplicar');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar logo');
    } finally { setUploadingLogo(false); }
  };

  const handleSaveTimbrado = async () => {
    if (!selectedClinicId) return;
    setSavingTimbrado(true);
    const { error } = await supabase.from('clinics').update({
      document_logo_url: logoUrl,
      document_header_text: headerText,
      document_footer_text: footerText,
    } as any).eq('id', selectedClinicId);
    setSavingTimbrado(false);
    if (error) { toast.error('Erro ao salvar timbrado'); return; }
    toast.success('Timbrado salvo!');
  };

  const handleGenerateText = async () => {
    if (!createPatientId) { toast.error('Selecione um paciente'); return; }
    const patient = patients.find(p => p.id === createPatientId);
    if (!patient) { toast.error('Paciente não encontrado'); return; }
    const clinic = clinics.find(c => c.id === patient.clinicId) || clinics.find(c => c.id === selectedClinicId);

    setGeneratingText(true);
    editor?.commands.setContent('<p style="text-align:justify">Gerando rascunho com IA...</p>');
    try {
      const todayBR = new Date().toLocaleDateString('pt-BR');
      const tpl = templates.find(t => t.id === selectedTemplateId);

      // Fetch full prontuário context: evolutions, intake forms and existing documents
      const [evoRes, intakeRes, docsRes] = await Promise.all([
        supabase.from('evolutions')
          .select('date, attendance_status, mood, text, session_time')
          .eq('patient_id', createPatientId)
          .order('date', { ascending: false })
          .limit(60),
        supabase.from('patient_intake_forms')
          .select('answers, created_at')
          .eq('patient_id', createPatientId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('patient_documents')
          .select('title, doc_type, content, created_at')
          .eq('patient_id', createPatientId)
          .order('created_at', { ascending: false })
          .limit(15),
      ]);

      const evolutions = (evoRes.data || []).map((e: any) => ({
        date: e.date,
        status: e.attendance_status,
        mood: e.mood,
        time: e.session_time,
        text: (e.text || '').slice(0, 1500),
      }));
      const intakeForms = (intakeRes.data || []).map((f: any) => f.answers).filter(Boolean);
      const documents = (docsRes.data || []).map((d: any) => ({
        title: d.title,
        type: d.doc_type,
        date: d.created_at,
        excerpt: typeof d.content === 'string' ? d.content.slice(0, 800) : '',
      }));

      const { data, error } = await supabase.functions.invoke('generate-document-text', {
        body: {
          docType: createDocType,
          patient: {
            name: patient.name,
            birthdate: patient.birthdate ? new Date(patient.birthdate).toLocaleDateString('pt-BR') : null,
            cpf: (patient as any).cpf,
            responsibleName: patient.responsibleName,
            responsibleCpf: (patient as any).responsible_cpf,
            diagnosis: (patient as any).diagnosis,
            clinicalArea: (patient as any).clinical_area || (patient as any).clinicalArea,
            observations: (patient as any).observations,
            contractStartDate: (patient as any).contract_start_date || (patient as any).contractStartDate,
            weekdays: (patient as any).weekdays,
            scheduleByDay: (patient as any).schedule_by_day || (patient as any).scheduleByDay,
            paymentValue: (patient as any).payment_value ?? (patient as any).paymentValue,
            healthPlan: (patient as any).health_plan_id || (patient as any).healthPlanId,
          },
          clinic: clinic ? { name: clinic.name, cnpj: clinic.cnpj, address: clinic.address } : null,
          professional: { name: profile?.name, cpf: profile?.cpf, professionalId: profile?.professional_id },
          instructions, todayBR,
          exampleText: exampleText || undefined,
          templateName: tpl?.name || undefined,
          context: { evolutions, intakeForms, documents },
        },
      });
      if (error) throw error;
      const text = (data as any)?.text || '';
      const title = (data as any)?.title || docTypeLabel(createDocType);

      // Convert plain text → HTML paragraphs (justified, indented)
      const html = text.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean)
        .map((p: string) => `<p style="text-align:justify; text-indent:32px">${p.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      editor?.commands.setContent(html);
      setDraftTitle(title);
      setHasDraft(true);
      toast.success('Rascunho gerado! Edite à vontade no editor.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar texto');
      editor?.commands.setContent('');
    } finally {
      setGeneratingText(false);
    }
  };

  const buildExportPayload = async () => {
    const patient = patients.find(p => p.id === createPatientId);
    if (!patient) throw new Error('Paciente não encontrado');
    const clinic = clinics.find(c => c.id === patient.clinicId) || clinics.find(c => c.id === selectedClinicId);
    if (!clinic) throw new Error('Clínica não encontrada');

    const { data: clinicData } = await supabase.from('clinics')
      .select('document_logo_url, document_header_text, document_footer_text')
      .eq('id', clinic.id).maybeSingle();

    const todayBR = new Date().toLocaleDateString('pt-BR');
    const cityFromHeader = (clinicData as any)?.document_header_text?.split('\n')[0] || clinic.name;
    const cityLine = `${cityFromHeader}, ${todayBR}`;
    const selectedStamp = includeStamp ? stamps.find(s => s.id === selectedStampId) : null;
    const stampUrl = selectedStamp?.stamp_image || null;

    // Prefer the selected stamp's identity (full name + clinical area + CBO) for the signature line.
    const professionalName = selectedStamp?.name || profile?.name || '';
    const regParts: string[] = [];
    if (selectedStamp?.clinical_area) regParts.push(selectedStamp.clinical_area);
    if (selectedStamp?.cbo) regParts.push(`CBO ${selectedStamp.cbo}`);
    if (profile?.professional_id) regParts.push(`Reg.: ${profile.professional_id}`);
    const profRegistration = regParts.join(' • ');

    const bodyHtml = editor?.getHTML() || '';

    return {
      patient, clinic, clinicData, todayBR, cityLine, professionalName, profRegistration, stampUrl, bodyHtml,
    };
  };

  const handleSaveAndGeneratePdf = async () => {
    if (!user) return;
    const bodyHtml = editor?.getHTML() || '';
    if (!createPatientId || !bodyHtml.replace(/<[^>]+>/g, '').trim()) {
      toast.error('Gere e revise o texto antes de salvar');
      return;
    }
    setSavingPdf(true);
    try {
      const { patient, clinic, clinicData, todayBR, cityLine, professionalName, profRegistration, stampUrl } = await buildExportPayload();

      // Embed export metadata inside the saved HTML so future Word/PDF exports keep stamp + signatures.
      const meta = {
        stampId: includeStamp ? selectedStampId : null,
        extraSignatures,
        professionalName,
        profRegistration,
      };
      const metaScript = `<script type="application/json" id="docia-meta">${JSON.stringify(meta).replace(/</g, '\\u003c')}</script>`;
      const persistedHtml = `${metaScript}${bodyHtml}`;

      const safeName = (draftTitle || 'documento').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
      let downloadBlob: Blob;
      let downloadUrl: string;
      let downloadExt: 'pdf' | 'docx' = exportFormat;

      if (exportFormat === 'pdf') {
        let pdfResult: { blob: Blob; dataUrl: string };
        try {
          pdfResult = await generateAIDocumentPdf({
            title: draftTitle || docTypeLabel(createDocType),
            bodyText: bodyHtml,
            logoUrl: (clinicData as any)?.document_logo_url || null,
            headerText: (clinicData as any)?.document_header_text || null,
            footerText: (clinicData as any)?.document_footer_text || null,
            professionalName,
            professionalRegistration: profRegistration,
            todayBR, cityLine,
            stampUrl,
            extraSignatures,
          });
        } catch (pdfErr: any) {
          console.error('[DocIA] PDF generation failed', pdfErr);
          throw new Error('Falha ao gerar PDF: ' + (pdfErr?.message || pdfErr));
        }
        downloadBlob = pdfResult.blob;
        downloadUrl = pdfResult.dataUrl;
      } else {
        downloadBlob = await generateAIDocumentDocx({
          title: draftTitle || docTypeLabel(createDocType),
          bodyHtml,
          logoUrl: (clinicData as any)?.document_logo_url || null,
          headerText: (clinicData as any)?.document_header_text || null,
          footerText: (clinicData as any)?.document_footer_text || null,
          professionalName,
          professionalRegistration: profRegistration,
          cityLine,
          stampUrl,
          extraSignatures,
        });
        downloadUrl = URL.createObjectURL(downloadBlob);
      }

      const path = `${user.id}/${createPatientId}/${Date.now()}-${safeName}.pdf`;
      const pdfSave = await generateAIDocumentPdf({
        title: draftTitle || docTypeLabel(createDocType),
        bodyText: bodyHtml,
        logoUrl: (clinicData as any)?.document_logo_url || null,
        headerText: (clinicData as any)?.document_header_text || null,
        footerText: (clinicData as any)?.document_footer_text || null,
        professionalName,
        professionalRegistration: profRegistration,
        todayBR,
        cityLine,
        stampUrl,
        extraSignatures,
      });
      const { error: upErr } = await supabase.storage.from('patient_documents')
        .upload(path, pdfSave.blob, { contentType: 'application/pdf', upsert: false });
      if (upErr) { console.error('[DocIA] storage upload failed', upErr); throw new Error('Falha ao enviar PDF: ' + upErr.message); }
      const { data: urlData } = supabase.storage.from('patient_documents').getPublicUrl(path);

      const { error: insErr } = await supabase.from('patient_documents').insert({
        user_id: user.id, clinic_id: clinic.id, patient_id: createPatientId,
        title: draftTitle || docTypeLabel(createDocType),
        doc_type: createDocType, content: persistedHtml,
        file_url: urlData.publicUrl, file_path: path,
      } as any);
      if (insErr) { console.error('[DocIA] DB insert failed', insErr); throw new Error('Falha ao salvar registro: ' + insErr.message); }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${safeName}.${downloadExt}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      if (exportFormat === 'docx') URL.revokeObjectURL(downloadUrl);

      toast.success(`Documento salvo e baixado em ${downloadExt.toUpperCase()}!`);
      editor?.commands.setContent('');
      setDraftTitle(''); setInstructions(''); setExampleText(''); setHasDraft(false);
      loadHistory();
    } catch (e: any) {
      console.error('[DocIA] handleSaveAndGeneratePdf error', e);
      toast.error(e?.message || 'Erro ao gerar documento');
    } finally { setSavingPdf(false); }
  };

  // ---------- Force download via blob (fixes "blocked" links) ----------
  const forceDownload = async (doc: DocRow, format: 'pdf' | 'docx') => {
    setDownloadingId(`${doc.id}-${format}`);
    try {
      const safeName = (doc.title || 'documento').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);

      if (format === 'pdf') {
        if (!doc.file_url && !doc.file_path) { toast.error('Arquivo PDF indisponível'); return; }
        let blob: Blob | null = null;
        // Prefer storage SDK download (uses bucket, no CORS issues)
        if (doc.file_path) {
          const { data, error } = await supabase.storage.from('patient_documents').download(doc.file_path);
          if (error) throw error;
          blob = data;
        } else if (doc.file_url) {
          const r = await fetch(doc.file_url);
          blob = await r.blob();
        }
        if (!blob) throw new Error('Falha ao baixar arquivo');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${safeName}.pdf`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Generate .docx on demand from stored HTML content
        const patient = patients.find(p => p.id === doc.patient_id);
        const clinic = clinics.find(c => c.id === doc.clinic_id);
        const { data: clinicData } = await supabase.from('clinics')
          .select('document_logo_url, document_header_text, document_footer_text')
          .eq('id', doc.clinic_id).maybeSingle();

        const todayBR = new Date(doc.created_at).toLocaleDateString('pt-BR');
        const cityFromHeader = (clinicData as any)?.document_header_text?.split('\n')[0] || clinic?.name || '';
        const cityLine = `${cityFromHeader}, ${todayBR}`;

        // Recover stamp + signatures persisted in the saved HTML so Word matches the original PDF.
        let metaStampId: string | null = null;
        let metaExtraSigs: { label: string }[] = [];
        let metaProfName: string | null = null;
        let metaProfReg: string | null = null;
        const metaMatch = doc.content.match(/<script[^>]*id=["']docia-meta["'][^>]*>([\s\S]*?)<\/script>/i);
        if (metaMatch) {
          try {
            const parsed = JSON.parse(metaMatch[1].replace(/\\u003c/g, '<'));
            metaStampId = parsed.stampId || null;
            metaExtraSigs = Array.isArray(parsed.extraSignatures) ? parsed.extraSignatures : [];
            metaProfName = parsed.professionalName || null;
            metaProfReg = parsed.profRegistration || null;
          } catch {}
        }

        let stampUrl: string | null = null;
        if (metaStampId) {
          const stamp = stamps.find(s => s.id === metaStampId);
          stampUrl = stamp?.stamp_image || null;
        }

        const fallbackReg = profile?.professional_id ? `Reg.: ${profile.professional_id}` : '';

        const blob = await generateAIDocumentDocx({
          title: doc.title,
          bodyHtml: doc.content,
          logoUrl: (clinicData as any)?.document_logo_url || null,
          headerText: (clinicData as any)?.document_header_text || null,
          footerText: (clinicData as any)?.document_footer_text || null,
          professionalName: metaProfName || profile?.name || '',
          professionalRegistration: metaProfReg || fallbackReg,
          cityLine,
          stampUrl,
          extraSignatures: metaExtraSigs,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${safeName}.docx`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success(`Download iniciado (${format.toUpperCase()})`);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao baixar');
    } finally { setDownloadingId(null); }
  };

  const handleDeleteDoc = async (doc: DocRow) => {
    if (!confirm('Excluir este documento?')) return;
    if (doc.file_path) {
      await supabase.storage.from('patient_documents').remove([doc.file_path]);
    }
    const { error } = await supabase.from('patient_documents').delete().eq('id', doc.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Documento excluído');
    loadHistory();
  };

  // Load a saved doc back into the editor for editing
  const handleEditDoc = (doc: DocRow) => {
    setCreatePatientId(doc.patient_id);
    setCreateDocType(doc.doc_type);
    setDraftTitle(doc.title);
    const cleanContent = (doc.content || '').replace(/<script[^>]*id=["']docia-meta["'][^>]*>[\s\S]*?<\/script>/gi, '');
    editor?.commands.setContent(cleanContent || '<p style="text-align:justify"></p>');
    setHasDraft(true);
    setActiveTab('create');
    toast.success('Documento carregado no editor — ajuste e salve novamente');
  };

  // Copy the existing PDF into the patient's attachments folder
  const handleSaveToPatientFolder = async (doc: DocRow) => {
    if (!user) return;
    if (!doc.file_path && !doc.file_url) {
      toast.error('Arquivo PDF indisponível para salvar na pasta');
      return;
    }
    setSavingToFolderId(doc.id);
    try {
      // Download original PDF
      let blob: Blob | null = null;
      if (doc.file_path) {
        const { data, error } = await supabase.storage.from('patient_documents').download(doc.file_path);
        if (error) throw error;
        blob = data;
      } else if (doc.file_url) {
        const r = await fetch(doc.file_url);
        blob = await r.blob();
      }
      if (!blob) throw new Error('Falha ao obter PDF');

      const safeName = (doc.title || 'documento').replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 60);
      const fileName = `${safeName}.pdf`;
      const path = `${user.id}/patient-${doc.patient_id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage.from('attachments')
        .upload(path, blob, { contentType: 'application/pdf', upsert: false });
      if (upErr) throw upErr;

      addAttachment({
        parentId: doc.patient_id,
        parentType: 'patient',
        name: fileName,
        data: path,
        type: 'application/pdf',
      });
      toast.success('Documento salvo na pasta do paciente!');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar na pasta');
    } finally {
      setSavingToFolderId(null);
    }
  };

  const patientOptions = useMemo(() =>
    patients.filter(p => isPatientActiveOn(p))
      .map(p => ({ id: p.id, name: p.name, clinicName: clinics.find(c => c.id === p.clinicId)?.name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [patients, clinics]
  );

  const patientName = (id: string) => patients.find(p => p.id === id)?.name || '—';

  const stampsWithImage = stamps.filter(s => s.stamp_image);

  if (!featureLoading && !hasAI) {
    return (
      <div className="container max-w-6xl mx-auto py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Doc IA — Hub de Documentos Inteligentes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gere declarações, recibos, fichas e documentos personalizados com IA.
          </p>
        </div>
        <UpgradeBlock feature="ia" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          Doc IA — Hub de Documentos Inteligentes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gere declarações, recibos, fichas e documentos personalizados com IA, com seu papel timbrado.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="create"><Sparkles className="w-4 h-4 mr-1.5" />Criar Documento</TabsTrigger>
          <TabsTrigger value="history"><FileText className="w-4 h-4 mr-1.5" />Histórico</TabsTrigger>
          <TabsTrigger value="timbrado"><ImageIcon className="w-4 h-4 mr-1.5" />Timbrado</TabsTrigger>
        </TabsList>

        {/* ============== CREATE ============== */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Definir o documento</CardTitle>
              <CardDescription>Escolha o paciente, o tipo e descreva instruções específicas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Paciente</Label>
                  <PatientSearchSelect value={createPatientId} onValueChange={setCreatePatientId} patients={patientOptions} placeholder="Selecione o paciente" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de documento</Label>
                  <Select value={createDocType} onValueChange={setCreateDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Instruções para a IA</Label>
                <Textarea
                  rows={4}
                  placeholder={'Ex: "Redija um termo de consentimento para uso de imagem em pesquisa, mencionando LGPD e direito de revogação"\n\nDica: descreva tudo que o documento precisa conter — finalidade, datas, valores, tom, parágrafos obrigatórios.'}
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                />
              </div>

              {createDocType === 'livre' && (
                <div className="space-y-3 p-3 rounded-lg border border-dashed border-primary/40 bg-primary/5">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Modelos personalizados
                  </div>

                  {templates.length > 0 && (
                    <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Carregar modelo salvo</Label>
                        <Select value={selectedTemplateId} onValueChange={applyTemplate}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Escolha um modelo" /></SelectTrigger>
                          <SelectContent>
                            {templates.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedTemplateId && (
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteTemplate(selectedTemplateId)} className="h-9">
                          <Trash2 className="w-3.5 h-3.5 mr-1 text-destructive" /> Excluir modelo
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <Label className="text-xs">Exemplo / modelo de referência (opcional)</Label>
                    <Textarea
                      rows={6}
                      placeholder="Cole aqui um documento existente que sirva de modelo. A IA seguirá rigorosamente sua estrutura, tom e formatação, substituindo apenas os dados pelo do paciente atual."
                      value={exampleText}
                      onChange={e => setExampleText(e.target.value)}
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        ref={exampleFileRef}
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        hidden
                        onChange={e => e.target.files?.[0] && handleExampleFileUpload(e.target.files[0])}
                      />
                      <Button variant="outline" size="sm" onClick={() => exampleFileRef.current?.click()} disabled={extractingExample} className="h-8">
                        {extractingExample ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Paperclip className="w-3.5 h-3.5 mr-1" />}
                        Anexar exemplo (.pdf, .docx, .txt)
                      </Button>
                      {exampleText && (
                        <Button variant="ghost" size="sm" onClick={() => setExampleText('')} className="h-8">
                          <X className="w-3.5 h-3.5 mr-1" /> Limpar exemplo
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground">O texto extraído é enviado para a IA como modelo a ser seguido.</span>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end pt-1">
                    <div className="space-y-1">
                      <Label className="text-xs">Salvar configuração atual como modelo</Label>
                      <Input
                        placeholder="Nome do modelo (ex: Termo de Consentimento — Imagem)"
                        value={newTemplateName}
                        onChange={e => setNewTemplateName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSaveAsTemplate} disabled={savingTemplate} className="h-9">
                      {savingTemplate ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Salvar modelo
                    </Button>
                  </div>
                </div>
              )}

              <Button onClick={handleGenerateText} disabled={generatingText || !createPatientId}>
                {generatingText ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {generatingText ? 'Gerando...' : 'Gerar Rascunho com IA'}
              </Button>
            </CardContent>
          </Card>

          {hasDraft && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">2. Revisar e editar</CardTitle>
                <CardDescription>Editor estilo Word — formate o texto, insira imagens e ajuste tamanhos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Título do documento</Label>
                  <Input value={draftTitle} onChange={e => setDraftTitle(e.target.value)} placeholder="Título" />
                </div>

                <div className="space-y-1.5">
                  <Label>Corpo do documento</Label>
                  <div className="border border-border rounded-lg overflow-hidden">
                    <EditorToolbar editor={editor} />
                    <EditorContent editor={editor} className="bg-white text-black" />
                  </div>
                </div>

                {/* Stamp + extra signatures */}
                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                  {/* Stamp */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id="include-stamp" checked={includeStamp} onCheckedChange={(v) => setIncludeStamp(!!v)} disabled={stampsWithImage.length === 0} />
                      <Label htmlFor="include-stamp" className="flex items-center gap-1.5 cursor-pointer">
                        <Stamp className="w-4 h-4" /> Incluir carimbo profissional
                      </Label>
                    </div>
                    {stampsWithImage.length === 0 ? (
                      <p className="text-xs text-muted-foreground pl-6">Cadastre carimbos no seu Perfil → Carimbos para utilizá-los aqui.</p>
                    ) : includeStamp && (
                      <div className="pl-6 space-y-2">
                        <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Escolha um carimbo" /></SelectTrigger>
                          <SelectContent>
                            {stampsWithImage.map(s => <SelectItem key={s.id} value={s.id}>{s.name}{s.clinical_area ? ` — ${s.clinical_area}` : ''}{s.cbo ? ` (CBO ${s.cbo})` : ''}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {selectedStampId && (
                          <img loading="lazy" decoding="async" src={stampsWithImage.find(s => s.id === selectedStampId)?.stamp_image || ''} alt="Carimbo" className="h-16 object-contain border rounded p-1 bg-white" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Extra signatures */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> Assinaturas adicionais</Label>
                    {extraSignatures.length === 0 && (
                      <p className="text-xs text-muted-foreground">Adicione linhas extras: paciente, responsável, testemunhas...</p>
                    )}
                    <div className="space-y-2">
                      {extraSignatures.map((sig, i) => (
                        <div key={i} className="flex gap-2">
                          <Input
                            value={sig.label}
                            onChange={e => {
                              const next = [...extraSignatures];
                              next[i] = { label: e.target.value };
                              setExtraSignatures(next);
                            }}
                            placeholder="Ex: Assinatura do Paciente"
                            className="h-9"
                          />
                          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setExtraSignatures(extraSignatures.filter((_, j) => j !== i))}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => setExtraSignatures([...extraSignatures, { label: 'Assinatura do Paciente' }])}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar linha
                      </Button>
                    </div>
                  </div>
                </div>

                <Button onClick={handleSaveAndGeneratePdf} disabled={savingPdf} className="w-full md:w-auto">
                  {savingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {savingPdf ? 'Gerando PDF...' : 'Salvar e Gerar PDF'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============== HISTORY ============== */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documentos gerados</CardTitle>
              <CardDescription>Baixe em PDF ou Word (.docx) — o conteúdo é regenerado a partir do editor.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : history.length === 0 ? (
                <div className="text-center text-sm text-muted-foreground py-12">Nenhum documento gerado ainda.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map(doc => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{patientName(doc.patient_id)}</TableCell>
                        <TableCell><span className="text-xs px-2 py-0.5 rounded bg-muted">{docTypeLabel(doc.doc_type)}</span></TableCell>
                        <TableCell>{doc.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(doc.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => forceDownload(doc, 'pdf')} disabled={downloadingId === `${doc.id}-pdf`}>
                              {downloadingId === `${doc.id}-pdf` ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
                              PDF
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => forceDownload(doc, 'docx')} disabled={downloadingId === `${doc.id}-docx`}>
                              {downloadingId === `${doc.id}-docx` ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileType className="w-3.5 h-3.5 mr-1" />}
                              Word
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleEditDoc(doc)} title="Editar no editor">
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSaveToPatientFolder(doc)} disabled={savingToFolderId === doc.id} title="Salvar na pasta do paciente">
                              {savingToFolderId === doc.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5 mr-1" />}
                              Pasta
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteDoc(doc)} title="Excluir documento">
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============== TIMBRADO ============== */}
        <TabsContent value="timbrado">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configurar papel timbrado</CardTitle>
              <CardDescription>O timbrado é configurado por estabelecimento. O documento usará o timbrado da clínica do paciente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Estabelecimento</Label>
                <Select value={selectedClinicId} onValueChange={setSelectedClinicId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {clinics.filter(c => !c.isArchived).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img loading="lazy" decoding="async" src={logoUrl} alt="Logo" className="h-20 max-w-[200px] object-contain border rounded p-2 bg-white" />
                  ) : (
                    <div className="h-20 w-32 border-2 border-dashed rounded flex items-center justify-center text-xs text-muted-foreground">Sem logo</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input ref={logoFileRef} type="file" accept="image/*" hidden onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                    <Button variant="outline" size="sm" disabled={uploadingLogo || !selectedClinicId} onClick={() => logoFileRef.current?.click()}>
                      {uploadingLogo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                      Enviar logo
                    </Button>
                    {logoUrl && <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)}>Remover</Button>}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Cabeçalho (centralizado, abaixo da logo)</Label>
                <Textarea rows={3} placeholder={"Nome da Clínica\nCNPJ: 00.000.000/0001-00\nRua Exemplo, 123 — São Paulo/SP"} value={headerText} onChange={e => setHeaderText(e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label>Rodapé (centralizado no final da página)</Label>
                <Textarea rows={2} placeholder={"contato@clinica.com.br | (11) 99999-9999"} value={footerText} onChange={e => setFooterText(e.target.value)} />
              </div>

              <Button onClick={handleSaveTimbrado} disabled={savingTimbrado || !selectedClinicId}>
                {savingTimbrado ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar timbrado
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
