import { useState, useEffect } from 'react';
import { StickyNote, Plus, Trash2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ClinicNote {
  id: string;
  clinic_id: string;
  category: string;
  text: string;
  created_at: string;
}

interface ClinicNotesProps {
  clinicId: string;
}

const CATEGORIES = [
  { value: 'urgent', label: '🔴 Urgente', color: 'border-destructive/50 bg-destructive/5' },
  { value: 'protocol', label: '🟡 Protocolo', color: 'border-warning/50 bg-warning/5' },
  { value: 'general', label: '🔵 Geral', color: 'border-primary/50 bg-primary/5' },
];

export function ClinicNotes({ clinicId }: ClinicNotesProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ClinicNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newText, setNewText] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [clinicId, user]);

  const loadNotes = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('clinic_notes')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) setNotes(data);
    setIsLoading(false);
  };

  const handleAdd = async () => {
    if (!user || !newText.trim()) return;

    const { data, error } = await supabase
      .from('clinic_notes')
      .insert({
        user_id: user.id,
        clinic_id: clinicId,
        category: newCategory,
        text: newText.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error('Erro ao salvar anotação');
      return;
    }

    if (data) setNotes(prev => [data, ...prev]);
    setNewText('');
    setNewCategory('general');
    setIsAdding(false);
    toast.success('Anotação salva!');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('clinic_notes').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
      return;
    }
    setNotes(prev => prev.filter(n => n.id !== id));
    toast.success('Anotação excluída');
  };

  const getCategoryStyle = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[2];
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
            <Select value={newCategory} onValueChange={setNewCategory}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Digite sua anotação..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!newText.trim()}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => { setIsAdding(false); setNewText(''); }}>Cancelar</Button>
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
              const cat = getCategoryStyle(note.category);
              return (
                <div
                  key={note.id}
                  className={cn("p-4 rounded-xl border", cat.color)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium">{cat.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(note.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.text}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8" onClick={() => handleDelete(note.id)}>
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
