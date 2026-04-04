import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { toast } from 'sonner';
import { Save, Plus, X, Link as LinkIcon, Upload, Target, ListChecks } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SessionPlanFormProps {
  patientId: string;
  clinicId: string;
  editingPlan?: any;
  onSaved: () => void;
  onCancel: () => void;
}

export function SessionPlanForm({ patientId, clinicId, editingPlan, onSaved, onCancel }: SessionPlanFormProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState(editingPlan?.title || '');
  const [objectives, setObjectives] = useState(editingPlan?.objectives || '');
  const [activities, setActivities] = useState(editingPlan?.activities || '');
  const [links, setLinks] = useState<{ label: string; url: string }[]>(
    editingPlan?.external_links || []
  );
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);

  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    setLinks(prev => [...prev, { label: newLinkLabel.trim() || newLinkUrl.trim(), url: newLinkUrl.trim() }]);
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user || !title.trim()) {
      toast.error('Informe o título do plano');
      return;
    }
    setSaving(true);

    const payload = {
      user_id: user.id,
      patient_id: patientId,
      clinic_id: clinicId,
      title: title.trim(),
      objectives,
      activities,
      external_links: links,
      status: 'draft',
    };

    let error;
    if (editingPlan?.id) {
      const res = await supabase.from('session_plans').update(payload).eq('id', editingPlan.id);
      error = res.error;
    } else {
      const res = await supabase.from('session_plans').insert(payload);
      error = res.error;
    }

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar plano');
    } else {
      toast.success('Plano salvo!');
      onSaved();
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {editingPlan ? 'Editar Plano' : 'Novo Plano de Sessão'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Título do Plano *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Trabalhar ansiedade social"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Target className="w-3 h-3" /> Objetivos Terapêuticos
            </Label>
            <Textarea
              value={objectives}
              onChange={e => setObjectives(e.target.value)}
              placeholder="Descreva os objetivos terapêuticos para esta sessão..."
              className="min-h-[100px] resize-y"
            />
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1">
              <ListChecks className="w-3 h-3" /> Descrição das Atividades
            </Label>
            <Textarea
              value={activities}
              onChange={e => setActivities(e.target.value)}
              placeholder="Descreva as atividades planejadas, técnicas, exercícios..."
              className="min-h-[100px] resize-y"
            />
          </div>
        </CardContent>
      </Card>

      {/* Attachments */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" /> Materiais (Anexos)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            existingFiles={attachedFiles}
            onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
            onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
            parentId={editingPlan?.id || 'temp-plan'}
            parentType="session_plan"
            multiple
          />
          <p className="text-xs text-muted-foreground mt-2">
            Envie PDFs, imagens ou vídeos (máx 20MB por arquivo).
          </p>
        </CardContent>
      </Card>

      {/* External Links */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-primary" /> Links Externos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {links.map((link, i) => (
                <Badge key={i} variant="secondary" className="gap-1 max-w-[250px]">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="truncate text-xs hover:underline">
                    {link.label}
                  </a>
                  <X className="w-3 h-3 cursor-pointer shrink-0" onClick={() => removeLink(i)} />
                </Badge>
              ))}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
            <Input
              value={newLinkLabel}
              onChange={e => setNewLinkLabel(e.target.value)}
              placeholder="Nome (opcional)"
              className="h-8 text-xs"
            />
            <Input
              value={newLinkUrl}
              onChange={e => setNewLinkUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addLink()}
              placeholder="https://youtube.com/..."
              className="h-8 text-xs"
            />
            <Button variant="ghost" size="sm" onClick={addLink} className="h-8 gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Plano'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
