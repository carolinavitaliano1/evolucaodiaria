import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Send, Copy, CheckCircle2,
  Image, X, Upload, MessageSquare
} from 'lucide-react';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { Evolution } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FeedbackIAModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evolutions: Evolution[];
  patientId: string;
  patientName: string;
  patientWhatsapp?: string | null;
  responsibleWhatsapp?: string | null;
  clinicalArea?: string | null;
  isBulk?: boolean;
}

export function FeedbackIAModal({
  open,
  onOpenChange,
  evolutions,
  patientId,
  patientName,
  patientWhatsapp,
  responsibleWhatsapp,
  clinicalArea,
  isBulk = false,
}: FeedbackIAModalProps) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [photos, setPhotos] = useState<{ file: File; preview: string; uploading: boolean; url?: string }[]>([]);
  const [sentToPortal, setSentToPortal] = useState(false);

  const handleGenerate = async () => {
    if (!evolutions.length) return;
    setGenerating(true);
    setContent('');
    try {
      const { data, error } = await supabase.functions.invoke('generate-feedback', {
        body: {
          evolutions: evolutions.map(e => ({
            date: e.date,
            text: e.text,
            attendanceStatus: e.attendanceStatus,
          })),
          patientName,
          clinicalArea,
          isBulk,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setContent(data.content || '');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar feedback');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 4) {
      toast.error('Máximo de 4 fotos por feedback');
      return;
    }
    for (const file of files) {
      const preview = URL.createObjectURL(file);
      const photoEntry = { file, preview, uploading: true };
      setPhotos(prev => [...prev, photoEntry]);

      // Upload immediately
      if (!user) continue;
      const ext = file.name.split('.').pop();
      const path = `feedback-photos/${patientId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: true });
      if (error) {
        toast.error('Erro ao enviar foto');
        setPhotos(prev => prev.filter(p => p.preview !== preview));
        continue;
      }
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(path);
      setPhotos(prev => prev.map(p => p.preview === preview ? { ...p, uploading: false, url: urlData.publicUrl } : p));
    }
    e.target.value = '';
  };

  const handleRemovePhoto = (preview: string) => {
    setPhotos(prev => prev.filter(p => p.preview !== preview));
  };

  const handleSendToPortal = async () => {
    if (!content.trim() || !user) return;
    setSaving(true);
    try {
      // Save to portal_notices
      const photoUrls = photos.filter(p => p.url).map(p => p.url!);
      const portalContent = content + (photoUrls.length > 0
        ? `\n\n📷 Fotos da sessão: ${photoUrls.join(', ')}`
        : '');

      const { error: noticeError } = await supabase.from('portal_notices').insert({
        patient_id: patientId,
        therapist_user_id: user.id,
        title: isBulk
          ? `📊 Resumo do período — ${format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}`
          : `💬 Feedback da sessão — ${evolutions[0]?.date ? format(new Date(evolutions[0].date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : format(new Date(), 'dd/MM/yyyy')}`,
        content: portalContent,
      });
      if (noticeError) throw noticeError;

      // Save feedback record
      await supabase.from('evolution_feedbacks').insert({
        user_id: user.id,
        patient_id: patientId,
        evolution_ids: evolutions.map(e => e.id),
        content,
        photo_urls: photos.filter(p => p.url).map(p => p.url),
        sent_to_portal: true,
        is_bulk: isBulk,
      } as any);

      setSentToPortal(true);
      toast.success('Feedback enviado para o portal do paciente! 🎉');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar para o portal');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Texto copiado!');
  };

  const handleWhatsApp = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    const phone = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    const msg = encodeURIComponent(content);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const hasWhatsApp = !!(patientWhatsapp || responsibleWhatsapp);

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setContent(''); setPhotos([]); setSentToPortal(false); } }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            Feedback IA para os Pais
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Context info */}
          <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
            <p className="text-xs text-muted-foreground">
              {isBulk
                ? <><span className="font-semibold text-foreground">{evolutions.length} sessões selecionadas</span> — a IA vai gerar um resumo do período em linguagem para os pais.</>
                : <><span className="font-semibold text-foreground">{patientName}</span> — sessão de {evolutions[0]?.date ? format(new Date(evolutions[0].date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR }) : ''}. A IA vai resumir a sessão em linguagem acessível.</>
              }
            </p>
          </div>

          {/* Generate button */}
          {!content && (
            <Button
              className="w-full gap-2"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando com IA...</>
                : <><Sparkles className="w-4 h-4" /> Gerar Feedback com IA</>
              }
            </Button>
          )}

          {/* Content editor */}
          {content && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" /> Feedback gerado
                  </p>
                  <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground gap-1"
                    onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Regerar
                  </Button>
                </div>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="min-h-[180px] text-sm resize-none"
                  placeholder="Feedback gerado aqui..."
                />
                <p className="text-[10px] text-muted-foreground">Você pode editar o texto acima antes de enviar.</p>
              </div>

              {/* Photo upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-primary" /> Fotos da sessão (opcional)
                  </p>
                  <span className="text-[10px] text-muted-foreground">{photos.length}/4</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.preview} className="relative w-16 h-16 rounded-xl overflow-hidden border border-border">
                      <img src={p.preview} alt="" className="w-full h-full object-cover" />
                      {p.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 text-white animate-spin" />
                        </div>
                      )}
                      {!p.uploading && (
                        <button
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive/90 flex items-center justify-center"
                          onClick={() => handleRemovePhoto(p.preview)}
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      )}
                    </div>
                  ))}
                  {photos.length < 4 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <input type="file" accept="image/*" multiple className="hidden" onChange={handleAddPhoto} />
                    </label>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-1 gap-2 pt-1">
                {sentToPortal ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-success text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" /> Enviado para o portal!
                  </div>
                ) : (
                  <Button
                    onClick={handleSendToPortal}
                    disabled={saving || !content.trim() || photos.some(p => p.uploading)}
                    className="gap-2 w-full"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar para o Portal do Paciente
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleCopy} className="gap-2">
                    {copied ? <CheckCircle2 className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiado!' : 'Copiar Texto'}
                  </Button>

                  {hasWhatsApp && (
                    <Button
                      variant="outline"
                      className="gap-2 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/5"
                      onClick={() => {
                        const num = responsibleWhatsapp || patientWhatsapp!;
                        handleWhatsApp(num);
                      }}
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                      WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
