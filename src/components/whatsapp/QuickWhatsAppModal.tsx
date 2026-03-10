import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageSquare, Send, Pencil, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMessageTemplates,
  resolveTemplate,
  TEMPLATE_CATEGORIES,
  TemplateVars,
} from '@/hooks/useMessageTemplates';
import { WhatsAppIcon } from '@/components/ui/whatsapp-icon';

interface QuickWhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  phone: string | null | undefined;
  vars?: TemplateVars;
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


  // Reset on open + pre-select first template
  useEffect(() => {
    if (!open) return;
    setEditing(false);
    if (templates.length > 0) {
      const first = templates[0];
      setSelectedId(first.id);
      setMessage(resolveTemplate(first.content, vars));
    } else {
      setSelectedId('custom');
      setMessage('');
    }
  }, [open, templates.length]);

  function handleSelect(id: string) {
    setSelectedId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setMessage(resolveTemplate(tpl.content, vars));
    setEditing(false);
  }

  function handleSelectCustom() {
    setSelectedId('custom');
    setMessage('');
    setEditing(true);
  }

  const cleaned = phone ? phone.replace(/\D/g, '') : '';
  const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
  const waUrl = phone && message.trim()
    ? `https://wa.me/${number}?text=${encodeURIComponent(message.trim())}`
    : undefined;

  function handleSend() {
    if (!waUrl) return;
    onClose();
  }

  const getCatInfo = (cat: string) =>
    TEMPLATE_CATEGORIES.find(c => c.id === cat) ?? { label: cat, emoji: '💬' };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="max-w-md w-full p-0 gap-0 flex flex-col"
        style={{ maxHeight: '88vh' }}
      >
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
            Enviar WhatsApp
            {patientName && (
              <span className="text-muted-foreground font-normal text-sm">— {patientName}</span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => seedDefaults()}>
                  <Sparkles className="w-3.5 h-3.5" /> Carregar exemplos
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
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
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-base">{cat.emoji}</span>
                        <span className="font-medium text-sm text-foreground">{t.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground ml-auto">{cat.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 pl-6 leading-relaxed">
                        {resolved}
                      </p>
                    </button>
                  );
                })}

                {/* Free text option */}
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
              className="min-h-[100px] text-sm resize-none"
              readOnly={selectedId !== 'custom' && !editing}
              onClick={() => { if (selectedId !== 'custom' && !editing) setEditing(true); }}
            />
            <p className="text-[10px] text-muted-foreground mt-1">{message.length} caracteres</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border shrink-0 flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <button
            type="button"
            disabled={!waUrl}
            onClick={handleSend}
            className={cn(
              'inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-md text-white transition-opacity',
              waUrl ? 'hover:opacity-90 cursor-pointer' : 'opacity-40 cursor-not-allowed'
            )}
            style={{ backgroundColor: '#25D366' }}
          >
            <Send className="w-3.5 h-3.5" />
            Abrir no WhatsApp
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
