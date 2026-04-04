import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Image, Video, Link, X, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface FeedPostCreatorProps {
  patientId: string;
  therapistId: string;
  therapistName?: string;
  onPostCreated: () => void;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 30 * 1024 * 1024; // 30MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

async function compressImage(file: File): Promise<File> {
  if (file.size <= 500 * 1024) return file; // skip if < 500KB
  return new Promise((resolve) => {
    const img = document.createElement('img');
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 1600;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        else resolve(file);
      }, 'image/jpeg', 0.82);
    };
    img.src = url;
  });
}

function isYoutubeUrl(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function getYoutubeThumb(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
}

export function FeedPostCreator({ patientId, therapistId, therapistName, onPostCreated }: FeedPostCreatorProps) {
  const [content, setContent] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'link' | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
    const isVideo = ACCEPTED_VIDEO_TYPES.includes(file.type);

    if (!isImage && !isVideo) {
      toast.error('Formato não suportado. Use JPG, PNG, WEBP para imagens ou MP4, WebM para vídeos.');
      return;
    }
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      toast.error('O arquivo é muito grande. Por favor, envie fotos com menos de 5MB.', { style: { background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' } });
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      toast.error('O arquivo é muito grande. Por favor, envie vídeos com menos de 30MB.', { style: { background: 'hsl(var(--destructive))', color: 'hsl(var(--destructive-foreground))' } });
      return;
    }

    let finalFile = file;
    if (isImage) {
      finalFile = await compressImage(file);
      setMediaType('image');
    } else {
      setMediaType('video');
    }
    setMediaFile(finalFile);
    setMediaPreview(URL.createObjectURL(finalFile));
  };

  const handlePickMedia = (type: 'image' | 'video') => {
    setMediaType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'image'
        ? ACCEPTED_IMAGE_TYPES.join(',')
        : ACCEPTED_VIDEO_TYPES.join(',');
      fileInputRef.current.click();
    }
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    setLinkUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaFile && !linkUrl.trim()) {
      toast.error('Escreva algo ou adicione uma mídia para publicar.');
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    try {
      let media_url: string | null = null;
      let finalMediaType: string | null = mediaType;
      let link_url: string | null = null;
      let link_title: string | null = null;
      let link_image: string | null = null;

      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const path = `${therapistId}/${Date.now()}.${ext}`;
        setUploadProgress(20);
        const { error: uploadError } = await supabase.storage
          .from('feed_media')
          .upload(path, mediaFile, { upsert: false });
        if (uploadError) throw uploadError;
        setUploadProgress(80);
        const { data: urlData } = supabase.storage.from('feed_media').getPublicUrl(path);
        media_url = urlData.publicUrl;
      } else if (mediaType === 'link' && linkUrl.trim()) {
        link_url = linkUrl.trim();
        finalMediaType = 'link';
        if (isYoutubeUrl(link_url)) {
          link_title = 'YouTube';
          link_image = getYoutubeThumb(link_url);
        }
      }

      setUploadProgress(90);

      const { error } = await supabase.from('feed_posts').insert({
        patient_id: patientId,
        therapist_id: therapistId,
        content: content.trim(),
        media_url,
        media_type: finalMediaType,
        link_url,
        link_title,
        link_image,
      });

      if (error) throw error;

      // Notify the patient via portal_notice
      const noticeTitle = '📌 Novidade no Mural!';
      const noticeContent = content.trim()
        ? `Seu terapeuta publicou: "${content.trim().substring(0, 100)}${content.trim().length > 100 ? '...' : ''}"`
        : finalMediaType === 'image'
          ? 'Seu terapeuta compartilhou uma foto no mural.'
          : finalMediaType === 'video'
            ? 'Seu terapeuta compartilhou um vídeo no mural.'
            : 'Seu terapeuta publicou algo novo no mural.';

      // Send notice to all active portal accounts for this patient
      const { data: accounts } = await supabase
        .from('patient_portal_accounts')
        .select('id')
        .eq('patient_id', patientId)
        .eq('status', 'active');

      if (accounts && accounts.length > 0) {
        await supabase.from('portal_notices').insert(
          accounts.map(acc => ({
            patient_id: patientId,
            therapist_user_id: therapistId,
            portal_account_id: acc.id,
            title: noticeTitle,
            content: noticeContent,
            read_by_patient: false,
          }))
        );
      }

      setUploadProgress(100);
      toast.success('Postagem publicada!');
      setContent('');
      clearMedia();
      onPostCreated();
    } catch (err: any) {
      toast.error('Erro ao publicar: ' + (err.message || 'tente novamente'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const isLinkMode = mediaType === 'link';

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="text-primary text-xs font-bold">{therapistName?.[0] ?? '?'}</span>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva uma novidade, observação ou conquista do paciente..."
          className="resize-none min-h-[80px] border-0 bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/40 text-sm"
          disabled={uploading}
        />
      </div>

      {/* Media preview */}
      {mediaPreview && (
        <div className="relative rounded-lg overflow-hidden border border-border ml-11">
          {mediaType === 'image' && (
            <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-cover" />
          )}
          {mediaType === 'video' && (
            <video src={mediaPreview} controls className="w-full max-h-64" />
          )}
          <button
            onClick={clearMedia}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur rounded-full p-1 hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Link input */}
      {isLinkMode && !mediaPreview && (
        <div className="ml-11 flex gap-2 items-center">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Cole aqui o link (ex: YouTube, artigo...)"
            className="text-sm"
            disabled={uploading}
          />
          <button onClick={clearMedia} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploading && uploadProgress > 0 && (
        <div className="ml-11 space-y-1">
          <Progress value={uploadProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">Enviando... {uploadProgress}%</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="ml-11 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => handlePickMedia('image')}
          disabled={uploading || !!mediaFile || isLinkMode}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            'text-muted-foreground border-border hover:border-primary/40 hover:text-primary',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Image className="w-3.5 h-3.5" /> Foto
        </button>
        <button
          type="button"
          onClick={() => handlePickMedia('video')}
          disabled={uploading || !!mediaFile || isLinkMode}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            'text-muted-foreground border-border hover:border-primary/40 hover:text-primary',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <Video className="w-3.5 h-3.5" /> Vídeo
        </button>
        <button
          type="button"
          onClick={() => { setMediaType('link'); setMediaFile(null); setMediaPreview(null); }}
          disabled={uploading || !!mediaFile}
          className={cn(
            'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
            'text-muted-foreground border-border hover:border-primary/40 hover:text-primary',
            'disabled:opacity-40 disabled:cursor-not-allowed',
            isLinkMode && 'border-primary/40 text-primary bg-primary/5'
          )}
        >
          <Link className="w-3.5 h-3.5" /> Link
        </button>
        <div className="ml-auto">
          <Button size="sm" onClick={handleSubmit} disabled={uploading} className="gap-1.5 h-8">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Publicar
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
