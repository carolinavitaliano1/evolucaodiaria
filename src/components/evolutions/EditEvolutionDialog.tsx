import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Evolution, Attachment, EvolutionTemplate, TemplateField } from '@/types';
import { Image, PenLine, Save, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import TemplateForm from './TemplateForm';

const MOOD_OPTIONS = [
  { value: 'otima', emoji: '😄', label: 'Ótima' },
  { value: 'boa', emoji: '😊', label: 'Boa' },
  { value: 'neutra', emoji: '😐', label: 'Neutra' },
  { value: 'ruim', emoji: '😟', label: 'Ruim' },
  { value: 'muito_ruim', emoji: '😢', label: 'Muito ruim' },
] as const;

interface EditEvolutionDialogProps {
  evolution: Evolution;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Evolution>) => void;
  showFaltaRemunerada?: boolean;
}

export function EditEvolutionDialog({ evolution, open, onOpenChange, onSave, showFaltaRemunerada = true }: EditEvolutionDialogProps) {
  const { user } = useAuth();
  const [text, setText] = useState(evolution.text);
  const [date, setDate] = useState(evolution.date);
  const [attendanceStatus, setAttendanceStatus] = useState(evolution.attendanceStatus);
  const [mood, setMood] = useState<string>(evolution.mood || '');
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>(
    evolution.attachments?.map(att => ({
      id: att.id, name: att.name, filePath: att.data, fileType: att.type,
      url: att.data.startsWith('http') ? att.data : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/attachments/${att.data}`,
    })) || []
  );

  // Template state
  const [clinicTemplates, setClinicTemplates] = useState<EvolutionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(evolution.templateId || '');
  const [templateFormValues, setTemplateFormValues] = useState<Record<string, any>>(evolution.templateData || {});

  // Load templates for the clinic
  useEffect(() => {
    if (!user || !evolution.clinicId || !open) return;
    supabase.from('evolution_templates').select('*')
      .eq('clinic_id', evolution.clinicId)
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        if (data) {
          setClinicTemplates(data.map(t => ({
            id: t.id, clinicId: t.clinic_id, name: t.name,
            description: t.description || undefined,
            fields: (t.fields as any as TemplateField[]) || [],
            isActive: t.is_active ?? true,
            createdAt: t.created_at, updatedAt: t.updated_at,
          })));
        }
      });
  }, [user, evolution.clinicId, open]);

  const handleImproveText = async (textToImprove: string): Promise<string> => {
    setIsImprovingText(true);
    try {
      const { data, error } = await supabase.functions.invoke('improve-evolution', {
        body: { text: textToImprove },
      });
      if (error) throw error;
      return data?.improved || textToImprove;
    } catch (e) {
      toast.error('Erro ao melhorar texto');
      return textToImprove;
    } finally {
      setIsImprovingText(false);
    }
  };

  const handleSave = () => {
    const selectedTemplate = clinicTemplates.find(t => t.id === selectedTemplateId);
    let finalText = text;

    // If template is selected, rebuild text from template values
    if (selectedTemplate && Object.keys(templateFormValues).length > 0) {
      const templateLines = selectedTemplate.fields
        .map(f => {
          const val = templateFormValues[f.id];
          if (val === undefined || val === '' || val === false) return null;
          if (f.type === 'checkbox' && val === true) return `✅ ${f.label}`;
          return `${f.label}: ${val}`;
        })
        .filter(Boolean);
      if (templateLines.length > 0) {
        const templateSection = templateLines.join('\n');
        finalText = finalText ? `${templateSection}\n\n---\n\n${finalText}` : templateSection;
      }
    }

    onSave({
      text: finalText, date, attendanceStatus,
      mood: (mood || undefined) as Evolution['mood'],
      templateId: selectedTemplateId || undefined,
      templateData: Object.keys(templateFormValues).length > 0 ? templateFormValues : undefined,
      attachments: attachedFiles.map(f => ({
        id: f.id, parentId: evolution.id, parentType: 'evolution' as const,
        name: f.name, data: f.filePath, type: f.fileType, createdAt: new Date().toISOString(),
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" /> Editar Evolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Presença</Label>
              <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">✅ Presente</SelectItem>
                  <SelectItem value="falta">❌ Falta</SelectItem>
                  {showFaltaRemunerada && (
                    <SelectItem value="falta_remunerada">💰 Falta Remunerada</SelectItem>
                  )}
                  <SelectItem value="reposicao">🔄 Reposição</SelectItem>
                  <SelectItem value="feriado_remunerado">🎉 Feriado Remunerado</SelectItem>
                  <SelectItem value="feriado_nao_remunerado">📅 Feriado Não Remunerado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Humor da Sessão</Label>
            <div className="flex gap-1 mt-1">
              {MOOD_OPTIONS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(mood === m.value ? '' : m.value)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 p-2 rounded-lg border-2 transition-all text-center",
                    mood === m.value
                      ? "border-primary bg-primary/10"
                      : "border-transparent bg-secondary hover:bg-secondary/80"
                  )}
                  title={m.label}
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Template selector */}
          {clinicTemplates.length > 0 && (
            <div>
              <Label className="flex items-center gap-2 mb-1">📋 Modelo de Evolução</Label>
              <Select value={selectedTemplateId || 'none'} onValueChange={(v) => {
                setSelectedTemplateId(v === 'none' ? '' : v);
                if (v === 'none' || !v) setTemplateFormValues({});
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um modelo (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem modelo</SelectItem>
                  {clinicTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template form */}
          {selectedTemplateId && clinicTemplates.find(t => t.id === selectedTemplateId) && (
            <TemplateForm
              template={clinicTemplates.find(t => t.id === selectedTemplateId)!}
              values={templateFormValues}
              onChange={setTemplateFormValues}
              showAiImprove
              isImprovingText={isImprovingText}
              onImproveText={handleImproveText}
            />
          )}

          {/* Free text only when no template */}
          {!selectedTemplateId && (
            <div>
              <Label>Evolução</Label>
              <Textarea value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Digite a evolução do paciente..." className="min-h-32" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-2"
                disabled={!text.trim() || isImprovingText}
                onClick={async () => {
                  const improved = await handleImproveText(text);
                  if (improved !== text) {
                    setText(improved);
                    toast.success('Texto melhorado com IA!');
                  }
                }}
              >
                {isImprovingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Melhorar com IA
              </Button>
            </div>
          )}

          <div>
            <Label className="flex items-center gap-2 mb-2"><Image className="w-4 h-4" /> Anexos</Label>
            <FileUpload
              parentType="evolution" parentId={evolution.id}
              existingFiles={attachedFiles}
              onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])}
              onRemove={(fileId) => setAttachedFiles(prev => prev.filter(f => f.id !== fileId))}
              maxFiles={5}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Salvar Alterações</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
