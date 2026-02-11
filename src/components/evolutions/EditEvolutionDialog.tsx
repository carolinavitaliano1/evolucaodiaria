import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Evolution, Attachment } from '@/types';
import { Image, PenLine, Save, Wand2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [text, setText] = useState(evolution.text);
  const [date, setDate] = useState(evolution.date);
  const [attendanceStatus, setAttendanceStatus] = useState<'presente' | 'falta' | 'falta_remunerada'>(evolution.attendanceStatus);
  const [mood, setMood] = useState<string>(evolution.mood || '');
  const [isImprovingText, setIsImprovingText] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>(
    evolution.attachments?.map(att => ({
      id: att.id, name: att.name, filePath: att.data, fileType: att.type,
    })) || []
  );

  const handleSave = () => {
    onSave({
      text, date, attendanceStatus,
      mood: (mood || undefined) as Evolution['mood'],
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
                setIsImprovingText(true);
                try {
                  const { data, error } = await supabase.functions.invoke('improve-evolution', {
                    body: { text },
                  });
                  if (error) throw error;
                  if (data?.improved) {
                    setText(data.improved);
                    toast.success('Texto melhorado com IA!');
                  }
                } catch (e) {
                  toast.error('Erro ao melhorar texto');
                } finally {
                  setIsImprovingText(false);
                }
              }}
            >
              {isImprovingText ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              Melhorar com IA
            </Button>
          </div>

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
