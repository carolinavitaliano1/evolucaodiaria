import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageSquare, Send, Pencil, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMessageTemplates,
  resolveTemplate,
  openWhatsApp,
  TEMPLATE_CATEGORIES,
  DEFAULT_TEMPLATES,
  TemplateVars,
} from '@/hooks/useMessageTemplates';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';
import { toast } from 'sonner';

interface QuickWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  phone: string | null | undefined;
  /** Variables automatically injected into templates */
  vars?: TemplateVars;
  /** Patient name shown in the header */
  patientName?: string;
}

export function QuickWhatsAppModal({
  open,
  onClose,
  phone,
  vars = {},
  patientName,
}: QuickWhatsAppModalProps) {
  const { templates, loading, seedDefaults } = useMessageTemplates();
  const [selectedId, setSelectedId] = useState<string | 'custom'>('custom');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);

  // When templates load, pre-select first one
  useEffect(() => {
    if (!open) return;
    if (templates.length > 0 && selectedId === 'custom' && !message) {
      handleSelect(templates[0].id);
    }
  }, [open, templates]);

  function handleSelect(id: string) {
    setSelectedId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setMessage(resolveTemplate(tpl.content, vars));
    }
    setEditing(false);
  }

  function handleSelectCustom() {
    setSelectedId('custom');
    setMessage('');
    setEditing(true);
  }

  function handleSend() {
    if (!phone || !message.trim()) return;
    openWhatsApp(phone, message.trim());
    onClose();
  }

  const getCatInfo = (cat: string) =>
    TEMPLATE_CATEGORIES.find(c => c.id === cat) ?? { label: cat, emoji: '💬' };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            Enviar WhatsApp
            {patientName && (
              <span className="text-muted-foreground font-normal text-sm">— {patientName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-4 overflow-y-auto flex-1">
          {/* Template picker */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3" /> Escolha um modelo
            </p>

            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-4 border border-dashed border-border rounded-xl">
                <p className="text-xs text-muted-foreground mb-2">Você ainda não tem modelos salvos.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs"
                  onClick={async () => { await seedDefaults(); }}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Carregar exemplos
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-44">
                <div className="space-y-1.5 pr-1">
                  {templates.map(t => {
                    const cat = getCatInfo(t.category);
                    const resolved = resolveTemplate(t.content, vars);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelect(t.id)}
                        className={cn(
                          'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                          selectedId === t.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card hover:bg-secondary/60'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-base">{cat.emoji}</span>
                          <span className="font-medium text-sm text-foreground">{t.name}</span>
                          <Badge variant="secondary" className="text-[10px] py-0 h-4 ml-auto">{cat.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-6 leading-relaxed">
                          {resolved}
                        </p>
                      </button>
                    );
                  })}

                  {/* Custom / free text option */}
                  <button
                    type="button"
                    onClick={handleSelectCustom}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      selectedId === 'custom'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:bg-secondary/60'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">✏️</span>
                      <span className="font-medium text-sm text-foreground">Mensagem livre</span>
                    </div>
                  </button>
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Message editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Mensagem</p>
              {selectedId !== 'custom' && !editing && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Pencil className="w-3 h-3" /> Editar antes de enviar
                </button>
              )}
            </div>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="min-h-[110px] text-sm resize-none font-sans"
              readOnly={selectedId !== 'custom' && !editing}
              onClick={() => { if (selectedId !== 'custom') setEditing(true); }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {message.length} caracteres
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-3 border-t border-border shrink-0 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button
            size="sm"
            disabled={!phone || !message.trim()}
            onClick={handleSend}
            className="gap-2 bg-[hsl(142,70%,45%)] hover:bg-[hsl(142,70%,38%)] text-white border-0"
          >
            <Send className="w-3.5 h-3.5" />
            Abrir no WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
