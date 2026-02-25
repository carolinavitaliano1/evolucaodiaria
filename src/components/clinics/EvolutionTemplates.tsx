import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { EvolutionTemplate, TemplateField } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, GripVertical, FileText, X, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  clinicId: string;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto curto',
  textarea: 'Texto longo',
  select: 'Seleção',
  checkbox: 'Checkbox',
  number: 'Numérico',
};

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function EvolutionTemplates({ clinicId }: Props) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<EvolutionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EvolutionTemplate | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<TemplateField[]>([]);

  useEffect(() => {
    loadTemplates();
  }, [clinicId]);

  const loadTemplates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('evolution_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setTemplates((data || []).map((t: any) => ({
        id: t.id,
        clinicId: t.clinic_id,
        name: t.name,
        description: t.description,
        fields: (t.fields as TemplateField[]) || [],
        isActive: t.is_active,
        createdAt: t.created_at,
      })));
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setFields([]);
    setDialogOpen(true);
  };

  const openEdit = (t: EvolutionTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description || '');
    setFields([...t.fields]);
    setDialogOpen(true);
  };

  const addField = () => {
    setFields([...fields, { id: generateId(), label: '', type: 'text', required: false }]);
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    const next = [...fields];
    next[index] = { ...next[index], ...updates };
    setFields(next);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome do modelo é obrigatório');
      return;
    }
    if (fields.length === 0) {
      toast.error('Adicione pelo menos um campo ao modelo');
      return;
    }
    const invalidFields = fields.filter(f => !f.label.trim());
    if (invalidFields.length > 0) {
      toast.error('Todos os campos precisam de um nome');
      return;
    }

    const payload = {
      user_id: user!.id,
      clinic_id: clinicId,
      name: name.trim(),
      description: description.trim() || null,
      fields: fields as any,
      is_active: true,
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from('evolution_templates')
        .update(payload)
        .eq('id', editingTemplate.id);
      if (error) {
        toast.error('Erro ao atualizar modelo');
        console.error(error);
      } else {
        toast.success('Modelo atualizado!');
      }
    } else {
      const { error } = await supabase
        .from('evolution_templates')
        .insert(payload);
      if (error) {
        toast.error('Erro ao criar modelo');
        console.error(error);
      } else {
        toast.success('Modelo criado!');
      }
    }

    setDialogOpen(false);
    loadTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este modelo?')) return;
    const { error } = await supabase.from('evolution_templates').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Modelo excluído');
      loadTemplates();
    }
  };

  const handleToggleActive = async (t: EvolutionTemplate) => {
    const { error } = await supabase
      .from('evolution_templates')
      .update({ is_active: !t.isActive })
      .eq('id', t.id);
    if (error) {
      toast.error('Erro ao atualizar');
    } else {
      loadTemplates();
    }
  };

  const handleDuplicate = async (t: EvolutionTemplate) => {
    const { error } = await supabase.from('evolution_templates').insert({
      user_id: user!.id,
      clinic_id: clinicId,
      name: `${t.name} (cópia)`,
      description: t.description,
      fields: t.fields as any,
      is_active: true,
    });
    if (error) {
      toast.error('Erro ao duplicar');
    } else {
      toast.success('Modelo duplicado!');
      loadTemplates();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Modelos de Evolução</h3>
          <p className="text-sm text-muted-foreground">Crie formulários estruturados para padronizar evoluções</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Modelo
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm py-8 text-center">Carregando...</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum modelo criado</p>
          <p className="text-sm text-muted-foreground">Crie modelos para padronizar as evoluções dos pacientes</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => (
            <Card key={t.id} className={cn("transition-opacity", !t.isActive && "opacity-60")}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground truncate">{t.name}</h4>
                    {!t.isActive && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                  {t.description && <p className="text-sm text-muted-foreground truncate">{t.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {t.fields.slice(0, 5).map(f => (
                      <Badge key={f.id} variant="outline" className="text-xs">
                        {f.label}
                      </Badge>
                    ))}
                    {t.fields.length > 5 && (
                      <Badge variant="outline" className="text-xs">+{t.fields.length - 5}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={t.isActive} onCheckedChange={() => handleToggleActive(t)} />
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)}>
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)} className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Editar Modelo' : 'Novo Modelo de Evolução'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Modelo *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Avaliação Fisioterapêutica" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva quando usar este modelo..." rows={2} />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Campos do Formulário</Label>
                <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1">
                  <Plus className="w-3 h-3" />
                  Campo
                </Button>
              </div>

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Adicione campos para montar o formulário do modelo
                </p>
              )}

              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="border rounded-lg p-3 bg-secondary/30 space-y-3">
                    <div className="flex items-start gap-2">
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0" />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Nome do campo *</Label>
                          <Input
                            value={field.label}
                            onChange={e => updateField(idx, { label: e.target.value })}
                            placeholder="Ex: Queixa principal"
                            className="h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select value={field.type} onValueChange={v => updateField(idx, { type: v as TemplateField['type'], options: v === 'select' ? [''] : undefined })}>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(FIELD_TYPE_LABELS).map(([k, v]) => (
                                <SelectItem key={k} value={k}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-8 w-8 text-destructive" onClick={() => removeField(idx)}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <div className="ml-6 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={field.required || false}
                          onCheckedChange={v => updateField(idx, { required: v })}
                          className="scale-75"
                        />
                        <span className="text-xs text-muted-foreground">Obrigatório</span>
                      </div>
                      <div className="flex-1">
                        <Input
                          value={field.placeholder || ''}
                          onChange={e => updateField(idx, { placeholder: e.target.value })}
                          placeholder="Placeholder (opcional)"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    {field.type === 'select' && (
                      <div className="ml-6 space-y-1">
                        <Label className="text-xs">Opções de seleção</Label>
                        {(field.options || ['']).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-1">
                            <Input
                              value={opt}
                              onChange={e => {
                                const newOpts = [...(field.options || [''])];
                                newOpts[optIdx] = e.target.value;
                                updateField(idx, { options: newOpts });
                              }}
                              placeholder={`Opção ${optIdx + 1}`}
                              className="h-7 text-xs"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                const newOpts = (field.options || ['']).filter((_, i) => i !== optIdx);
                                updateField(idx, { options: newOpts.length ? newOpts : [''] });
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-6"
                          onClick={() => updateField(idx, { options: [...(field.options || ['']), ''] })}
                        >
                          + Opção
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>{editingTemplate ? 'Salvar' : 'Criar Modelo'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
