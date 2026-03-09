import { useState, useRef, useCallback, forwardRef } from 'react';
import { Upload, X, Image, Video, FileText, Loader2, Download, ExternalLink } from 'lucide-react';
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

// Compress image before upload using canvas
async function compressImage(file: File, maxWidth = 1200, quality = 0.82): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size < 500 * 1024) return file;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) { resolve(file); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          },
          'image/jpeg',
          quality
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Resolve a public URL from either a full URL or a storage path */
function resolveUrl(filePathOrUrl: string): string {
  if (!filePathOrUrl) return '';
  if (filePathOrUrl.startsWith('http')) return filePathOrUrl;
  const { data } = supabase.storage.from('attachments').getPublicUrl(filePathOrUrl);
  return data.publicUrl;
}

function getFileIcon(fileType: string, size = 'w-4 h-4') {
  if (fileType.startsWith('image/')) return <Image className={size} />;
  if (fileType.startsWith('video/')) return <Video className={size} />;
  return <FileText className={size} />;
}

export const FileUpload = forwardRef<HTMLDivElement, FileUploadProps>(function FileUpload(
  {
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
  },
  ref
) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
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
        const original = filesToUpload[i];
        const file = await compressImage(original);
        const fileExt = file.name.split('.').pop() || 'bin';
        const fileName = `${parentType}/${parentId || 'temp'}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('attachments')
          .upload(fileName, file, { cacheControl: '3600', upsert: false });

        if (error) { console.error('Upload error:', error); continue; }

        const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);

        uploadedFiles.push({
          id: `temp_${Date.now()}_${i}`,
          name: original.name,
          filePath: data.path,
          fileType: original.type,
          fileSize: file.size,
          url: urlData.publicUrl,
        });

        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      if (uploadedFiles.length > 0) onUpload(uploadedFiles);
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
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
  }, [parentId, parentType, existingFiles.length, maxFiles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const canAddMore = existingFiles.length < maxFiles;

  /* ── COMPACT MODE ── */
  if (compact) {
    return (
      <div ref={ref} className="space-y-2">
        <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} className="hidden" />
        <div className="flex flex-wrap gap-2">
          {existingFiles.map((file) => {
            const url = file.url || resolveUrl(file.filePath);
            return (
              <div key={file.id} className="relative group flex items-center gap-2 px-2 py-1 rounded-lg bg-secondary text-sm">
                {getFileIcon(file.fileType)}
                <a href={url} target="_blank" rel="noopener noreferrer" className="max-w-[100px] truncate hover:underline" title={file.name}>
                  {file.name}
                </a>
                {onRemove && (
                  <button type="button" onClick={() => onRemove(file.id)} className="text-destructive hover:text-destructive/80">
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          {canAddMore && (
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isUploading} className="gap-1">
              {isUploading ? <><Loader2 className="w-3 h-3 animate-spin" /><span className="text-xs">{Math.round(uploadProgress)}%</span></> : <Upload className="w-3 h-3" />}
              {isUploading ? 'Enviando...' : 'Anexar'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  /* ── FULL MODE ── */
  return (
    <div ref={ref} className="space-y-3">
      {label && <p className="text-sm font-medium text-foreground">{label}</p>}
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} onChange={handleChange} className="hidden" />

      {canAddMore && (
        <div
          className={cn(
            'relative border-2 border-dashed rounded-xl p-6 transition-colors cursor-pointer',
            dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
            isUploading && 'pointer-events-none opacity-50'
          )}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            {isUploading ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Enviando... {Math.round(uploadProgress)}%</p>
                <div className="w-full max-w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Arraste arquivos ou clique para selecionar</p>
                <p className="text-xs text-muted-foreground/70">Imagens, vídeos ou PDFs (máx. {maxFiles} arquivos)</p>
              </>
            )}
          </div>
        </div>
      )}

      {existingFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {existingFiles.map((file) => {
            const url = file.url || resolveUrl(file.filePath);
            const isImage = file.fileType.startsWith('image/');
            const isVideo = file.fileType.startsWith('video/');

            return (
              <div key={file.id} className="relative group rounded-xl overflow-hidden bg-secondary border border-border hover:border-primary/40 transition-colors">
                {/* Preview area */}
                {isImage && url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    <img src={url} alt={file.name} className="w-full h-28 object-cover cursor-pointer hover:opacity-90 transition-opacity" loading="lazy" />
                  </a>
                ) : isVideo && url ? (
                  <video src={url} className="w-full h-28 object-cover" controls />
                ) : (
                  /* PDF / other: big clickable icon area */
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center w-full h-28 bg-muted hover:bg-muted/80 transition-colors gap-1">
                    <FileText className="w-8 h-8 text-primary" />
                    <span className="text-xs text-muted-foreground">Clique para abrir</span>
                  </a>
                )}

                {/* Footer row */}
                <div className="flex items-center gap-1 p-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                  </div>
                  {/* Download button */}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={file.name}
                    title="Baixar / Abrir"
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0 p-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  {/* Remove button */}
                  {onRemove && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemove(file.id); }}
                      className="flex-shrink-0 p-1 rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                      title="Excluir"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});
