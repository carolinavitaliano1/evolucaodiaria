import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Pencil, Trash2, MessageSquare, Sparkles, Copy, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMessageTemplates,
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  MessageTemplate,
} from '@/hooks/useMessageTemplates';
import { toast } from 'sonner';

export function MessageTemplatesManager() {
  const { templates, loading, createTemplate, updateTemplate, deleteTemplate, seedDefaults } = useMessageTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState('geral');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setName('');
    setCategory('geral');
    setContent('');
    setDialogOpen(true);
  }

  function openEdit(t: MessageTemplate) {
    setEditing(t);
    setName(t.name);
    setCategory(t.category);
    setContent(t.content);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !content.trim()) return;
    setSaving(true);
    if (editing) {
      await updateTemplate(editing.id, { name: name.trim(), category, content: content.trim() });
    } else {
      await createTemplate({ name: name.trim(), category, content: content.trim() });
    }
    setSaving(false);
    setDialogOpen(false);
  }

  function insertVar(tag: string) {
    setContent(prev => prev + tag);
  }

  const getCatInfo = (cat: string) =>
    TEMPLATE_CATEGORIES.find(c => c.id === cat) ?? { label: cat, emoji: '💬' };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Modelos de Mensagem WhatsApp
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Crie mensagens com variáveis dinâmicas preenchidas automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={seedDefaults}>
              <Sparkles className="w-3.5 h-3.5" />
              Usar exemplos
            </Button>
          )}
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            Novo modelo
          </Button>
        </div>
      </div>

      {/* Variables legend */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" /> Variáveis disponíveis
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map(v => (
            <span key={v.tag} className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {v.tag} <span className="text-muted-foreground font-sans">— {v.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Templates list */}
      {templates.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Nenhum modelo criado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo modelo" para começar.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const cat = getCatInfo(t.category);
            return (
              <div key={t.id} className="rounded-xl border border-border bg-card p-4 flex gap-3">
                <div className="text-2xl shrink-0 pt-0.5">{cat.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm text-foreground">{t.name}</span>
                    <Badge variant="secondary" className="text-[10px] py-0 h-4">{cat.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-3 font-mono">
                    {t.content}
                  </p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => {
                      navigator.clipboard.writeText(t.content);
                      toast.success('Conteúdo copiado!');
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              {editing ? 'Editar Modelo' : 'Novo Modelo de Mensagem'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Nome do modelo</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lembrete de consulta" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.emoji} {c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Conteúdo da mensagem</Label>
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Olá, {{nome_paciente}}! Sua consulta está agendada para {{data_consulta}} às {{horario}}."
                className="min-h-[120px] font-mono text-sm resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Clique para inserir variável no cursor
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.tag}
                    onClick={() => insertVar(v.tag)}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors font-mono"
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {content.includes('{{') && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pré-visualização (com dados de exemplo)</p>
                <p className="text-xs text-foreground leading-relaxed whitespace-pre-line">
                  {content
                    .replace(/\{\{nome_paciente\}\}/g, 'Maria Silva')
                    .replace(/\{\{data_consulta\}\}/g, '12/03/2025')
                    .replace(/\{\{horario\}\}/g, '14:00')
                    .replace(/\{\{nome_terapeuta\}\}/g, 'Dr. João')}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim() || !content.trim()} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                {editing ? 'Salvar alterações' : 'Criar modelo'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir modelo?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteTemplate(deleteId); setDeleteId(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
