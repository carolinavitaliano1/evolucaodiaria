import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { MessageSquare, Search, Send, Users, Phone, ChevronRight, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMessageTemplates,
  resolveTemplate,
  openWhatsApp,
  TEMPLATE_CATEGORIES,
  DEFAULT_TEMPLATES,
} from '@/hooks/useMessageTemplates';
import { WhatsAppRecipientModal } from '@/components/whatsapp/WhatsAppRecipientModal';
import { WhatsAppBroadcastModal } from '@/components/whatsapp/WhatsAppBroadcastModal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Patient {
  id: string;
  name: string;
  phone?: string | null;
  whatsapp?: string | null;
  responsible_name?: string | null;
  responsible_whatsapp?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  financial_responsible_name?: string | null;
  financial_responsible_whatsapp?: string | null;
  email?: string | null;
  birthdate?: string | null;
}

interface WhatsAppSendPanelProps {
  patients: Patient[];
  clinic?: { name?: string; address?: string; phone?: string };
  onGoToTemplates?: () => void;
}

export function WhatsAppSendPanel({ patients, clinic, onGoToTemplates }: WhatsAppSendPanelProps) {
  const { templates, loading } = useMessageTemplates();
  const { user } = useAuth();
  const [therapistName, setTherapistName] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('name').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.name) setTherapistName(data.name); });
  }, [user]);

  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [step, setStep] = useState<'patients' | 'template'>('patients');
  const [recipientPicker, setRecipientPicker] = useState<{
    patient: Patient;
    message: string;
  } | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastPatients, setBroadcastPatients] = useState<Patient[]>([]);
  const [broadcastTemplate, setBroadcastTemplate] = useState<typeof displayTemplates[0] | null>(null);

  // All patients with any reachable phone number (own, responsible, guardian, financial)
  const eligible = useMemo(
    () => patients.filter(p =>
      p.whatsapp?.trim() || p.phone?.trim() ||
      p.responsible_whatsapp?.trim() ||
      p.guardian_phone?.trim() ||
      p.financial_responsible_whatsapp?.trim()
    ),
    [patients]
  );

  const filtered = useMemo(
    () => eligible.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    ),
    [eligible, search]
  );

  const displayTemplates = templates.length > 0
    ? templates
    : DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `default-${i}`, user_id: '', created_at: '', updated_at: '' }));

  const getCategoryInfo = (cat: string) =>
    TEMPLATE_CATEGORIES.find(c => c.id === cat) ?? { label: cat, emoji: '💬' };

  const selectedTemplate = displayTemplates.find(t => t.id === selectedTemplateId) ?? null;

  function togglePatient(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filtered.map(p => p.id)));
  }

  function clearAll() {
    setSelectedIds(new Set());
  }

  function buildMsg(p: Patient, template: typeof displayTemplates[0]) {
    return resolveTemplate(template.content, {
      nome_paciente:     p.name,
      telefone_paciente: p.phone    || '',
      email_paciente:    p.email    || '',
      data_nascimento:   p.birthdate ? new Date(p.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
      responsavel:       p.responsible_name || '',
      nome_terapeuta:    therapistName,
      nome_clinica:      clinic?.name    || '',
      endereco_clinica:  clinic?.address || '',
      telefone_clinica:  clinic?.phone   || '',
    });
  }

  function sendToNumber(p: Patient, num: string, template: typeof displayTemplates[0]) {
    openWhatsApp(num, buildMsg(p, template));
  }

  function handleSend() {
    if (!selectedTemplate) return;
    const selected = eligible.filter(p => selectedIds.has(p.id));
    if (selected.length === 0) return;

    if (selected.length === 1) {
      const p = selected[0];
      const hasPatientNum = !!(p.whatsapp || p.phone);
      const hasResponsible = !!p.responsible_whatsapp;
      if (hasPatientNum && hasResponsible) {
        setRecipientPicker({ patient: p, message: buildMsg(p, selectedTemplate) });
        return;
      }
      const num = p.whatsapp || p.phone!;
      sendToNumber(p, num, selectedTemplate);
      setSelectedIds(new Set());
      setSelectedTemplateId(null);
      setStep('patients');
    } else {
      // Open broadcast modal — state is reset when modal closes
      setBroadcastPatients(selected);
      setBroadcastTemplate(selectedTemplate);
      setBroadcastOpen(true);
    }
  }

  if (loading) return null;

  return (
    <div className="border border-border rounded-xl bg-card">
      {/* Header */}
      <div className="bg-[#25D366]/10 border-b border-border px-4 py-3 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#25D366]/20 flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5 text-[#25D366]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Enviar para Pacientes</p>
            <p className="text-[11px] text-muted-foreground">Selecione pacientes e um modelo</p>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <Badge className="bg-[#25D366] text-white border-0 text-xs">
            {selectedIds.size} selecionado{selectedIds.size > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {eligible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-2 px-4">
          <Phone className="w-8 h-8 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Nenhum paciente com telefone cadastrado.</p>
          <p className="text-xs text-muted-foreground">Adicione o telefone nos dados do paciente para enviar mensagens.</p>
        </div>
      ) : (
        <>
          {/* Step tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setStep('patients')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                step === 'patients'
                  ? 'bg-card text-foreground border-b-2 border-[#25D366]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Users className="w-3.5 h-3.5" />
              Pacientes
              {selectedIds.size > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#25D366] text-[9px] font-bold text-white flex items-center justify-center">
                  {selectedIds.size > 9 ? '9+' : selectedIds.size}
                </span>
              )}
            </button>
            <button
              onClick={() => setStep('template')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors',
                step === 'template'
                  ? 'bg-card text-foreground border-b-2 border-[#25D366]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Modelo
              {selectedTemplate && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#25D366]" />
              )}
            </button>
          </div>

          {/* Step: Patient selection */}
          {step === 'patients' && (
            <div>
              <div className="p-3 space-y-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar paciente..."
                    className="pl-8 h-8 text-sm"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {eligible.length} paciente{eligible.length !== 1 ? 's' : ''} com telefone
                  </p>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-xs text-primary hover:underline">Todos</button>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Limpar</button>
                  </div>
                </div>
              </div>
              <ScrollArea className="h-52">
                <div className="divide-y divide-border">
                  {filtered.map(patient => (
                    <div
                      key={patient.id}
                      onClick={() => togglePatient(patient.id)}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(patient.id)}
                        className="shrink-0 pointer-events-none"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{patient.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />{patient.phone}
                        </p>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-6">Nenhum paciente encontrado.</p>
                  )}
                </div>
              </ScrollArea>
              <div className="p-3 border-t border-border">
                <Button
                  className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white border-0 h-8 text-sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setStep('template')}
                >
                  Escolher modelo
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Step: Template selection */}
          {step === 'template' && (
            <div>
              {/* Header with manage button */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Escolha um modelo</p>
                {onGoToTemplates && (
                  <button
                    onClick={onGoToTemplates}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Plus className="w-3 h-3" />
                    Criar / Editar modelos
                  </button>
                )}
              </div>

              <ScrollArea className="h-60">
                <div className="divide-y divide-border px-0">
                  {displayTemplates.map(t => {
                    const cat = getCategoryInfo(t.category);
                    const isSelected = selectedTemplateId === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTemplateId(isSelected ? null : t.id)}
                        className={cn(
                          'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
                          isSelected ? 'bg-[#25D366]/10' : 'hover:bg-accent/50'
                        )}
                      >
                        <span className="text-lg shrink-0">{cat.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{t.name}</span>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                                <span className="text-[9px] text-white font-bold">✓</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                            {t.content}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-3 border-t border-border space-y-2">
                {selectedTemplate && selectedIds.size > 0 && (
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Prévia: </span>
                    {(() => {
                      const p = eligible.find(pt => selectedIds.has(pt.id));
                      return resolveTemplate(selectedTemplate.content, {
                        nome_paciente:     p?.name             || 'Paciente',
                        telefone_paciente: p?.phone            || '',
                        email_paciente:    p?.email            || '',
                        data_nascimento:   p?.birthdate ? new Date(p.birthdate + 'T12:00:00').toLocaleDateString('pt-BR') : '',
                        responsavel:       p?.responsible_name || '',
                        nome_clinica:      clinic?.name    || '',
                        endereco_clinica:  clinic?.address || '',
                        telefone_clinica:  clinic?.phone   || '',
                      }).slice(0, 100);
                    })()}
                    {resolveTemplate(selectedTemplate.content, {}).length > 100 ? '…' : ''}
                  </div>
                )}
                <Button
                  className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white border-0 h-9 text-sm"
                  disabled={!selectedTemplate || selectedIds.size === 0}
                  onClick={handleSend}
                >
                  <Send className="w-3.5 h-3.5" />
                  {selectedIds.size > 1
                    ? `Enviar para ${selectedIds.size} pacientes`
                    : 'Enviar mensagem'}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Recipient picker — single patient with two numbers */}
      {recipientPicker && (
        <WhatsAppRecipientModal
          open={!!recipientPicker}
          onClose={() => {
            setRecipientPicker(null);
            setSelectedIds(new Set());
            setSelectedTemplateId(null);
            setStep('patients');
          }}
          patientName={recipientPicker.patient.name}
          patientWhatsapp={recipientPicker.patient.whatsapp}
          patientPhone={recipientPicker.patient.phone}
          responsibleName={recipientPicker.patient.responsible_name}
          responsibleWhatsapp={recipientPicker.patient.responsible_whatsapp!}
          message={recipientPicker.message}
        />
      )}

      {/* Broadcast modal — multiple patients */}
      {broadcastOpen && broadcastTemplate && (
        <WhatsAppBroadcastModal
          open={broadcastOpen}
          onClose={() => {
            setBroadcastOpen(false);
            setBroadcastPatients([]);
            setBroadcastTemplate(null);
            setSelectedIds(new Set());
            setSelectedTemplateId(null);
            setStep('patients');
          }}
          patients={broadcastPatients}
          template={broadcastTemplate}
          clinic={clinic}
          therapistName={therapistName}
        />
      )}
    </div>
  );
}
