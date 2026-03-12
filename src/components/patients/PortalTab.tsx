import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Send, Loader2, Mail, RefreshCw, CheckCircle2, Clock, MessageSquare, Bell,
  FilePenLine, Eye, ExternalLink, ClipboardList, User, Heart, CreditCard,
  Plus, Trash2, ChevronDown, ChevronRight, Users, School, Building2, UserCircle, FileUp, Download, X
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { ContractManager } from './ContractManager';
import { PortalNoticesManager } from './PortalNoticesManager';
import { SharedEvolutionsManager } from './SharedEvolutionsManager';

interface PortalTabProps {
  patientId: string;
  patientEmail?: string | null;
  patientName: string;
  responsibleEmail?: string | null;
  responsibleName?: string | null;
}

interface PortalAccount {
  id: string;
  status: string;
  invite_sent_at: string | null;
  patient_email: string;
  access_type: string;
  access_label: string | null;
  permissions: Record<string, boolean>;
}

interface PortalMessage {
  id: string;
  sender_type: string;
  content: string;
  message_type: string;
  read_by_therapist: boolean;
  created_at: string;
}

interface IntakeForm {
  submitted_at: string | null;
  full_name: string | null;
  phone: string | null;
  cpf: string | null;
  birthdate: string | null;
  address: string | null;
  emergency_contact: string | null;
  responsible_name: string | null;
  responsible_cpf: string | null;
  responsible_phone: string | null;
  health_info: string | null;
  observations: string | null;
  payment_due_day: number | null;
}

interface PortalDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number | null;
  description: string | null;
  uploaded_by_type: string;
  created_at: string;
  portal_account_id: string;
}

const ACCESS_TYPES = [
  { value: 'patient', label: 'Paciente', icon: UserCircle, color: 'text-primary' },
  { value: 'responsible', label: 'Responsável', icon: Users, color: 'text-success' },
  { value: 'school', label: 'Escola', icon: School, color: 'text-warning' },
  { value: 'clinic', label: 'Clínica / Instituição', icon: Building2, color: 'text-destructive' },
  { value: 'other', label: 'Outro', icon: User, color: 'text-muted-foreground' },
];

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  messages: true, feedbacks: true, financial: true,
  contract: true, intake: true, notices: true, documents: true,
};

const PERM_LABELS: Record<string, string> = {
  messages: 'Mensagens', feedbacks: 'Feedbacks da sessão', financial: 'Financeiro',
  contract: 'Contrato', intake: 'Ficha cadastral', notices: 'Avisos', documents: 'Documentos',
};

function AccessTypeIcon({ type, className }: { type: string; className?: string }) {
  const cfg = ACCESS_TYPES.find(a => a.value === type) || ACCESS_TYPES[4];
  return <cfg.icon className={cn('w-4 h-4', cfg.color, className)} />;
}

function AccessTypeBadge({ type, label }: { type: string; label?: string | null }) {
  const cfg = ACCESS_TYPES.find(a => a.value === type) || ACCESS_TYPES[4];
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', cfg.color)}>
      <cfg.icon className="w-3 h-3" />
      {label || cfg.label}
    </span>
  );
}

function IntakeField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

// ─── Sub-component: Per-account management panel ─────────────────────────────
function AccountPanel({
  account, patientId, patientName, intakeForm,
}: {
  account: PortalAccount;
  patientId: string;
  patientName: string;
  intakeForm: IntakeForm | null;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('message');
  const [sending, setSending] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docDescription, setDocDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const perms = account.permissions || DEFAULT_PERMISSIONS;

  useEffect(() => {
    // Load messages
    supabase.from('portal_messages').select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => setMessages((data || []) as PortalMessage[]));

    // Load documents for this account
    supabase.from('portal_documents').select('*')
      .eq('portal_account_id', account.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setDocuments((data || []) as PortalDocument[]));
  }, [account.id, patientId]);

  // Realtime messages
  useEffect(() => {
    const channel = supabase
      .channel(`portal-msg-${account.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'portal_messages',
        filter: `patient_id=eq.${patientId}`,
      }, (payload) => {
        const m = payload.new as PortalMessage;
        if (m.sender_type === 'patient') {
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [m, ...prev]);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [account.id, patientId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.from('portal_messages').insert({
        patient_id: patientId,
        therapist_user_id: user!.id,
        sender_type: 'therapist',
        content: newMessage.trim(),
        message_type: messageType,
        read_by_patient: false,
        read_by_therapist: true,
      }).select().single();
      if (error) throw error;
      setNewMessage('');
      if (data) setMessages(prev => [data as PortalMessage, ...prev]);
      toast.success('Mensagem enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error('Arquivo muito grande. Máximo 20MB.'); return; }
    setUploadingDoc(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user!.id}/${account.id}/${Date.now()}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from('portal-documents')
        .upload(filePath, file);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('portal_documents').insert({
        patient_id: patientId,
        therapist_user_id: user!.id,
        portal_account_id: account.id,
        name: file.name,
        file_path: filePath,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size,
        description: docDescription || null,
        uploaded_by_type: 'therapist',
        uploaded_by_user_id: user!.id,
      });
      if (dbError) throw dbError;

      // Refresh docs
      const { data } = await supabase.from('portal_documents').select('*')
        .eq('portal_account_id', account.id).order('created_at', { ascending: false });
      setDocuments((data || []) as PortalDocument[]);
      setDocDescription('');
      toast.success('Documento enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar documento');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadDoc = async (doc: PortalDocument) => {
    const { data } = await supabase.storage.from('portal-documents').createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Erro ao gerar link de download');
  };

  const handleDeleteDoc = async (doc: PortalDocument) => {
    await supabase.storage.from('portal-documents').remove([doc.file_path]);
    await supabase.from('portal_documents').delete().eq('id', doc.id);
    setDocuments(prev => prev.filter(d => d.id !== doc.id));
    toast.success('Documento removido');
  };

  const handleDownloadIntake = (form: IntakeForm, name: string) => {
    const lines: string[] = [];
    const add = (label: string, val: string | number | null | undefined) => {
      if (val) lines.push(`${label}: ${val}`);
    };
    lines.push(`FICHA DO PACIENTE — ${name.toUpperCase()}`);
    lines.push(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`);
    lines.push('');
    lines.push('=== DADOS PESSOAIS ===');
    add('Nome completo', form.full_name);
    add('CPF', form.cpf);
    add('Data de nascimento', form.birthdate ? new Date(form.birthdate + 'T00:00:00').toLocaleDateString('pt-BR') : null);
    add('Telefone', form.phone);
    add('Endereço', form.address);
    add('Contato de emergência', form.emergency_contact);
    if (form.responsible_name || form.responsible_cpf) {
      lines.push('');
      lines.push('=== RESPONSÁVEL ===');
      add('Nome', form.responsible_name);
      add('CPF', form.responsible_cpf);
      add('Telefone', form.responsible_phone);
    }
    if (form.payment_due_day) {
      lines.push('');
      lines.push('=== PAGAMENTO ===');
      add('Melhor dia', `Dia ${form.payment_due_day}`);
    }
    if (form.health_info || form.observations) {
      lines.push('');
      lines.push('=== SAÚDE & OBSERVAÇÕES ===');
      if (form.health_info) { lines.push('Informações médicas:'); lines.push(form.health_info); }
      if (form.observations) { lines.push('Observações:'); lines.push(form.observations); }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ficha-${name.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const unreadFromPatient = messages.filter(m => m.sender_type === 'patient' && !m.read_by_therapist).length;
  const hasIntakeSubmitted = !!intakeForm?.submitted_at;

  // Quick Actions config
  const actions = [
    perms.messages && { id: 'messages', icon: MessageSquare, label: 'Mensagens', color: 'text-primary', bg: 'bg-primary/10 hover:bg-primary/20', badge: unreadFromPatient },
    perms.intake && { id: 'intake', icon: ClipboardList, label: 'Ficha Clínica', color: 'text-success', bg: 'bg-success/10 hover:bg-success/20', dot: hasIntakeSubmitted },
    perms.contract && { id: 'contract', icon: FilePenLine, label: 'Contratos', color: 'text-warning', bg: 'bg-warning/10 hover:bg-warning/20' },
    perms.notices && { id: 'notices', icon: Bell, label: 'Avisos', color: 'text-destructive', bg: 'bg-destructive/10 hover:bg-destructive/20' },
    perms.feedbacks && { id: 'feedbacks', icon: Eye, label: 'Linha do Tempo', color: 'text-accent-foreground', bg: 'bg-accent/30 hover:bg-accent/50' },
    perms.documents && { id: 'documents', icon: FileUp, label: 'Documentos', color: 'text-muted-foreground', bg: 'bg-muted/50 hover:bg-muted' },
  ].filter(Boolean) as { id: string; icon: React.ElementType; label: string; color: string; bg: string; badge?: number; dot?: boolean }[];

  const [activeSection, setActiveSection] = useState<string | null>(actions[0]?.id || null);

  const handleActionClick = (id: string) => {
    setActiveSection(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions Grid */}
      <div className={cn('grid gap-3', actions.length <= 3 ? 'grid-cols-3' : actions.length <= 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6')}>
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => handleActionClick(action.id)}
            className={cn(
              'relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-150 text-center group',
              activeSection === action.id
                ? cn('border-primary/40 shadow-sm', action.bg)
                : 'border-border bg-card hover:border-primary/20',
              activeSection === action.id ? '' : 'hover:bg-muted/30'
            )}
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-colors', action.bg)}>
              <action.icon className={cn('w-4 h-4', action.color)} />
            </div>
            <span className={cn('text-[11px] font-medium leading-tight', activeSection === action.id ? action.color : 'text-muted-foreground group-hover:text-foreground')}>
              {action.label}
            </span>
            {action.badge && action.badge > 0 ? (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {action.badge}
              </span>
            ) : null}
            {action.dot ? <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" /> : null}
          </button>
        ))}
      </div>

      {/* Section Content */}
      {activeSection && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Messages */}
          {activeSection === 'messages' && perms.messages && (
            <div>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> Mensagens
                </h3>
                <span className="text-xs text-muted-foreground">{messages.length} msgs</span>
              </div>
              <div className="p-4 border-b border-border space-y-2">
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger className="w-full h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">💬 Mensagem</SelectItem>
                    <SelectItem value="tarefa">📋 Tarefa para casa</SelectItem>
                    <SelectItem value="feedback">✨ Feedback de sessão</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea value={newMessage} onChange={e => setNewMessage(e.target.value)}
                  placeholder={`Mensagem para ${account.access_label || patientName}...`}
                  className="resize-none text-sm min-h-[80px]" />
                <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim() || sending} className="gap-1.5">
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Enviar
                </Button>
              </div>
              <div className="divide-y divide-border max-h-56 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
                ) : messages.map(msg => (
                  <div key={msg.id} className={cn('px-4 py-3', msg.sender_type === 'patient' && 'bg-muted/30')}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] font-semibold uppercase tracking-wide',
                        msg.sender_type === 'therapist' ? 'text-primary' : 'text-muted-foreground')}>
                        {msg.sender_type === 'therapist' ? '👨‍⚕️ Você' : `👤 ${account.access_label || patientName}`}
                      </span>
                      {msg.message_type !== 'message' && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                          {msg.message_type === 'tarefa' ? '📋 Tarefa' : '✨ Feedback'}
                        </Badge>
                      )}
                      {msg.sender_type === 'patient' && !msg.read_by_therapist && (
                        <Badge className="text-[9px] px-1 py-0 h-3.5 bg-destructive">Nova</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {format(new Date(msg.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intake */}
          {activeSection === 'intake' && perms.intake && (
            <div>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-success" /> Ficha do Paciente
                </h3>
                <div className="flex items-center gap-2">
                  {hasIntakeSubmitted ? (
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {format(new Date(intakeForm!.submitted_at!), "d/MM/yyyy", { locale: ptBR })}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">Não enviada</span>}
                  {hasIntakeSubmitted && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5"
                      onClick={() => handleDownloadIntake(intakeForm!, patientName)}
                    >
                      <Download className="w-3 h-3" /> Baixar PDF
                    </Button>
                  )}
                </div>
              </div>
              {!hasIntakeSubmitted ? (
                <div className="p-6 text-center">
                  <ClipboardList className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {!intakeForm ? 'Ficha ainda não preenchida.' : 'Paciente ainda não enviou a ficha.'}
                  </p>
                </div>
              ) : (
                <div className="p-4 space-y-5">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Dados Pessoais
                    </h4>
                    <div className="grid grid-cols-1 gap-3 pl-1">
                      <IntakeField label="Nome completo" value={intakeForm.full_name} />
                      <div className="grid grid-cols-2 gap-3">
                        <IntakeField label="CPF" value={intakeForm.cpf} />
                        <IntakeField label="Data de nascimento" value={intakeForm.birthdate ? format(new Date(intakeForm.birthdate + 'T00:00:00'), 'dd/MM/yyyy') : null} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <IntakeField label="Telefone" value={intakeForm.phone} />
                        <IntakeField label="Contato de emergência" value={intakeForm.emergency_contact} />
                      </div>
                      <IntakeField label="Endereço" value={intakeForm.address} />
                    </div>
                  </div>
                  {(intakeForm.responsible_name || intakeForm.responsible_cpf) && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Responsável
                      </h4>
                      <div className="grid grid-cols-1 gap-3 pl-1">
                        <IntakeField label="Nome" value={intakeForm.responsible_name} />
                        <div className="grid grid-cols-2 gap-3">
                          <IntakeField label="CPF" value={intakeForm.responsible_cpf} />
                          <IntakeField label="Telefone" value={intakeForm.responsible_phone} />
                        </div>
                      </div>
                    </div>
                  )}
                  {intakeForm.payment_due_day && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Pagamento
                      </h4>
                      <div className="pl-1"><IntakeField label="Melhor dia" value={`Dia ${intakeForm.payment_due_day}`} /></div>
                    </div>
                  )}
                  {(intakeForm.health_info || intakeForm.observations) && (
                    <div className="space-y-3 pt-3 border-t border-border">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                        <Heart className="w-3.5 h-3.5" /> Saúde & Observações
                      </h4>
                      <div className="space-y-3 pl-1">
                        {intakeForm.health_info && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Informações médicas</p>
                            <p className="text-sm bg-muted/30 rounded-lg p-3 leading-relaxed">{intakeForm.health_info}</p>
                          </div>
                        )}
                        {intakeForm.observations && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Observações</p>
                            <p className="text-sm bg-muted/30 rounded-lg p-3 leading-relaxed">{intakeForm.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Contract */}
          {activeSection === 'contract' && perms.contract && (
            <div className="p-4">
              <ContractManager patientId={patientId} patientName={patientName} />
            </div>
          )}

          {/* Notices */}
          {activeSection === 'notices' && perms.notices && (
            <div className="p-4">
              <PortalNoticesManager patientId={patientId} patientName={patientName} />
            </div>
          )}

          {/* Feedbacks / Timeline */}
          {activeSection === 'feedbacks' && perms.feedbacks && (
            <div className="p-4">
              <SharedEvolutionsManager patientId={patientId} />
            </div>
          )}

          {/* Documents */}
          {activeSection === 'documents' && perms.documents && (
            <div>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-primary" /> Documentos
                </h3>
                <span className="text-xs text-muted-foreground">{documents.length} arquivo(s)</span>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">Envie documentos e relatórios para este acesso. Apenas esta pessoa verá esses arquivos.</p>
                <div className="space-y-2">
                  <Input
                    placeholder="Descrição opcional (ex: Relatório de progresso)"
                    value={docDescription}
                    onChange={e => setDocDescription(e.target.value)}
                    className="text-sm h-8"
                  />
                  <div className="flex items-center gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadDoc}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt,.xls,.xlsx" />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingDoc} className="gap-1.5 text-xs">
                      {uploadingDoc ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileUp className="w-3 h-3" />}
                      {uploadingDoc ? 'Enviando...' : 'Selecionar arquivo'}
                    </Button>
                  </div>
                </div>
                {documents.length > 0 ? (
                  <div className="space-y-2 mt-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                            <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                              {doc.uploaded_by_type === 'portal' ? '👤 Paciente' : '👨‍⚕️ Terapeuta'} •{' '}
                              {format(new Date(doc.created_at), "d/MM/yy", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadDoc(doc)}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteDoc(doc)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <FileUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Nenhum documento enviado ainda.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Profile type config ─────────────────────────────────────────────────────
const PROFILE_TYPES = [
  {
    value: 'school',
    label: 'Escola',
    icon: School,
    description: 'Professores e coordenação',
    color: 'text-warning',
    activeBg: 'bg-warning/10 border-warning/40',
  },
  {
    value: 'other',
    label: 'Terapeuta Externo',
    icon: Building2,
    description: 'Outro profissional de saúde',
    color: 'text-primary',
    activeBg: 'bg-primary/10 border-primary/40',
  },
  {
    value: 'responsible',
    label: 'Familiar / Responsável',
    icon: Users,
    description: 'Pais, tutores ou guardiões',
    color: 'text-success',
    activeBg: 'bg-success/10 border-success/40',
  },
  {
    value: 'patient',
    label: 'Paciente',
    icon: UserCircle,
    description: 'O próprio paciente',
    color: 'text-accent-foreground',
    activeBg: 'bg-accent/30 border-accent',
  },
];

// ─── Add Access Dialog ────────────────────────────────────────────────────────
function AddAccessDialog({
  open, onClose, patientId, patientEmail, patientName, responsibleEmail, responsibleName, onAdded,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientEmail?: string | null;
  patientName: string;
  responsibleEmail?: string | null;
  responsibleName?: string | null;
  onAdded: () => void;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [accessType, setAccessType] = useState('responsible');
  const [accessLabel, setAccessLabel] = useState('');
  const [permissions, setPermissions] = useState({ ...DEFAULT_PERMISSIONS });
  const [saving, setSaving] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);

  // Specific details per profile type
  const [schoolName, setSchoolName] = useState('');
  const [schoolYear, setSchoolYear] = useState('');
  const [teacherName, setTeacherName] = useState('');
  const [coordinationContact, setCoordinationContact] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [originClinic, setOriginClinic] = useState('');
  const [kinship, setKinship] = useState('');
  const [livesWithPatient, setLivesWithPatient] = useState(false);

  // Reset permissions when access type changes
  useEffect(() => {
    if (accessType === 'school') {
      setPermissions({ messages: false, feedbacks: true, financial: false, contract: false, intake: false, notices: true, documents: true });
    } else if (accessType === 'other') {
      setPermissions({ messages: true, feedbacks: true, financial: false, contract: false, intake: false, notices: true, documents: true });
    } else if (accessType === 'responsible') {
      setPermissions({ messages: true, feedbacks: true, financial: true, contract: true, intake: true, notices: true, documents: true });
    } else {
      setPermissions({ ...DEFAULT_PERMISSIONS });
    }
  }, [accessType]);

  const buildSpecificDetails = () => {
    if (accessType === 'school') return { school_name: schoolName, school_year: schoolYear, teacher_name: teacherName, coordination_contact: coordinationContact };
    if (accessType === 'other') return { specialty, professional_id: professionalId, origin_clinic: originClinic };
    if (accessType === 'responsible') return { kinship, lives_with_patient: livesWithPatient };
    return {};
  };

  const handleSend = async () => {
    if (!email.trim()) { toast.error('Informe o e-mail'); return; }
    setSaving(true);
    try {
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('patient_portal_accounts').insert({
        patient_id: patientId,
        therapist_user_id: user!.id,
        patient_email: email.trim(),
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invite_expires_at: expiresAt,
        status: 'invited',
        user_id: null,
        access_type: accessType,
        access_label: accessLabel.trim() || null,
        permissions,
        specific_details: buildSpecificDetails(),
      } as any);
      if (error) throw error;

      const { error: fnError } = await supabase.functions.invoke('send-portal-invite', {
        body: {
          patient_id: patientId,
          override_email: email.trim(),
          access_type: accessType,
          access_label: accessLabel.trim() || null,
          invite_token: inviteToken,
        },
      });
      if (fnError) console.warn('Email send warning:', fnError.message);

      toast.success('Convite enviado! ✉️');
      onAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar acesso');
    } finally {
      setSaving(false);
    }
  };

  const profileCfg = PROFILE_TYPES.find(p => p.value === accessType)!;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary" /> Adicionar Acesso ao Portal
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">

          {/* Step 1: Profile type selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qual é o vínculo com o paciente?</Label>
            <div className="grid grid-cols-2 gap-2">
              {PROFILE_TYPES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setAccessType(p.value)}
                  className={cn(
                    'rounded-xl border p-3 text-left flex items-start gap-3 transition-all duration-200',
                    accessType === p.value
                      ? cn('shadow-sm', p.activeBg)
                      : 'bg-card border-border hover:bg-muted/30'
                  )}
                >
                  <div className={cn('mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                    accessType === p.value ? 'bg-background/70' : 'bg-muted/50')}>
                    <p.icon className={cn('w-4 h-4', p.color)} />
                  </div>
                  <div>
                    <p className={cn('text-xs font-semibold', accessType === p.value ? p.color : 'text-foreground')}>{p.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{p.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Common fields */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dados de acesso</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome / Identificação</Label>
                <Input
                  value={accessLabel}
                  onChange={e => setAccessLabel(e.target.value)}
                  placeholder={accessType === 'responsible' ? 'Ex: Mãe – Ana' : accessType === 'school' ? 'Ex: Colégio XV' : 'Identificação'}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">E-mail (login) *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
            {/* Quick-fill suggestions */}
            {(patientEmail || responsibleEmail) && (
              <div className="flex flex-wrap gap-2">
                <p className="text-[10px] text-muted-foreground w-full">Usar e-mail do cadastro:</p>
                {patientEmail && (
                  <button
                    type="button"
                    onClick={() => setEmail(patientEmail)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                  >
                    <UserCircle className="w-3 h-3 text-primary" />
                    Paciente — {patientEmail}
                  </button>
                )}
                {responsibleEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(responsibleEmail);
                      if (responsibleName) setAccessLabel(responsibleName);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-[11px] font-medium text-foreground transition-colors"
                  >
                    <Users className="w-3 h-3 text-success" />
                    Responsável — {responsibleEmail}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Conditional specific fields */}
          {accessType === 'school' && (
            <div className="space-y-3 rounded-xl border border-warning/20 bg-warning/5 p-4 animate-fade-in">
              <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                <School className="w-3.5 h-3.5" /> Informações da Escola
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da Instituição</Label>
                  <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="Ex: Colégio XV de Novembro" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Série / Ano do Aluno</Label>
                  <Input value={schoolYear} onChange={e => setSchoolYear(e.target.value)} placeholder="Ex: 3º ano – Fundamental" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Professor Regente</Label>
                  <Input value={teacherName} onChange={e => setTeacherName(e.target.value)} placeholder="Nome do professor" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contato da Coordenação</Label>
                  <Input value={coordinationContact} onChange={e => setCoordinationContact(e.target.value)} placeholder="Tel. ou e-mail" />
                </div>
              </div>
            </div>
          )}

          {accessType === 'other' && (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-fade-in">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Informações do Terapeuta Externo
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Especialidade</Label>
                  <Select value={specialty} onValueChange={setSpecialty}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a especialidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fonoaudiologia">Fonoaudiologia</SelectItem>
                      <SelectItem value="terapia_ocupacional">Terapia Ocupacional</SelectItem>
                      <SelectItem value="psicologia">Psicologia</SelectItem>
                      <SelectItem value="fisioterapia">Fisioterapia</SelectItem>
                      <SelectItem value="psiquiatria">Psiquiatria</SelectItem>
                      <SelectItem value="neurologia">Neurologia</SelectItem>
                      <SelectItem value="pedagogia">Pedagogia / Psicopedagogia</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Registro Profissional</Label>
                    <Input value={professionalId} onChange={e => setProfessionalId(e.target.value)} placeholder="CRP / Crefito / CRM..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Clínica de Origem</Label>
                    <Input value={originClinic} onChange={e => setOriginClinic(e.target.value)} placeholder="Nome da clínica" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {accessType === 'responsible' && (
            <div className="space-y-3 rounded-xl border border-success/20 bg-success/5 p-4 animate-fade-in">
              <p className="text-xs font-semibold text-success flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Informações do Responsável
              </p>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Grau de Parentesco</Label>
                  <Select value={kinship} onValueChange={setKinship}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mae">Mãe</SelectItem>
                      <SelectItem value="pai">Pai</SelectItem>
                      <SelectItem value="avo_a">Avó / Avô</SelectItem>
                      <SelectItem value="tio_a">Tio / Tia</SelectItem>
                      <SelectItem value="conjuge">Cônjuge / Companheiro(a)</SelectItem>
                      <SelectItem value="irmao_a">Irmão / Irmã</SelectItem>
                      <SelectItem value="tutor">Tutor Legal</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between bg-background/70 rounded-lg border border-border px-3 py-2.5">
                  <Label className="text-xs cursor-pointer">Mora com o paciente?</Label>
                  <Switch checked={livesWithPatient} onCheckedChange={setLivesWithPatient} />
                </div>
              </div>
            </div>
          )}

          {/* Permissions toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPermissions(p => !p)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPermissions ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Configurar permissões de acesso
            </button>
            {showPermissions && (
              <div className="grid grid-cols-2 gap-2 animate-fade-in">
                {Object.entries(PERM_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs">{label}</span>
                    <Switch checked={!!permissions[key]} onCheckedChange={v => setPermissions(p => ({ ...p, [key]: v }))} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button onClick={handleSend} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Enviar convite por e-mail
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main PortalTab ───────────────────────────────────────────────────────────
export function PortalTab({ patientId, patientEmail, patientName, responsibleEmail, responsibleName }: PortalTabProps) {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<PortalAccount[]>([]);
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<PortalAccount | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Per-patient payment visibility
  const [showPaymentInPortal, setShowPaymentInPortal] = useState(false);
  const [clinicHasPaymentData, setClinicHasPaymentData] = useState(false);
  const [savingPaymentToggle, setSavingPaymentToggle] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [{ data: accs }, { data: form }, { data: patientData }] = await Promise.all([
      supabase.from('patient_portal_accounts').select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: true }),
      supabase.from('patient_intake_forms').select('*').eq('patient_id', patientId).maybeSingle(),
      supabase.from('patients').select('show_payment_in_portal, clinic_id').eq('id', patientId).single(),
    ]);
    const list = (accs || []) as PortalAccount[];
    setAccounts(list);
    setIntakeForm(form as IntakeForm | null);
    if (patientData) {
      setShowPaymentInPortal((patientData as any).show_payment_in_portal ?? false);
      // Check if the clinic has payment data configured and enabled
      if ((patientData as any).clinic_id) {
        const { data: clinicData } = await supabase
          .from('clinics')
          .select('show_payment_in_portal, payment_pix_key, payment_pix_name')
          .eq('id', (patientData as any).clinic_id)
          .single();
        const hasData = !!(clinicData?.payment_pix_key || clinicData?.payment_pix_name);
        setClinicHasPaymentData(hasData && !!(clinicData?.show_payment_in_portal));
      }
    }
    // Auto-expand first active or first account
    if (list.length > 0 && !expandedAccount) {
      const active = list.find(a => a.status === 'active') || list[0];
      setExpandedAccount(active.id);
    }
    setLoading(false);
  };

  const handleSavePaymentToggle = async (value: boolean) => {
    setShowPaymentInPortal(value);
    setSavingPaymentToggle(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({ show_payment_in_portal: value } as any)
        .eq('id', patientId);
      if (error) throw error;
      toast.success(value ? 'Dados de pagamento visíveis no portal ✅' : 'Dados de pagamento ocultados no portal');
    } catch {
      toast.error('Erro ao salvar configuração');
      setShowPaymentInPortal(!value); // revert
    } finally {
      setSavingPaymentToggle(false);
    }
  };

  useEffect(() => { loadData(); }, [patientId]);

  // Realtime intake form
  useEffect(() => {
    const channel = supabase.channel(`portal-intake-therapist-${patientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'patient_intake_forms', filter: `patient_id=eq.${patientId}` },
        (p) => setIntakeForm(p.new as IntakeForm))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [patientId]);

  const handleReinvite = async (account: PortalAccount) => {
    setInviting(account.id);
    try {
      const inviteToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('patient_portal_accounts').update({
        invite_token: inviteToken,
        invite_sent_at: new Date().toISOString(),
        invite_expires_at: expiresAt,
        status: 'invited',
      }).eq('id', account.id);

      await supabase.functions.invoke('send-portal-invite', {
        body: {
          patient_id: patientId,
          override_email: account.patient_email,
          access_type: account.access_type,
          access_label: account.access_label,
          invite_token: inviteToken,
        },
      });
      toast.success('Convite reenviado! ✉️');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reenviar convite');
    } finally {
      setInviting(null);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      await supabase.from('patient_portal_accounts').delete().eq('id', accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
      if (expandedAccount === accountId) setExpandedAccount(null);
      toast.success('Acesso excluído');
    } catch {
      toast.error('Erro ao excluir acesso');
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleArchiveAccount = async (accountId: string) => {
    setDeletingId(accountId);
    try {
      await supabase.from('patient_portal_accounts').update({ status: 'archived' }).eq('id', accountId);
      setAccounts(prev => prev.map(a => a.id === accountId ? { ...a, status: 'archived' } : a));
      toast.success('Acesso arquivado');
    } catch {
      toast.error('Erro ao arquivar acesso');
    } finally {
      setDeletingId(null);
      setDeleteConfirm(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">ED</span>
          <span className="text-sm font-semibold text-foreground">Portal do Paciente</span>
          <Badge variant="outline" className="text-xs">{accounts.length} acesso(s)</Badge>
        </div>
        <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5 text-xs h-8">
          <Plus className="w-3 h-3" /> Adicionar acesso
        </Button>
      </div>

      {!patientEmail && (
        <p className="text-xs text-warning flex items-center gap-1 bg-warning/10 border border-warning/20 rounded-lg px-3 py-2">
          ⚠️ Paciente sem e-mail. Adicione um e-mail para enviar convites.
        </p>
      )}

      {/* Per-patient payment data visibility toggle */}
      <div className={cn(
        'rounded-xl border p-4 flex items-center justify-between gap-3',
        clinicHasPaymentData
          ? 'bg-success/5 border-success/20'
          : 'bg-muted/30 border-border'
      )}>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
            clinicHasPaymentData ? 'bg-success/15' : 'bg-muted'
          )}>
            <CreditCard className={cn('w-4 h-4', clinicHasPaymentData ? 'text-success' : 'text-muted-foreground')} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Dados de Pagamento no Portal</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-tight">
              {clinicHasPaymentData
                ? 'Exibir chave PIX e dados bancários do consultório na aba Financeiro deste paciente'
                : 'Configure os dados de recebimento no Perfil para ativar esta opção'}
            </p>
          </div>
        </div>
        <Switch
          checked={showPaymentInPortal}
          onCheckedChange={handleSavePaymentToggle}
          disabled={!clinicHasPaymentData || savingPaymentToggle}
        />
      </div>

      {accounts.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">Nenhum acesso ao portal ainda.</p>
          <p className="text-xs text-muted-foreground/70">Clique em "Adicionar acesso" para convidar o paciente, responsável, escola ou clínica.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(account => {
            const isExpanded = expandedAccount === account.id;
            const statusCfg = account.status === 'active'
              ? { label: 'Ativo', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 }
              : account.status === 'archived'
              ? { label: 'Arquivado', color: 'bg-muted/30 text-muted-foreground border-border', icon: X }
              : { label: 'Convite enviado', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock };
            const StatusIcon = statusCfg.icon;

            return (
              <div key={account.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Account header row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandedAccount(isExpanded ? null : account.id)}
                >
                  <AccessTypeIcon type={account.access_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {account.access_label || ACCESS_TYPES.find(t => t.value === account.access_type)?.label || 'Acesso'}
                      </span>
                      <AccessTypeBadge type={account.access_type} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border', statusCfg.color)}>
                        <StatusIcon className="w-2.5 h-2.5" />{statusCfg.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">{account.patient_email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                      onClick={e => { e.stopPropagation(); handleReinvite(account); }}
                      disabled={inviting === account.id} title="Reenviar convite">
                      {inviting === account.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </Button>
                    {account.status === 'active' && (
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground"
                        onClick={e => { e.stopPropagation(); window.open('/portal/home', '_blank'); }}
                        title="Ver portal">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={e => { e.stopPropagation(); setDeleteConfirm(account); }}
                      title="Remover acesso">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-border p-4">
                    <AccountPanel
                      account={account}
                      patientId={patientId}
                      patientName={account.access_label || patientName}
                      intakeForm={intakeForm}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddAccessDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        patientId={patientId}
        patientEmail={patientEmail}
        patientName={patientName}
        onAdded={loadData}
      />

      {/* Delete / Archive confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={v => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Trash2 className="w-4 h-4 text-destructive" />
              Remover acesso ao portal
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              O que você deseja fazer com o acesso de{' '}
              <span className="font-semibold text-foreground">
                {deleteConfirm?.access_label || ACCESS_TYPES.find(t => t.value === deleteConfirm?.access_type)?.label || 'este usuário'}
              </span>
              ?
            </p>
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
              <p><span className="font-medium text-foreground">Arquivar:</span> bloqueia o acesso mas mantém o histórico de mensagens e documentos.</p>
              <p><span className="font-medium text-destructive">Excluir:</span> remove permanentemente o acesso e todos os dados vinculados.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs h-9"
                onClick={() => deleteConfirm && handleArchiveAccount(deleteConfirm.id)}
                disabled={!!deletingId}>
                {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Arquivar acesso
              </Button>
              <Button variant="destructive" className="flex-1 text-xs h-9"
                onClick={() => deleteConfirm && handleDeleteAccount(deleteConfirm.id)}
                disabled={!!deletingId}>
                {deletingId ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Excluir permanente
              </Button>
            </div>
            <Button variant="ghost" className="w-full text-xs h-8 text-muted-foreground"
              onClick={() => setDeleteConfirm(null)} disabled={!!deletingId}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
