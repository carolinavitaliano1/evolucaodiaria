import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';

interface ClinicNote {
  id: string;
  clinic_id: string;
  category: string;
  title?: string | null;
  text: string;
  created_at: string;
}

interface ClinicNotesProps {
  clinicId: string;
}

const DOT_COLORS = [
  { value: 'red',    label: 'Vermelho',  dot: 'bg-red-500',    border: 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20' },
  { value: 'orange', label: 'Laranja',   dot: 'bg-orange-400', border: 'border-orange-200 bg-orange-50 dark:border-orange-900/40 dark:bg-orange-950/20' },
  { value: 'yellow', label: 'Amarelo',   dot: 'bg-yellow-400', border: 'border-yellow-200 bg-yellow-50 dark:border-yellow-900/40 dark:bg-yellow-950/20' },
  { value: 'green',  label: 'Verde',     dot: 'bg-green-500',  border: 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20' },
  { value: 'blue',   label: 'Azul',      dot: 'bg-blue-500',   border: 'border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/20' },
  { value: 'purple', label: 'Roxo',      dot: 'bg-purple-500', border: 'border-purple-200 bg-purple-50 dark:border-purple-900/40 dark:bg-purple-950/20' },
  { value: 'pink',   label: 'Rosa',      dot: 'bg-pink-500',   border: 'border-pink-200 bg-pink-50 dark:border-pink-900/40 dark:bg-pink-950/20' },
  { value: 'gray',   label: 'Cinza',     dot: 'bg-muted-foreground', border: 'border-border bg-muted/30' },
];

// Legacy category mapping
const LEGACY_MAP: Record<string, string> = {
  urgent: 'red',
  protocol: 'yellow',
  general: 'blue',
};

function resolveColor(category: string) {
  const mapped = LEGACY_MAP[category] ?? category;
  return DOT_COLORS.find(c => c.value === mapped) ?? DOT_COLORS[4];
}

export function ClinicNotes({ clinicId }: ClinicNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ClinicNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('blue');
  const [isAdding, setIsAdding] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [noteAttachments, setNoteAttachments] = useState<Record<string, UploadedFile[]>>({});

  useEffect(() => {
    loadNotes();
  }, [clinicId, user]);

  const loadNotes = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('clinic_notes')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setNotes(data as ClinicNote[]);
    setIsLoading(false);
  };

  const handleAdd = async () => {
    if (!user || !newText.trim()) return;
    const { data, error } = await supabase
      .from('clinic_notes')
      .insert({
        user_id: user.id,
        clinic_id: clinicId,
        category: newColor,
        title: newTitle.trim() || null,
        text: newText.trim(),
      })
      .select()
      .single();

    if (error) { toast.error('Erro ao salvar anotação'); return; }
    if (data) setNotes(prev => [data as ClinicNote, ...prev]);
    setNewText(''); setNewTitle(''); setNewColor('blue');
    setIsAdding(false);
    toast.success('Anotação salva!');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('clinic_notes').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.success('Anotação excluída');
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-primary" />
            Anotações da Clínica
          </h3>
          {!isAdding && (
            <Button size="sm" className="gap-1" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4" /> Nova
            </Button>
          )}
        </div>

        {isAdding && (
          <div className="mb-6 p-4 rounded-xl bg-secondary/50 border border-border space-y-3">
            {/* Title */}
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Título (opcional)"
            />

            {/* Color picker */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Cor da bolinha</p>
              <div className="flex flex-wrap gap-2">
                {DOT_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.label}
                    onClick={() => setNewColor(c.value)}
                    className={cn(
                      'w-7 h-7 rounded-full border-2 transition-transform',
                      c.dot,
                      newColor === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                  />
                ))}
              </div>
            </div>

            <Textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Digite sua anotação..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!newText.trim()}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewText(''); setNewTitle(''); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : notes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">📝</div>
            <p className="text-muted-foreground">Nenhuma anotação para esta clínica</p>
            <p className="text-sm text-muted-foreground mt-1">Adicione notas importantes, protocolos ou lembretes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map(note => {
              const col = resolveColor(note.category);
              return (
                <div key={note.id} className={cn('p-4 rounded-xl border', col.border)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', col.dot)} />
                        {note.title && (
                          <span className="text-sm font-semibold text-foreground">{note.title}</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
