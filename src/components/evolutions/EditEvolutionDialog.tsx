import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { FileUpload, UploadedFile } from '@/components/ui/file-upload';
import { Evolution, Attachment } from '@/types';
import { Image, PenLine, Save } from 'lucide-react';

interface EditEvolutionDialogProps {
  evolution: Evolution;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updates: Partial<Evolution>) => void;
}

export function EditEvolutionDialog({ evolution, open, onOpenChange, onSave }: EditEvolutionDialogProps) {
  const [text, setText] = useState(evolution.text);
  const [date, setDate] = useState(evolution.date);
  const [attendanceStatus, setAttendanceStatus] = useState<'presente' | 'falta'>(evolution.attendanceStatus);
  
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>(
    evolution.attachments?.map(att => ({
      id: att.id,
      name: att.name,
      filePath: att.data,
      fileType: att.type,
    })) || []
  );

  const handleSave = () => {
    onSave({
      text,
      date,
      attendanceStatus,
      attachments: attachedFiles.map(f => ({
        id: f.id,
        parentId: evolution.id,
        parentType: 'evolution' as const,
        name: f.name,
        data: f.filePath,
        type: f.fileType,
        createdAt: new Date().toISOString(),
      })),
    });
    onOpenChange(false);
  };

  const handleFileUpload = (files: UploadedFile[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
  };

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="w-5 h-5 text-primary" />
            Editar Evolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Presença</Label>
              <Select value={attendanceStatus} onValueChange={(v) => setAttendanceStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="presente">✅ Presente</SelectItem>
                  <SelectItem value="falta">❌ Falta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Evolução</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Digite a evolução do paciente..."
              className="min-h-32"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Image className="w-4 h-4" />
              Anexos
            </Label>
            <FileUpload
              parentType="evolution"
              parentId={evolution.id}
              existingFiles={attachedFiles}
              onUpload={handleFileUpload}
              onRemove={handleRemoveFile}
              maxFiles={5}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Salvar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
