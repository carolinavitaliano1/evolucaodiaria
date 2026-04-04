import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, X, Link2, Image, FileText, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActivityAttachment {
  type: 'link' | 'image' | 'document';
  url: string;
  name: string;
}

interface SendActionPlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionPlansText: string;
  onSend: (title: string, dueDate: string, attachments: ActivityAttachment[]) => Promise<void>;
}

export function SendActionPlanModal({ open, onOpenChange, actionPlansText, onSend }: SendActionPlanModalProps) {
  const [title, setTitle] = useState('Plano de Ação');
  const [dueDate, setDueDate] = useState('');
  const [attachments, setAttachments] = useState<ActivityAttachment[]>([]);
  const [newAttachmentType, setNewAttachmentType] = useState<'link' | 'image' | 'document' | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [sending, setSending] = useState(false);

  const addAttachment = () => {
    if (!newUrl.trim() || !newAttachmentType) return;
    setAttachments(prev => [...prev, {
      type: newAttachmentType,
      url: newUrl.trim(),
      name: newName.trim() || newUrl.trim(),
    }]);
    setNewUrl('');
    setNewName('');
    setNewAttachmentType(null);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await onSend(title, dueDate, attachments);
      onOpenChange(false);
      setTitle('Plano de Ação');
      setDueDate('');
      setAttachments([]);
    } finally {
      setSending(false);
    }
  };

  const lines = actionPlansText.split('\n').map(l => l.replace(/^[\s\-\*\d\.]+/, '').trim()).filter(Boolean);

  const attachTypeIcon = (type: string) => {
    if (type === 'link') return <Link2 className="w-3.5 h-3.5" />;
    if (type === 'image') return <Image className="w-3.5 h-3.5" />;
    return <FileText className="w-3.5 h-3.5" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-primary" /> Enviar Plano de Ação para Portal</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Título da atividade</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Plano de Ação" />
          </div>

          <div>
            <Label className="text-xs">Prazo (opcional)</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          {/* Preview items */}
          <div>
            <Label className="text-xs mb-1 block">Itens ({lines.length})</Label>
            <div className="bg-muted/50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
              {lines.map((line, i) => (
                <div key={i} className="text-xs text-foreground flex items-start gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{renderBoldText(line)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-xs mb-1 block">Anexos</Label>
            {attachments.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs">
                    {attachTypeIcon(att.type)}
                    <span className="truncate flex-1 text-foreground">{att.name}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removeAttachment(i)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {newAttachmentType ? (
              <div className="border border-border rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {attachTypeIcon(newAttachmentType)}
                  {newAttachmentType === 'link' ? 'Adicionar Link' : newAttachmentType === 'image' ? 'Adicionar Imagem (URL)' : 'Adicionar Documento (URL)'}
                </div>
                <Input placeholder="Cole a URL aqui" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="text-xs" />
                <Input placeholder="Nome (opcional)" value={newName} onChange={e => setNewName(e.target.value)} className="text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" variant="default" className="text-xs" onClick={addAttachment} disabled={!newUrl.trim()}>Adicionar</Button>
                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setNewAttachmentType(null); setNewUrl(''); setNewName(''); }}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setNewAttachmentType('link')}>
                  <Link2 className="w-3.5 h-3.5" /> Link
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setNewAttachmentType('image')}>
                  <Image className="w-3.5 h-3.5" /> Imagem
                </Button>
                <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => setNewAttachmentType('document')}>
                  <FileText className="w-3.5 h-3.5" /> Documento
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || lines.length === 0} className="gap-1.5">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper to render **bold** markdown inline
export function renderBoldText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
