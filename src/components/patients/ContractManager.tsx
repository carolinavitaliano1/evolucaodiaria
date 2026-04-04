import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContractEditor } from '@/components/contracts/ContractEditor';
import { SignaturePad } from '@/components/ui/signature-pad';
import { toast } from 'sonner';
import {
  Loader2, FilePenLine, CheckCircle2, Send, Eye, Plus, Trash2,
  PenLine, Star, StarOff, Copy, ChevronDown, ChevronRight, FileText, X, Stamp, Upload, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';


interface StampOption {
  id: string;
  name: string;
  clinical_area: string;
  stamp_image: string | null;
  signature_image: string | null;
}

interface ContractTemplate {
  id: string;
  name: string;
  body_html: string;
  is_default: boolean;
  created_at: string;
}

interface Contract {
  id: string;
  template_html: string;
  signed_at: string | null;
  signature_data: string | null;
  therapist_signature_data: string | null;
  therapist_signed_at: string | null;
  status: string;
  created_at: string;
  contract_template_id: string | null;
  signer_name: string | null;
  signer_cpf: string | null;
  signer_city: string | null;
  agreed_terms: boolean;
}

interface ContractManagerProps {
  patientId: string;
  patientName: string;
}

const DEFAULT_BODY = `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS TERAPÊUTICOS</h2>

<p>Entre as partes abaixo identificadas:</p>

<p><strong>TERAPEUTA:</strong> [Nome do Terapeuta]<br/>
Registro: [CRP/Crefito número]</p>

<p><strong>PACIENTE/RESPONSÁVEL:</strong> {{patient_name}}</p>

<h3>CLÁUSULA 1 — DO OBJETO</h3>
<p>O presente contrato tem por objeto a prestação de serviços terapêuticos, conforme acordado entre as partes.</p>

<h3>CLÁUSULA 2 — DAS SESSÕES</h3>
<p>As sessões terão duração de 50 (cinquenta) minutos, realizadas semanalmente, em dia e horário a ser definido.</p>

<h3>CLÁUSULA 3 — DOS HONORÁRIOS</h3>
<p>O valor por sessão será definido em acordo entre as partes, com pagamento até o dia [dia] de cada mês.</p>

<h3>CLÁUSULA 4 — DO SIGILO</h3>
<p>O terapeuta compromete-se a manter sigilo sobre as informações obtidas durante as sessões, respeitando o Código de Ética Profissional.</p>

<h3>CLÁUSULA 5 — DO CANCELAMENTO</h3>
<p>Cancelamentos devem ser informados com mínimo de 24 horas de antecedência. Sessões não canceladas dentro do prazo serão cobradas integralmente.</p>

<p style="margin-top: 40px;">Ao assinar este contrato, as partes declaram ter lido e concordado com todos os termos acima.</p>`;

// ─── Template Library Panel ────────────────────────────────────────────────────
function TemplateLibrary({
  templates, loading, onSelect, onDelete, onSetDefault, onDuplicate,
}: {
  templates: ContractTemplate[];
  loading: boolean;
  onSelect: (t: ContractTemplate) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onDuplicate: (t: ContractTemplate) => void;
}) {
  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>;
  if (templates.length === 0) return (
    <p className="text-xs text-muted-foreground text-center py-4">Nenhum modelo criado ainda.</p>
  );
  return (
    <div className="space-y-1.5">
      {templates.map(t => (
        <div key={t.id} className={cn(
          'flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors',
          t.is_default ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:bg-muted/20'
        )}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              {t.is_default && <Star className="w-3 h-3 text-primary fill-primary flex-shrink-0" />}
              <span className="text-sm font-medium text-foreground truncate">{t.name}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Criado em {format(new Date(t.created_at), "d/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Usar este modelo" onClick={() => onSelect(t)}>
              <FilePenLine className="w-3.5 h-3.5 text-primary" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title="Duplicar" onClick={() => onDuplicate(t)}>
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" title={t.is_default ? 'Remover padrão' : 'Definir como padrão'} onClick={() => onSetDefault(t.id)}>
              {t.is_default ? <StarOff className="w-3.5 h-3.5 text-warning" /> : <Star className="w-3.5 h-3.5 text-muted-foreground" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => onDelete(t.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main ContractManager ──────────────────────────────────────────────────────
export function ContractManager({ patientId, patientName }: ContractManagerProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Contract state
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewContract, setPreviewContract] = useState<Contract | null>(null);

  // Template library state
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showLibrary, setShowLibrary] = useState(false);

  // New contract form state
  const [createMode, setCreateMode] = useState(false);
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // AI digitize state
  const [digitizing, setDigitizing] = useState(false);
  const [digitizeProgress, setDigitizeProgress] = useState('');

  // Therapist signature per contract
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
  const [therapistSigData, setTherapistSigData] = useState('');
  const [savingSig, setSavingSig] = useState(false);

  // Stamps
  const [stamps, setStamps] = useState<StampOption[]>([]);
  const [selectedStampId, setSelectedStampId] = useState<string>('none');

  const loadContracts = async () => {
    setLoadingContracts(true);
    const { data } = await supabase
      .from('patient_contracts')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    setContracts((data || []) as unknown as Contract[]);
    setLoadingContracts(false);
  };

  const loadTemplates = async () => {
    if (!user) return;
    setLoadingTemplates(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    setTemplates((data || []) as unknown as ContractTemplate[]);
    setLoadingTemplates(false);
  };

  const loadStamps = async () => {
    if (!user) return;
    const { data } = await supabase.from('stamps').select('id,name,clinical_area,stamp_image,signature_image').eq('user_id', user.id);
    const list = (data || []) as StampOption[];
    setStamps(list);
    const def = list.find(s => (s as any).is_default);
    if (def) setSelectedStampId(def.id);
  };

  useEffect(() => {
    loadContracts();
    loadTemplates();
    loadStamps();
  }, [patientId, user]);

  // ─── AI Digitize contract from uploaded file ──────────────────────────────
  const handleDigitizeFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    setDigitizing(true);
    try {
      let pagesBase64: string[] = [];

      if (file.type === 'application/pdf') {
        // Use pdf.js from CDN to render pages
        setDigitizeProgress('Lendo páginas do PDF...');
        const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/+esm' as any);
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          setDigitizeProgress(`Renderizando página ${i} de ${pdf.numPages}...`);
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport }).promise;
          const dataUrl = canvas.toDataURL('image/png');
          pagesBase64.push(dataUrl.split(',')[1]);
        }
      } else {
        // Image file
        setDigitizeProgress('Processando imagem...');
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(file);
        });
        pagesBase64 = [base64];
      }

      setDigitizeProgress('Digitalizando com IA...');
      const { data, error } = await supabase.functions.invoke('digitize-contract', {
        body: {
          pages_base64: pagesBase64,
          patient_name: patientName,
        },
      });

      if (error) throw new Error(error.message || 'Erro na digitalização');
      if (data?.error) throw new Error(data.error);

      if (data?.html_content) {
        setBodyHtml(data.html_content);
        setSelectedTemplateName(data.title || 'Contrato digitalizado');
        setCreateMode(true);
        toast.success('Contrato digitalizado com sucesso! Revise o conteúdo antes de salvar.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao digitalizar contrato');
    } finally {
      setDigitizing(false);
      setDigitizeProgress('');
    }
  };

  const handleSelectTemplate = (t: ContractTemplate) => {
    setBodyHtml(t.body_html);
    setSelectedTemplateName(t.name);
    setShowLibrary(false);
    setCreateMode(true);
  };

  const handleDeleteTemplate = async (id: string) => {
    await supabase.from('contract_templates').delete().eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Modelo excluído');
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    // Unset all, then set this one
    await supabase.from('contract_templates').update({ is_default: false }).eq('user_id', user.id);
    const current = templates.find(t => t.id === id);
    if (current?.is_default) {
      setTemplates(prev => prev.map(t => ({ ...t, is_default: false })));
      return;
    }
    await supabase.from('contract_templates').update({ is_default: true }).eq('id', id);
    setTemplates(prev => prev.map(t => ({ ...t, is_default: t.id === id })));
    toast.success('Modelo padrão definido');
  };

  const handleDuplicateTemplate = async (t: ContractTemplate) => {
    if (!user) return;
    const { data, error } = await supabase.from('contract_templates').insert({
      user_id: user.id,
      name: `${t.name} (cópia)`,
      body_html: t.body_html,
      is_default: false,
    }).select().single();
    if (!error && data) {
      setTemplates(prev => [data as unknown as ContractTemplate, ...prev]);
      toast.success('Modelo duplicado');
    }
  };

  // ─── Start new contract ───────────────────────────────────────────────────
  const handleStartNew = () => {
    const defaultTemplate = templates.find(t => t.is_default);
    setBodyHtml(defaultTemplate?.body_html || DEFAULT_BODY);
    setSelectedTemplateName(defaultTemplate?.name || '');
    setCreateMode(true);
  };

  // ─── Save new contract ────────────────────────────────────────────────────
  const handleSaveContract = async () => {
    if (!user || !bodyHtml.trim()) return;
    setSaving(true);
    try {
      // Optionally save as a new template
      let templateId: string | null = null;
      if (saveAsTemplate && newTemplateName.trim()) {
        const { data: tmpl } = await supabase.from('contract_templates').insert({
          user_id: user.id,
          name: newTemplateName.trim(),
          body_html: bodyHtml,
          is_default: templates.length === 0,
        }).select().single();
        if (tmpl) { templateId = (tmpl as any).id; await loadTemplates(); }
      }

      const filledHtml = bodyHtml.replace(/\{\{patient_name\}\}/g, patientName);
      const { error } = await supabase.from('patient_contracts').insert({
        patient_id: patientId,
        therapist_user_id: user.id,
        template_html: filledHtml,
        status: 'pending',
        contract_template_id: templateId,
      } as any);
      if (error) throw error;
      toast.success('Contrato criado!');
      setCreateMode(false);
      setSaveAsTemplate(false);
      setNewTemplateName('');
      await loadContracts();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar contrato');
    } finally {
      setSaving(false);
    }
  };

  // ─── Send to patient ──────────────────────────────────────────────────────
  const handleSend = async (contractId: string) => {
    setSaving(true);
    try {
      await supabase.from('patient_contracts').update({ status: 'sent' }).eq('id', contractId);
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, status: 'sent' } : c));
      toast.success('Contrato enviado ao paciente!');
    } catch { toast.error('Erro ao enviar'); }
    finally { setSaving(false); }
  };

  // ─── Therapist sign ───────────────────────────────────────────────────────
  const handleTherapistSign = async () => {
    if (!signingContractId || !therapistSigData) return;
    setSavingSig(true);
    try {
      const stamp = selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;
      const { error } = await supabase.from('patient_contracts').update({
        therapist_signature_data: therapistSigData,
        therapist_signed_at: new Date().toISOString(),
        // store stamp image in a JSON metadata field if you have one, else just embed in signature_data
      } as any).eq('id', signingContractId);
      if (error) throw error;
      setContracts(prev => prev.map(c =>
        c.id === signingContractId
          ? { ...c, therapist_signature_data: therapistSigData, therapist_signed_at: new Date().toISOString() }
          : c
      ));
      toast.success('Assinatura do terapeuta registrada!');
      setSigningContractId(null);
      setTherapistSigData('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao assinar');
    } finally {
      setSavingSig(false);
    }
  };

  // ─── Delete contract ──────────────────────────────────────────────────────
  const handleDelete = async (contractId: string) => {
    await supabase.from('patient_contracts').delete().eq('id', contractId);
    setContracts(prev => prev.filter(c => c.id !== contractId));
    toast.success('Contrato removido');
  };

  const statusCfg = (status: string) =>
    status === 'signed'
      ? { label: 'Assinado', cls: 'bg-success/10 text-success border-success/20' }
      : status === 'sent'
      ? { label: 'Aguardando paciente', cls: 'bg-warning/10 text-warning border-warning/20' }
      : { label: 'Rascunho', cls: 'bg-muted text-muted-foreground border-border' };

  if (loadingContracts) return (
    <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <FilePenLine className="w-4 h-4 text-primary" /> Contratos
          {contracts.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({contracts.length})</span>
          )}
        </h3>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            onClick={() => setShowLibrary(v => !v)}>
            <FileText className="w-3 h-3" /> Modelos
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8"
            disabled={digitizing}
            onClick={() => fileInputRef.current?.click()}>
            {digitizing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {digitizing ? digitizeProgress || 'Digitalizando...' : 'Digitalizar com IA'}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={handleDigitizeFile}
          />
          <Button size="sm" className="gap-1.5 text-xs h-8" onClick={handleStartNew}>
            <Plus className="w-3 h-3" /> Novo contrato
          </Button>
        </div>
      </div>

      {/* Template Library */}
      {showLibrary && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">Meus Modelos de Contrato</p>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1"
              onClick={() => {
                setBodyHtml(DEFAULT_BODY);
                setSelectedTemplateName('');
                setCreateMode(true);
                setShowLibrary(false);
              }}>
              <Plus className="w-3 h-3" /> Criar do zero
            </Button>
          </div>
          <TemplateLibrary
            templates={templates}
            loading={loadingTemplates}
            onSelect={handleSelectTemplate}
            onDelete={handleDeleteTemplate}
            onSetDefault={handleSetDefault}
            onDuplicate={handleDuplicateTemplate}
          />
        </div>
      )}

      {/* New Contract Editor */}
      {createMode && (
        <div className="bg-card rounded-xl border border-primary/20 p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <FilePenLine className="w-3.5 h-3.5" />
              {selectedTemplateName ? `Baseado em: ${selectedTemplateName}` : 'Novo contrato'}
            </p>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCreateMode(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">{'{{patient_name}}'}</code> para inserir o nome do paciente. HTML básico é suportado.
          </p>
          <Textarea
            value={bodyHtml}
            onChange={e => setBodyHtml(e.target.value)}
            className="min-h-[260px] font-mono text-xs resize-none"
            placeholder="Conteúdo do contrato (HTML)..."
          />
          {/* Save as template option */}
          <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={e => setSaveAsTemplate(e.target.checked)}
                className="w-3.5 h-3.5 accent-primary"
              />
              <span className="text-xs text-foreground">Salvar como modelo reutilizável</span>
            </label>
            {saveAsTemplate && (
              <Input
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Nome do modelo (ex: Contrato Padrão Adulto)"
                className="h-8 text-xs"
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setCreateMode(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveContract} disabled={saving || !bodyHtml.trim()} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Salvar contrato
            </Button>
          </div>
        </div>
      )}

      {/* Contracts list */}
      {contracts.length === 0 && !createMode ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <FilePenLine className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhum contrato criado</p>
          <p className="text-xs text-muted-foreground/70">Clique em "Novo contrato" para começar ou escolha um modelo.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {contracts.map(contract => {
            const cfg = statusCfg(contract.status);
            return (
              <div key={contract.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Contract header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border', cfg.cls)}>
                        {contract.status === 'signed' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {cfg.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(contract.created_at), "d MMM yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {/* Signature indicators */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className={cn('text-[10px] flex items-center gap-1',
                        contract.therapist_signature_data ? 'text-success' : 'text-muted-foreground')}>
                        {contract.therapist_signature_data
                          ? <><CheckCircle2 className="w-3 h-3" /> Terapeuta assinou</>
                          : <><PenLine className="w-3 h-3" /> Terapeuta não assinou</>}
                      </span>
                      <span className={cn('text-[10px] flex items-center gap-1',
                        contract.status === 'signed' ? 'text-success' : 'text-muted-foreground')}>
                        {contract.status === 'signed'
                          ? <><CheckCircle2 className="w-3 h-3" /> Paciente assinou</>
                          : <><PenLine className="w-3 h-3" /> Paciente não assinou</>}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Visualizar"
                      onClick={() => setPreviewContract(contract)}>
                      <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                    {!contract.therapist_signature_data && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Assinar como terapeuta"
                        onClick={() => { setSigningContractId(contract.id); setTherapistSigData(''); }}>
                        <PenLine className="w-3.5 h-3.5 text-primary" />
                      </Button>
                    )}
                    {contract.status === 'pending' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Enviar para paciente"
                        onClick={() => handleSend(contract.id)} disabled={saving}>
                        <Send className="w-3.5 h-3.5 text-warning" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Excluir" onClick={() => handleDelete(contract.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Therapist signature pad (inline) */}
                {signingContractId === contract.id && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <PenLine className="w-3.5 h-3.5 text-primary" /> Sua assinatura (terapeuta)
                    </p>

                    {/* Signature pad */}
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Assinatura</Label>
                      <SignaturePad
                        value={therapistSigData}
                        onChange={setTherapistSigData}
                        className="w-full"
                      />
                    </div>

                    {/* Stamp selector */}
                    {stamps.length > 0 && (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Stamp className="w-3 h-3" /> Carimbo (opcional)
                        </Label>
                        <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar carimbo..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum carimbo</SelectItem>
                            {stamps.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} — {s.clinical_area}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {/* Stamp preview */}
                        {selectedStampId !== 'none' && (() => {
                          const stamp = stamps.find(s => s.id === selectedStampId);
                          return stamp?.stamp_image ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                              <img src={stamp.stamp_image} alt="Carimbo" className="h-12 object-contain" />
                              <span className="text-[10px] text-muted-foreground">{stamp.name}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 text-xs"
                        onClick={() => { setSigningContractId(null); setTherapistSigData(''); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="flex-1 text-xs gap-1.5"
                        onClick={handleTherapistSign} disabled={!therapistSigData || savingSig}>
                        {savingSig ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Registrar assinatura
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewContract} onOpenChange={v => !v && setPreviewContract(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contrato — {patientName}</DialogTitle>
          </DialogHeader>
          {previewContract && (
            <div className="space-y-4">
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: previewContract.template_html }}
              />
              {/* Therapist signature */}
              {previewContract.therapist_signature_data && (
                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Assinatura do terapeuta:</p>
                  <div className="flex items-end gap-4 flex-wrap">
                    <img src={previewContract.therapist_signature_data} alt="Assinatura do terapeuta"
                      className="max-h-16 border border-border rounded" />
                  </div>
                  {previewContract.therapist_signed_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(previewContract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )}
              {/* Patient signature */}
              {previewContract.signature_data && (
                <div className="border-t border-border pt-4 space-y-1">
                  {/* Signer identity */}
                  {(previewContract.signer_name || previewContract.signer_cpf || previewContract.signer_city) && (
                    <div className="rounded-lg bg-muted/30 border border-border p-3 mb-3 space-y-0.5">
                      <p className="text-xs font-semibold text-foreground">Dados do assinante:</p>
                      {previewContract.signer_name && <p className="text-xs text-muted-foreground">Nome: <strong className="text-foreground">{previewContract.signer_name}</strong></p>}
                      {previewContract.signer_cpf && <p className="text-xs text-muted-foreground">CPF: <strong className="text-foreground">{previewContract.signer_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</strong></p>}
                      {previewContract.signer_city && <p className="text-xs text-muted-foreground">Cidade: <strong className="text-foreground">{previewContract.signer_city}</strong></p>}
                      {previewContract.agreed_terms && <p className="text-[10px] text-success">✓ Declarou concordar com todos os termos</p>}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground font-medium">Assinatura do paciente / responsável:</p>
                  <img src={previewContract.signature_data} alt="Assinatura do paciente"
                    className="max-h-20 border border-border rounded" />
                  {previewContract.signed_at && (
                    <p className="text-[10px] text-muted-foreground">
                      {format(new Date(previewContract.signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
