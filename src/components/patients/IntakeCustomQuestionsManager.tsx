import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, GripVertical, Loader2, ListOrdered, X } from 'lucide-react';

export interface CustomQuestion {
  id: string;
  user_id: string;
  question: string;
  field_type: 'text' | 'textarea' | 'select' | 'yesno';
  options: string[];
  required: boolean;
  sort_order: number;
  is_active: boolean;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  select: 'Múltipla escolha',
  yesno: 'Sim / Não',
};

interface Props {
  onClose?: () => void;
}

export function IntakeCustomQuestionsManager({ onClose }: Props) {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  // New question form
  const [newQuestion, setNewQuestion] = useState('');
  const [newType, setNewType] = useState<CustomQuestion['field_type']>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState('');
  const [adding, setAdding] = useState(false);

  const fetch = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('intake_custom_questions' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true });
    setQuestions((data || []) as unknown as CustomQuestion[]);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [user]);

  const handleAdd = async () => {
    if (!newQuestion.trim() || !user) return;
    setAdding(true);
    try {
      const opts = newType === 'select'
        ? newOptions.split('\n').map(s => s.trim()).filter(Boolean)
        : [];
      const { error } = await supabase.from('intake_custom_questions' as any).insert({
        user_id: user.id,
        question: newQuestion.trim(),
        field_type: newType,
        options: opts,
        required: newRequired,
        sort_order: questions.length,
        is_active: true,
      });
      if (error) throw error;
      setNewQuestion('');
      setNewType('text');
      setNewRequired(false);
      setNewOptions('');
      toast.success('Pergunta adicionada!');
      await fetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (q: CustomQuestion) => {
    setSaving(q.id);
    await supabase.from('intake_custom_questions' as any)
      .update({ is_active: !q.is_active })
      .eq('id', q.id);
    setQuestions(prev => prev.map(x => x.id === q.id ? { ...x, is_active: !x.is_active } : x));
    setSaving(null);
  };

  const handleDelete = async (id: string) => {
    setSaving(id);
    await supabase.from('intake_custom_questions' as any).delete().eq('id', id);
    setQuestions(prev => prev.filter(x => x.id !== id));
    setSaving(null);
    toast.success('Pergunta removida');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListOrdered className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Perguntas Personalizadas da Ficha</h3>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Essas perguntas aparecerão na ficha cadastral do portal para o paciente preencher.
      </p>

      {/* Existing questions */}
      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground bg-muted/30 rounded-xl border border-dashed border-border">
          Nenhuma pergunta ainda. Adicione abaixo.
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map(q => (
            <div key={q.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${q.is_active ? 'bg-card border-border' : 'bg-muted/20 border-border/50 opacity-60'}`}>
              <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{q.question}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded-md text-muted-foreground">
                    {FIELD_TYPE_LABELS[q.field_type]}
                  </span>
                  {q.required && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-md">
                      Obrigatória
                    </span>
                  )}
                  {q.field_type === 'select' && q.options?.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {q.options.length} opções
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Switch
                  checked={q.is_active}
                  onCheckedChange={() => handleToggleActive(q)}
                  disabled={saving === q.id}
                  className="scale-75"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(q.id)}
                  disabled={saving === q.id}
                >
                  {saving === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add new question */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-xs font-semibold text-foreground">Adicionar nova pergunta</p>
        <div>
          <Label className="text-xs">Pergunta *</Label>
          <Input
            className="mt-1 text-sm"
            placeholder="Ex: Já fez tratamento psicológico antes?"
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Tipo de resposta</Label>
            <Select value={newType} onValueChange={v => setNewType(v as any)}>
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <Switch checked={newRequired} onCheckedChange={setNewRequired} id="req-toggle" />
            <Label htmlFor="req-toggle" className="text-xs cursor-pointer">Obrigatória</Label>
          </div>
        </div>
        {newType === 'select' && (
          <div>
            <Label className="text-xs">Opções (uma por linha)</Label>
            <textarea
              className="mt-1 w-full text-xs border border-input rounded-md bg-background px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder={"Opção 1\nOpção 2\nOpção 3"}
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
            />
          </div>
        )}
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newQuestion.trim() || adding}
          className="gap-1.5 w-full"
        >
          {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
          Adicionar pergunta
        </Button>
      </div>
    </div>
  );
}
