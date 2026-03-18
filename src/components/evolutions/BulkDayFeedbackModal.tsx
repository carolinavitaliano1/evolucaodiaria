import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Send, Copy, CheckCircle2,
  User, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react';
import { Evolution, Patient } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PatientFeedbackItem {
  evolution: Evolution;
  patient: Patient;
  content: string;
  generating: boolean;
  sent: boolean;
  sending: boolean;
  expanded: boolean;
}

interface BulkDayFeedbackModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: { evo: Evolution; patient: Patient }[];
  selectedDate: Date;
}

export function BulkDayFeedbackModal({ open, onOpenChange, items, selectedDate }: BulkDayFeedbackModalProps) {
  const { user } = useAuth();
  const [feedbackItems, setFeedbackItems] = useState<PatientFeedbackItem[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);

  const handleOpen = (v: boolean) => {
    if (v && !initialized) {
      setFeedbackItems(
        items.map(({ evo, patient }) => ({
          evolution: evo,
          patient,
          content: '',
          generating: false,
          sent: false,
          sending: false,
          expanded: true,
        }))
      );
      setInitialized(true);
    }
    if (!v) {
      setInitialized(false);
      setFeedbackItems([]);
    }
    onOpenChange(v);
  };

  const generateForPatient = async (idx: number) => {
    const item = feedbackItems[idx];
    setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, generating: true } : fi));
    try {
      const { data, error } = await supabase.functions.invoke('generate-feedback', {
        body: {
          evolutions: [{
            date: item.evolution.date,
            text: item.evolution.text,
            attendanceStatus: item.evolution.attendanceStatus,
          }],
          patientName: item.patient.name,
          clinicalArea: item.patient.clinicalArea,
          isBulk: false,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, content: data.content || '', generating: false } : fi));
    } catch (err: any) {
      toast.error(`Erro ao gerar feedback para ${item.patient.name}`);
      setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, generating: false } : fi));
    }
  };

  const generateAll = async () => {
    setGeneratingAll(true);
    for (let i = 0; i < feedbackItems.length; i++) {
      if (feedbackItems[i].sent) continue;
      await generateForPatient(i);
    }
    setGeneratingAll(false);
    toast.success('Feedbacks gerados para todos os pacientes!');
  };

  const sendToPortal = async (idx: number) => {
    const item = feedbackItems[idx];
    if (!item.content.trim() || !user) return;
    setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, sending: true } : fi));
    try {
      const dateLabel = format(new Date(item.evolution.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR });
      await supabase.from('portal_notices').insert({
        patient_id: item.patient.id,
        therapist_user_id: user.id,
        title: `💬 Feedback da sessão — ${dateLabel}`,
        content: item.content,
      });
      await supabase.from('evolution_feedbacks').insert({
        user_id: user.id,
        patient_id: item.patient.id,
        evolution_ids: [item.evolution.id],
        content: item.content,
        photo_urls: [],
        sent_to_portal: true,
        is_bulk: false,
      } as any);
      setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, sent: true, sending: false } : fi));
      toast.success(`Feedback enviado para ${item.patient.name}!`);
    } catch (err: any) {
      toast.error(`Erro ao enviar para ${item.patient.name}`);
      setFeedbackItems(prev => prev.map((fi, i) => i === idx ? { ...fi, sending: false } : fi));
    }
  };

  const sendAll = async () => {
    const toSend = feedbackItems.filter(fi => fi.content.trim() && !fi.sent);
    if (toSend.length === 0) { toast.error('Nenhum feedback gerado para enviar'); return; }
    setSendingAll(true);
    for (let i = 0; i < feedbackItems.length; i++) {
      const fi = feedbackItems[i];
      if (!fi.content.trim() || fi.sent) continue;
      await sendToPortal(i);
    }
    setSendingAll(false);
    toast.success('Todos os feedbacks enviados para o portal!');
  };

  const allGenerated = feedbackItems.length > 0 && feedbackItems.every(fi => fi.content.trim());
  const allSent = feedbackItems.length > 0 && feedbackItems.every(fi => fi.sent);
  const anyGenerated = feedbackItems.some(fi => fi.content.trim() && !fi.sent);
  const sentCount = feedbackItems.filter(fi => fi.sent).length;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            Feedback IA — {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{items.length} pacientes</span> com atendimento neste dia.
            {sentCount > 0 && <span className="text-success font-medium"> {sentCount} enviados.</span>}
          </p>
          <div className="flex gap-2">
            {!allGenerated && (
              <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateAll} disabled={generatingAll}>
                {generatingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Gerar Todos
              </Button>
            )}
            {anyGenerated && !allSent && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-primary border-primary/30" onClick={sendAll} disabled={sendingAll}>
                {sendingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                Enviar Todos
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 -mx-1 px-1">
          <div className="space-y-3 pb-2">
            {feedbackItems.map((fi, idx) => (
              <div key={fi.patient.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Patient header */}
                <div
                  className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setFeedbackItems(prev => prev.map((x, i) => i === idx ? { ...x, expanded: !x.expanded } : x))}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-tight">{fi.patient.name}</p>
                      {fi.patient.clinicalArea && (
                        <p className="text-[10px] text-muted-foreground leading-tight">{fi.patient.clinicalArea}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {fi.sent && (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/20 gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Enviado
                      </Badge>
                    )}
                    {fi.content && !fi.sent && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                        Gerado
                      </Badge>
                    )}
                    {fi.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Expanded content */}
                {fi.expanded && (
                  <div className="px-3 pb-3 space-y-2.5 border-t border-border/50">
                    {/* Generate area */}
                    {!fi.content && !fi.generating && (
                      <Button
                        size="sm" className="w-full gap-2 mt-2.5 h-8 text-xs"
                        onClick={() => generateForPatient(idx)}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Gerar Feedback com IA
                      </Button>
                    )}
                    {fi.generating && (
                      <div className="flex items-center justify-center gap-2 py-4 text-primary text-xs">
                        <Loader2 className="w-4 h-4 animate-spin" /> Gerando feedback...
                      </div>
                    )}
                    {fi.content && (
                      <div className="space-y-2 mt-2.5">
                        <Textarea
                          value={fi.content}
                          onChange={e => setFeedbackItems(prev => prev.map((x, i) => i === idx ? { ...x, content: e.target.value } : x))}
                          className="text-xs min-h-[100px] resize-none"
                          disabled={fi.sent}
                        />
                        {!fi.sent && (
                          <div className="flex gap-2">
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs gap-1.5 flex-shrink-0"
                              onClick={() => generateForPatient(idx)} disabled={fi.generating}
                            >
                              <RefreshCw className="w-3 h-3" /> Regerar
                            </Button>
                            <Button
                              size="sm" variant="outline" className="h-7 text-xs gap-1.5 flex-shrink-0"
                              onClick={async () => { await navigator.clipboard.writeText(fi.content); toast.success('Copiado!'); }}
                            >
                              <Copy className="w-3 h-3" /> Copiar
                            </Button>
                            <Button
                              size="sm" className="h-7 text-xs gap-1.5 flex-1"
                              onClick={() => sendToPortal(idx)} disabled={fi.sending}
                            >
                              {fi.sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Enviar para Portal
                            </Button>
                          </div>
                        )}
                        {fi.sent && (
                          <div className="flex items-center gap-1.5 text-success text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enviado com sucesso para o portal!
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
