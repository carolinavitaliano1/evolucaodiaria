import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ContractEditor } from '@/components/contracts/ContractEditor';
import { generateContractPDF } from '@/pages/portal/PortalContract';

import { toast } from 'sonner';
import {
  Loader2, FilePenLine, CheckCircle2, Send, Eye, Plus, Trash2, Download,
  PenLine, Star, StarOff, Copy, ChevronDown, ChevronRight, FileText, X, Stamp, Upload, Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { cleanContractHtml, substituteContractVariables } from '@/utils/contractHtmlUtils';


interface StampOption {
  id: string;
  name: string;
  clinical_area: string;
  stamp_image: string | null;
  signature_image: string | null;
  is_default?: boolean | null;
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

<p><strong>TERAPEUTA:</strong> <span data-type="variable" class="contract-variable">{{nome_profissional}}</span><br/>
Registro: <span data-type="variable" class="contract-variable">{{registro_profissional}}</span></p>

<p><strong>PACIENTE/RESPONSÁVEL:</strong> <span data-type="variable" class="contract-variable">{{nome_paciente}}</span><br/>
CPF: <span data-type="variable" class="contract-variable">{{cpf_paciente}}</span></p>

<h3>CLÁUSULA 1 — DO OBJETO</h3>
<p>O presente contrato tem por objeto a prestação de serviços terapêuticos, conforme acordado entre as partes.</p>

<h3>CLÁUSULA 2 — DAS SESSÕES</h3>
<p>As sessões terão duração de 50 (cinquenta) minutos, realizadas semanalmente, em dia e horário a ser definido.</p>

<h3>CLÁUSULA 3 — DOS HONORÁRIOS</h3>
<p>O valor por sessão será de <span data-type="variable" class="contract-variable">{{valor_sessao}}</span>, com pagamento conforme acordado entre as partes.</p>

<h3>CLÁUSULA 4 — DO SIGILO</h3>
<p>O terapeuta compromete-se a manter sigilo sobre as informações obtidas durante as sessões, respeitando o Código de Ética Profissional.</p>

<h3>CLÁUSULA 5 — DO CANCELAMENTO</h3>
<p>Cancelamentos devem ser informados com mínimo de 24 horas de antecedência. Sessões não canceladas dentro do prazo serão cobradas integralmente.</p>

<p style="margin-top: 40px;"><span data-type="variable" class="contract-variable">{{cidade_atual}}</span>, <span data-type="variable" class="contract-variable">{{data_atual}}</span></p>

<p>Ao assinar este contrato, as partes declaram ter lido e concordado com todos os termos acima.</p>`;

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

  // Therapist stamp per contract
  const [signingContractId, setSigningContractId] = useState<string | null>(null);
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
    const { data } = await supabase.from('stamps').select('id,name,clinical_area,stamp_image,signature_image,is_default').eq('user_id', user.id);
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

      // Fetch all data needed for variable substitution in parallel
      const [{ data: patientData }, { data: profile }, { data: intakeForm }] = await Promise.all([
        supabase.from('patients').select('cpf,birthdate,payment_value,weekdays,schedule_time,clinic_id').eq('id', patientId).maybeSingle(),
        supabase.from('profiles').select('name,professional_id,cpf').eq('user_id', user.id).maybeSingle(),
        supabase.from('patient_intake_forms').select('address,cpf').eq('patient_id', patientId).maybeSingle(),
      ]);

      // Use selected stamp for CBO and clinical_area
      const chosenStamp = selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;
      // If no stamp selected, try fetching default from DB
      let stampCbo = '';
      let stampArea = '';
      if (chosenStamp) {
        // Fetch full stamp data including cbo
        const { data: fullStamp } = await supabase.from('stamps').select('cbo,clinical_area').eq('id', chosenStamp.id).maybeSingle();
        stampCbo = (fullStamp as any)?.cbo || '';
        stampArea = (fullStamp as any)?.clinical_area || chosenStamp.clinical_area || '';
      } else {
        // Fallback: first stamp with is_default or first stamp
        const { data: defStamp } = await supabase.from('stamps').select('cbo,clinical_area').eq('user_id', user.id).order('is_default', { ascending: false }).limit(1).maybeSingle();
        stampCbo = (defStamp as any)?.cbo || '';
        stampArea = (defStamp as any)?.clinical_area || '';
      }

      let clinicCity = '';
      if (patientData?.clinic_id) {
        const { data: clinic } = await supabase.from('clinics').select('address').eq('id', patientData.clinic_id).maybeSingle();
        if (clinic?.address) {
          const parts = clinic.address.split(',').map((s: string) => s.trim());
          clinicCity = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '';
        }
      }

      const formatDate = (d?: string | null) => {
        if (!d) return '[não informado]';
        try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
      };

      const paymentVal = patientData?.payment_value;

      const variableMap: Record<string, string> = {
        'nome_paciente': patientName || '[não informado]',
        'patient_name': patientName || '[não informado]',
        'cpf_paciente': patientData?.cpf || intakeForm?.cpf || '[não informado]',
        'rg_paciente': '[não informado]',
        'endereco_paciente': intakeForm?.address || '[não informado]',
        'data_nascimento': formatDate(patientData?.birthdate),
        'nome_profissional': profile?.name || '[não informado]',
        'registro_profissional': profile?.professional_id || '[não informado]',
        'cbo_profissional': stampCbo || '[não informado]',
        'area_clinica': stampArea || '[não informado]',
        'data_atual': format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR }),
        'cidade_atual': clinicCity || '[não informado]',
        'valor_sessao': paymentVal ? `R$ ${Number(paymentVal).toFixed(2).replace('.', ',')}` : '[não informado]',
        'dia_atendimento': patientData?.weekdays?.join(', ') || '[não informado]',
        'horario_atendimento': patientData?.schedule_time || '[não informado]',
      };

      // Use shared utility to substitute all variables and clean spans
      const filledHtml = substituteContractVariables(bodyHtml, variableMap);

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

  // ─── Therapist stamp (no manual signature) ─────────────────────────────
  const handleTherapistStamp = async (contractId: string) => {
    const stamp = selectedStampId !== 'none' ? stamps.find(s => s.id === selectedStampId) : null;
    if (!stamp) {
      toast.error('Selecione um carimbo para assinar o contrato.');
      return;
    }
    setSavingSig(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('name,professional_id').eq('user_id', user!.id).maybeSingle();
      const { data: fullStamp } = await supabase.from('stamps').select('cbo,clinical_area,stamp_image').eq('id', stamp.id).maybeSingle();

      const stampData = JSON.stringify({
        stamp_image: (fullStamp as any)?.stamp_image || stamp.stamp_image || null,
        name: profile?.name || '',
        clinical_area: (fullStamp as any)?.clinical_area || stamp.clinical_area || '',
        cbo: (fullStamp as any)?.cbo || '',
        professional_id: profile?.professional_id || '',
      });

      const signedAt = new Date().toISOString();
      const { error } = await supabase.from('patient_contracts').update({
        therapist_signature_data: stampData,
        therapist_signed_at: signedAt,
      } as any).eq('id', contractId);
      if (error) throw error;
      setContracts(prev => prev.map(c =>
        c.id === contractId
          ? { ...c, therapist_signature_data: stampData, therapist_signed_at: signedAt }
          : c
      ));
      toast.success('Carimbo do terapeuta registrado!');
      setSigningContractId(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar carimbo');
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
          {/* Stamp selector for variable substitution */}
          {stamps.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
              <Label className="text-[11px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                <Stamp className="w-3 h-3" /> Carimbo para variáveis:
              </Label>
              <Select value={selectedStampId} onValueChange={setSelectedStampId}>
                <SelectTrigger className="h-8 text-xs flex-1">
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
            </div>
          )}
          <ContractEditor value={bodyHtml} onChange={setBodyHtml} />
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
                    {contract.status === 'signed' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Baixar PDF"
                        onClick={async () => {
                          try {
                            const { data: pat } = await supabase.from('patients')
                              .select('name, cpf, responsible_name, responsible_cpf, is_minor')
                              .eq('id', patientId).maybeSingle();
                            const sName = contract.signer_name || (pat?.is_minor ? pat?.responsible_name : pat?.name) || patientName;
                            const sCpf = contract.signer_cpf || (pat?.is_minor ? pat?.responsible_cpf : pat?.cpf) || null;
                            await generateContractPDF(contract as any, sName, sCpf);
                            toast.success('PDF do contrato baixado!');
                          } catch (err) {
                            console.error(err);
                            toast.error('Erro ao gerar PDF do contrato');
                          }
                        }}>
                        <Download className="w-3.5 h-3.5 text-success" />
                      </Button>
                    )}
                    {!contract.therapist_signature_data && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Registrar carimbo"
                        onClick={() => setSigningContractId(contract.id)}>
                        <Stamp className="w-3.5 h-3.5 text-primary" />
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

                {/* Therapist stamp selector (inline) */}
                {signingContractId === contract.id && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-3 animate-fade-in">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Stamp className="w-3.5 h-3.5 text-primary" /> Selecionar carimbo profissional
                    </p>

                    {stamps.length > 0 ? (
                      <div className="space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Stamp className="w-3 h-3" /> Carimbo
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
                        {selectedStampId !== 'none' && (() => {
                          const stamp = stamps.find(s => s.id === selectedStampId);
                          return stamp?.stamp_image ? (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border">
                              <img loading="lazy" decoding="async" src={stamp.stamp_image} alt="Carimbo" className="h-12 object-contain" />
                              <span className="text-[10px] text-muted-foreground">{stamp.name}</span>
                            </div>
                          ) : null;
                        })()}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum carimbo cadastrado. Cadastre um carimbo no seu perfil.</p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button variant="outline" size="sm" className="flex-1 text-xs"
                        onClick={() => setSigningContractId(null)}>
                        Cancelar
                      </Button>
                      <Button size="sm" className="flex-1 text-xs gap-1.5"
                        onClick={() => handleTherapistStamp(contract.id)} disabled={selectedStampId === 'none' || savingSig}>
                        {savingSig ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Registrar carimbo
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
                className="prose prose-sm max-w-none text-foreground [&_p]:text-justify [&_p]:leading-relaxed [&_h2]:text-center [&_h3]:uppercase [&_h3]:text-sm"
                dangerouslySetInnerHTML={{ __html: cleanContractHtml(previewContract.template_html) }}
              />
              {/* Therapist stamp */}
              {previewContract.therapist_signature_data && (() => {
                let stampInfo: any = null;
                try { stampInfo = JSON.parse(previewContract.therapist_signature_data); } catch { stampInfo = null; }
                return (
                  <div className="border-t border-border pt-4 space-y-2 text-center">
                    <p className="text-xs text-muted-foreground font-medium">Carimbo do terapeuta:</p>
                    {stampInfo?.stamp_image ? (
                      <img loading="lazy" decoding="async" src={stampInfo.stamp_image} alt="Carimbo" className="max-h-24 mx-auto object-contain" />
                    ) : !stampInfo ? (
                      <img loading="lazy" decoding="async" src={previewContract.therapist_signature_data} alt="Assinatura do terapeuta"
                        className="max-h-32 mx-auto object-contain border border-border rounded bg-background" />
                    ) : null}
                    <div className="w-48 mx-auto border-b border-foreground/40" />
                    {stampInfo?.name && <p className="text-xs font-semibold text-foreground">{stampInfo.name}</p>}
                    {stampInfo?.clinical_area && <p className="text-[10px] text-muted-foreground">{stampInfo.clinical_area}</p>}
                    {stampInfo?.cbo && <p className="text-[10px] text-muted-foreground">CBO: {stampInfo.cbo}</p>}
                    {stampInfo?.professional_id && <p className="text-[10px] text-muted-foreground">Registro: {stampInfo.professional_id}</p>}
                    {previewContract.therapist_signed_at && (
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(previewContract.therapist_signed_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                );
              })()}
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
                  <img loading="lazy" decoding="async" src={previewContract.signature_data} alt="Assinatura do paciente"
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
