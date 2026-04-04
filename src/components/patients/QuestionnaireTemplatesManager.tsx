import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Save, X, GripVertical, FileUp, Sparkles, Copy, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QuestionnaireField {
  id: string;
  question: string;
  field_type: 'text' | 'textarea' | 'select' | 'yesno' | 'number';
  options: string[];
  required: boolean;
}

export interface QuestionnaireTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  fields: QuestionnaireField[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Múltipla escolha' },
  { value: 'yesno', label: 'Sim / Não' },
  { value: 'number', label: 'Número' },
];

function generateId() {
  return crypto.randomUUID();
}

function emptyField(): QuestionnaireField {
  return { id: generateId(), question: '', field_type: 'text', options: [], required: false };
}

interface Props {
  onClose?: () => void;
  onSendToPatient?: (template: QuestionnaireTemplate) => void;
}

export function QuestionnaireTemplatesManager({ onClose, onSendToPatient }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<QuestionnaireTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuestionnaireTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [digitizing, setDigitizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFields, setFormFields] = useState<QuestionnaireField[]>([emptyField()]);

  const loadTemplates = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('questionnaire_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setTemplates((data || []) as unknown as QuestionnaireTemplate[]);
    setLoading(false);
  };

  useEffect(() => { loadTemplates(); }, [user]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormFields([emptyField()]);
    setEditing(null);
    setCreating(false);
  };

  const startEdit = (t: QuestionnaireTemplate) => {
    setFormName(t.name);
    setFormDescription(t.description || '');
    setFormFields(t.fields.length > 0 ? t.fields : [emptyField()]);
    setEditing(t);
    setCreating(true);
  };

  const startDuplicate = (t: QuestionnaireTemplate) => {
    setFormName(`${t.name} (cópia)`);
    setFormDescription(t.description || '');
    setFormFields(t.fields.map(f => ({ ...f, id: generateId() })));
    setEditing(null);
    setCreating(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('Dê um nome ao template'); return; }
    if (formFields.every(f => !f.question.trim())) { toast.error('Adicione pelo menos uma pergunta'); return; }
    const cleanFields = formFields.filter(f => f.question.trim());

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('questionnaire_templates')
          .update({ name: formName.trim(), description: formDescription.trim() || null, fields: cleanFields as any })
          .eq('id', editing.id);
        if (error) throw error;
        toast.success('Template atualizado!');
      } else {
        const { error } = await supabase
          .from('questionnaire_templates')
          .insert({ user_id: user!.id, name: formName.trim(), description: formDescription.trim() || null, fields: cleanFields as any });
        if (error) throw error;
        toast.success('Template criado!');
      }
      resetForm();
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('questionnaire_templates').delete().eq('id', id);
    if (!error) { toast.success('Template removido'); loadTemplates(); }
    else toast.error('Erro ao remover');
  };

  const updateField = (idx: number, updates: Partial<QuestionnaireField>) => {
    setFormFields(prev => prev.map((f, i) => i === idx ? { ...f, ...updates } : f));
  };

  const addField = () => setFormFields(prev => [...prev, emptyField()]);
  const removeField = (idx: number) => setFormFields(prev => prev.filter((_, i) => i !== idx));

  const handleDigitize = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('Máximo 10MB'); return; }

    setDigitizing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('digitize-questionnaire', {
        body: { file_base64: base64, file_type: file.type, file_name: file.name },
      });
      if (error) throw error;
      if (data?.fields && Array.isArray(data.fields)) {
        const newFields: QuestionnaireField[] = data.fields.map((f: any) => ({
          id: generateId(),
          question: f.question || f.title || '',
          field_type: f.field_type || 'text',
          options: f.options || [],
          required: f.required || false,
        }));
        setFormFields(newFields.length > 0 ? newFields : [emptyField()]);
        setFormName(data.title || file.name.replace(/\.[^.]+$/, ''));
        setFormDescription(data.description || '');
        setCreating(true);
        toast.success(`${newFields.length} perguntas extraídas! Revise antes de salvar.`);
      } else {
        toast.error('Não foi possível extrair perguntas do arquivo');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao digitalizar');
    } finally {
      setDigitizing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  // Editor view
  if (creating) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{editing ? 'Editar Template' : 'Novo Template de Questionário'}</h3>
          <Button size="sm" variant="ghost" onClick={resetForm}><X className="w-4 h-4" /></Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome do template *</Label>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Anamnese Infantil, Escala de Ansiedade" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Breve descrição do questionário" className="mt-1" />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Perguntas</Label>
            <Button size="sm" variant="outline" onClick={addField} className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Pergunta
            </Button>
          </div>

          {formFields.map((field, idx) => (
            <div key={field.id} className="rounded-lg border border-border p-3 space-y-2 bg-muted/10">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Input
                    value={field.question}
                    onChange={e => updateField(idx, { question: e.target.value })}
                    placeholder={`Pergunta ${idx + 1}`}
                    className="text-sm"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={field.field_type} onValueChange={v => updateField(idx, { field_type: v as any })}>
                      <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FIELD_TYPES.map(ft => <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Switch checked={field.required} onCheckedChange={v => updateField(idx, { required: v })} className="scale-75" />
                      Obrigatória
                    </label>
                  </div>
                  {field.field_type === 'select' && (
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Opções (separadas por vírgula)</Label>
                      <Input
                        value={field.options.join(', ')}
                        onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="Opção 1, Opção 2, Opção 3"
                        className="text-xs h-7"
                      />
                    </div>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => removeField(idx)} disabled={formFields.length <= 1}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1 gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editing ? 'Salvar alterações' : 'Criar template'}
          </Button>
          <Button variant="outline" onClick={resetForm}>Cancelar</Button>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Templates de Questionários</h3>
        {onClose && <Button size="sm" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => setCreating(true)} className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Novo template
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleDigitize} />
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={digitizing} className="gap-1.5 text-xs">
          {digitizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {digitizing ? 'Digitalizando...' : 'Importar de arquivo (IA)'}
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-8">
          <FileUp className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum template criado ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Crie templates reutilizáveis para enviar a seus pacientes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="rounded-xl border border-border p-3 bg-card hover:bg-muted/20 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] h-5">{t.fields.length} {t.fields.length === 1 ? 'pergunta' : 'perguntas'}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onSendToPatient && (
                    <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={() => onSendToPatient(t)}>
                      Enviar
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(t)} title="Editar">
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startDuplicate(t)} title="Duplicar">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(t.id)} title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
