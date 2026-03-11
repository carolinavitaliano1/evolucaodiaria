import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Send, Loader2, Mail, RefreshCw, CheckCircle2, Clock, MessageSquare, FileText, Bell, FilePenLine, Eye, ExternalLink } from 'lucide-react';
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
}

interface PortalAccount {
  id: string;
  status: string;
  invite_sent_at: string | null;
  patient_email: string;
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
}

export function PortalTab({ patientId, patientEmail, patientName }: PortalTabProps) {
  const { user } = useAuth();
  const [portalAccount, setPortalAccount] = useState<PortalAccount | null>(null);
  const [messages, setMessages] = useState<PortalMessage[]>([]);
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [messageType, setMessageType] = useState('message');

  const loadData = async () => {
    setLoading(true);
    const [{ data: account }, { data: msgs }, { data: form }] = await Promise.all([
      supabase.from('patient_portal_accounts').select('*').eq('patient_id', patientId).maybeSingle(),
      supabase.from('portal_messages').select('*').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
      supabase.from('patient_intake_forms').select('submitted_at, full_name, phone').eq('patient_id', patientId).maybeSingle(),
    ]);
    setPortalAccount(account as PortalAccount | null);
    setMessages((msgs || []) as PortalMessage[]);
    setIntakeForm(form as IntakeForm | null);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [patientId]);

  const handleSendInvite = async () => {
    if (!patientEmail) { toast.error('Adicione um e-mail ao paciente antes de ativar o portal'); return; }
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke('send-portal-invite', { body: { patient_id: patientId } });
      if (error) throw error;
      toast.success('Convite enviado! ✉️');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar convite');
    } finally {
      setInviting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !portalAccount) return;
    setSending(true);
    try {
      const { error } = await supabase.from('portal_messages').insert({
        patient_id: patientId,
        therapist_user_id: user!.id,
        sender_type: 'therapist',
        content: newMessage.trim(),
        message_type: messageType,
        read_by_patient: false,
        read_by_therapist: true,
      });
      if (error) throw error;
      setNewMessage('');
      toast.success('Mensagem enviada!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const statusConfig = {
    invited: { label: 'Convite enviado', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
    active: { label: 'Portal ativo', color: 'bg-success/10 text-success border-success/20', icon: CheckCircle2 },
  };
  const statusInfo = portalAccount ? statusConfig[portalAccount.status as keyof typeof statusConfig] : null;
  const unreadFromPatient = messages.filter(m => m.sender_type === 'patient' && !m.read_by_therapist).length;

  return (
    <div className="space-y-4">
      {/* Portal status card */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">ED</span>
              Portal do Paciente
            </h3>
            {portalAccount ? (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {statusInfo && (
                  <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border', statusInfo.color)}>
                    <statusInfo.icon className="w-3 h-3" />
                    {statusInfo.label}
                  </span>
                )}
                {portalAccount.invite_sent_at && (
                  <span className="text-xs text-muted-foreground">
                    Enviado {format(new Date(portalAccount.invite_sent_at), "d MMM", { locale: ptBR })}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Portal não ativado para este paciente</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm" variant={portalAccount ? 'outline' : 'default'}
              onClick={handleSendInvite} disabled={inviting}
              className="gap-1.5 text-xs h-8"
            >
              {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : portalAccount ? <RefreshCw className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
              {portalAccount ? 'Reenviar convite' : 'Ativar portal'}
            </Button>
            {portalAccount?.status === 'active' && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-8 text-muted-foreground"
                onClick={() => window.open('/portal/home', '_blank')}
              >
                <ExternalLink className="w-3 h-3" />
                Ver portal
              </Button>
            )}
          </div>
        </div>
        {!patientEmail && (
          <p className="text-xs text-warning mt-2 flex items-center gap-1">
            ⚠️ Paciente sem e-mail cadastrado. Adicione um e-mail para ativar o portal.
          </p>
        )}
      </div>

      {/* Portal management tabs (only when portal is active or invited) */}
      {portalAccount && (
        <Tabs defaultValue="messages" className="space-y-3">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="messages" className="text-xs gap-1 relative">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mensagens</span>
              <span className="sm:hidden">Chat</span>
              {unreadFromPatient > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadFromPatient}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="contract" className="text-xs gap-1">
              <FilePenLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Contrato</span>
              <span className="sm:hidden">Contr.</span>
            </TabsTrigger>
            <TabsTrigger value="notices" className="text-xs gap-1">
              <Bell className="w-3.5 h-3.5" />
              Avisos
            </TabsTrigger>
            <TabsTrigger value="evolutions" className="text-xs gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Evoluções</span>
              <span className="sm:hidden">Evol.</span>
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="messages" className="space-y-3 mt-0">
            {/* Intake form status */}
            {portalAccount.status === 'active' && intakeForm?.submitted_at && (
              <div className="flex items-center gap-2 bg-success/10 text-success border border-success/20 rounded-xl px-3 py-2 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Ficha preenchida em {format(new Date(intakeForm.submitted_at), "d 'de' MMMM", { locale: ptBR })}</span>
              </div>
            )}

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Enviar mensagem
                </h3>
                <span className="text-xs text-muted-foreground">{messages.length} msgs</span>
              </div>

              <div className="p-4 border-b border-border space-y-2">
                <Select value={messageType} onValueChange={setMessageType}>
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="message">💬 Mensagem</SelectItem>
                    <SelectItem value="tarefa">📋 Tarefa para casa</SelectItem>
                    <SelectItem value="feedback">✨ Feedback de sessão</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder={messageType === 'tarefa' ? `Tarefa para ${patientName}...` : messageType === 'feedback' ? `Feedback da sessão...` : `Mensagem para ${patientName}...`}
                  className="resize-none text-sm min-h-[80px]"
                />
                <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim() || sending} className="gap-1.5">
                  {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Enviar
                </Button>
              </div>

              <div className="divide-y divide-border max-h-64 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Nenhuma mensagem ainda.</p>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={cn('px-4 py-3', msg.sender_type === 'patient' && 'bg-muted/30')}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', msg.sender_type === 'therapist' ? 'text-primary' : 'text-muted-foreground')}>
                          {msg.sender_type === 'therapist' ? '👨‍⚕️ Você' : `👤 ${patientName}`}
                        </span>
                        {msg.message_type !== 'message' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {msg.message_type === 'tarefa' ? '📋 Tarefa' : '✨ Feedback'}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {format(new Date(msg.created_at), "d MMM 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* Contract Tab */}
          <TabsContent value="contract" className="mt-0">
            <ContractManager patientId={patientId} patientName={patientName} />
          </TabsContent>

          {/* Notices Tab */}
          <TabsContent value="notices" className="mt-0">
            <div className="bg-card rounded-xl border border-border p-4">
              <PortalNoticesManager patientId={patientId} patientName={patientName} />
            </div>
          </TabsContent>

          {/* Shared Evolutions Tab */}
          <TabsContent value="evolutions" className="mt-0">
            <div className="bg-card rounded-xl border border-border p-4">
              <SharedEvolutionsManager patientId={patientId} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
