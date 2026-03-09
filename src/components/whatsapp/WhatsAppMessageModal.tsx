import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, ChevronRight, Pencil, Phone, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMessageTemplates,
  resolveTemplate,
  openWhatsApp,
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  DEFAULT_TEMPLATES,
} from '@/hooks/useMessageTemplates';

interface WhatsAppMessageModalProps {
  open: boolean;
  onClose: () => void;
  /** Patient name for {{nome_paciente}} */
  patientName?: string;
  /** Patient phone number */
  patientPhone?: string;
  /** Date string for {{data_consulta}} */
  date?: string;
  /** Time string for {{horario}} */
  time?: string;
  /** Therapist name for {{nome_terapeuta}} */
  therapistName?: string;
}

export function WhatsAppMessageModal({
  open, onClose, patientName, patientPhone, date, time, therapistName,
}: WhatsAppMessageModalProps) {
  const { templates, loading, seedDefaults } = useMessageTemplates();
  const [step, setStep] = useState<'select' | 'compose'>('select');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [phone, setPhone] = useState(patientPhone || '');

  // Seed defaults if user has no templates yet
  useEffect(() => {
    if (!loading && templates.length === 0) seedDefaults();
  }, [loading, templates.length]);

  useEffect(() => {
    if (open) { setStep('select'); setSelectedTemplateId(null); setMessageText(''); setPhone(patientPhone || ''); }
  }, [open, patientPhone]);

  const vars = {
    nome_paciente: patientName || '',
    data_consulta: date || '',
    horario: time || '',
    nome_terapeuta: therapistName || '',
  };

  function selectTemplate(id: string, content: string) {
    setSelectedTemplateId(id);
    setMessageText(resolveTemplate(content, vars));
    setStep('compose');
  }

  function useBlank() {
    setSelectedTemplateId(null);
    setMessageText('');
    setStep('compose');
  }

  function handleSend() {
    if (!phone.trim() || !messageText.trim()) return;
    openWhatsApp(phone, messageText);
    onClose();
  }

  const getCategoryInfo = (cat: string) =>
    TEMPLATE_CATEGORIES.find(c => c.id === cat) ?? { label: cat, emoji: '💬' };

  const displayTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES.map((t, i) => ({ ...t, id: `default-${i}`, user_id: '', created_at: '', updated_at: '' }));

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            {step === 'select' ? 'Enviar via WhatsApp' : 'Compor Mensagem'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3">
            {patientName && (
              <p className="text-sm text-muted-foreground">
                Enviando para: <span className="font-medium text-foreground">{patientName}</span>
              </p>
            )}

            {/* Variables preview */}
            <div className="flex flex-wrap gap-1.5">
              {vars.data_consulta && <Badge variant="secondary" className="text-[10px]">📅 {vars.data_consulta}</Badge>}
              {vars.horario && <Badge variant="secondary" className="text-[10px]">🕐 {vars.horario}</Badge>}
              {vars.nome_terapeuta && <Badge variant="secondary" className="text-[10px]">👤 {vars.nome_terapeuta}</Badge>}
            </div>

            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">Escolha um modelo</p>
            <ScrollArea className="max-h-64">
              <div className="space-y-2 pr-1">
                {displayTemplates.map(t => {
                  const cat = getCategoryInfo(t.category);
                  const preview = resolveTemplate(t.content, vars);
                  return (
                    <button
                      key={t.id}
                      onClick={() => selectTemplate(t.id, t.content)}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{cat.emoji}</span>
                          <span className="text-sm font-semibold text-foreground">{t.name}</span>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{preview}</p>
                    </button>
                  );
                })}

                {/* Blank message option */}
                <button
                  onClick={useBlank}
                  className="w-full text-left p-3 rounded-lg border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all group flex items-center gap-2"
                >
                  <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                  <span className="text-sm text-muted-foreground group-hover:text-foreground">Mensagem em branco</span>
                </button>
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 'compose' && (
          <div className="space-y-4">
            {/* Back to templates */}
            <button onClick={() => setStep('select')} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              ← Voltar aos modelos
            </button>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Phone className="w-3 h-3" /> Número do WhatsApp
              </Label>
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="(11) 99999-9999"
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">DDI opcional. Ex: 11999991234 ou +5511999991234</p>
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Mensagem
                </Label>
                <span className="text-[11px] text-muted-foreground">{messageText.length} caracteres</span>
              </div>
              <Textarea
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="min-h-[120px] text-sm resize-none"
              />
            </div>

            {/* Variable chips */}
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Inserir variável
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.tag}
                    onClick={() => setMessageText(prev => prev + v.tag)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors font-mono"
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Send */}
            <Button
              onClick={handleSend}
              disabled={!phone.trim() || !messageText.trim()}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe57] text-white border-0"
            >
              <Send className="w-4 h-4" />
              Abrir no WhatsApp
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              O WhatsApp será aberto com a mensagem preenchida automaticamente.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
