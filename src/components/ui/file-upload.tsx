import { useState, useRef, useCallback } from 'react';
import { Upload, X, Image, Video, FileText, Loader2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface FileUploadProps {
  onUpload: (files: UploadedFile[]) => void;
  existingFiles?: UploadedFile[];
  onRemove?: (fileId: string) => void;
  parentId?: string;
  parentType: string;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  label?: string;
  compact?: boolean;
}

export interface UploadedFile {
  id: string;
  name: string;
  filePath: string;
  fileType: string;
  fileSize?: number;
  url?: string;
}

export function FileUpload({
  onUpload,
  existingFiles = [],
  onRemove,
  parentId,
  parentType,
  accept = 'image/*,video/*,application/pdf',
  multiple = true,
  maxFiles = 5,
  label,
  compact = false,
}: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return;

    const filesToUpload = Array.from(files).slice(0, maxFiles - existingFiles.length);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const uploadedFiles: UploadedFile[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${parentType}/${parentId || 'temp'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Upload error:', error);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from('attachments')
          .getPublicUrl(data.path);

        uploadedFiles.push({
          id: `temp_${Date.now()}_${i}`,
          name: file.name,
          filePath: data.path,
          fileType: file.type,
          fileSize: file.size,
          url: urlData.publicUrl,
        });

        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      if (uploadedFiles.length > 0) {
        onUpload(uploadedFiles);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  }, [parentId, parentType, existingFiles.length, maxFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (fileType.startsWith('video/')) return <Video className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const canAddMore = existingFiles.length < maxFiles;

  if (compact) {
    return (
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="flex flex-wrap gap-2">
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="relative group flex items-center gap-2 px-2 py-1 rounded-lg bg-secondary text-sm"
            >
              {getFileIcon(file.fileType)}
              <span className="max-w-[100px] truncate">{file.name}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          
          {canAddMore && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
              className="gap-1"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              Anexar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />

      {canAddMore && (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer',
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            isUploading && 'pointer-events-none opacity-50'
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Enviando... {Math.round(uploadProgress)}%
                </p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Arraste arquivos ou clique para selecionar
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Imagens, vídeos ou PDFs (máx. {maxFiles} arquivos)
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {existingFiles.map((file) => (
            <div
              key={file.id}
              className="relative group rounded-xl overflow-hidden bg-secondary border border-border"
            >
              {file.fileType.startsWith('image/') && file.url ? (
                <img
                  src={file.url}
                  alt={file.name}
                  className="w-full h-24 object-cover"
                />
              ) : file.fileType.startsWith('video/') && file.url ? (
                <video
                  src={file.url}
                  className="w-full h-24 object-cover"
                />
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-muted">
                  {getFileIcon(file.fileType)}
                </div>
              )}
              
              <div className="p-2">
                <p className="text-xs truncate text-foreground">{file.name}</p>
              </div>

              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(file.id)}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
