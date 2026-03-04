import { useState, useEffect } from 'react';
import { Pin, Bell, Video, BookOpen, Link, ExternalLink, Megaphone, ArrowRight, Youtube } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface Notice {
  id: string;
  title: string;
  content: string | null;
  type: string;
  video_url: string | null;
  link_url: string | null;
  link_label: string | null;
  pinned: boolean;
  color: string;
  image_url: string | null;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  aviso: <Bell className="w-3.5 h-3.5" />,
  video: <Video className="w-3.5 h-3.5" />,
  tutorial: <BookOpen className="w-3.5 h-3.5" />,
  link: <Link className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<string, string> = {
  aviso: 'bg-warning/15 border-warning/30 text-warning',
  video: 'bg-destructive/10 border-destructive/20 text-destructive',
  tutorial: 'bg-primary/10 border-primary/20 text-primary',
  link: 'bg-secondary border-border text-foreground',
};

function getCardBg(color: string) {
  const map: Record<string, string> = {
    default: 'bg-card',
    blue: 'bg-blue-500/5 border-blue-500/20',
    green: 'bg-green-500/5 border-green-500/20',
    yellow: 'bg-yellow-500/5 border-yellow-500/20',
    red: 'bg-red-500/5 border-red-500/20',
    purple: 'bg-purple-500/5 border-purple-500/20',
  };
  return map[color] || 'bg-card';
}

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function DashboardMural() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notices')
      .select('*')
      .eq('user_id', user.id)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => { if (data) setNotices(data as Notice[]); });
  }, [user]);

  if (notices.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" />
          Mural de Avisos
        </h3>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => navigate('/mural')}>
          Ver todos <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-3">
        {notices.map(n => {
          const embedUrl = n.video_url ? getVideoEmbedUrl(n.video_url) : null;
          return (
            <div
              key={n.id}
              className={cn(
                'rounded-xl border p-3 flex flex-col gap-2',
                getCardBg(n.color),
                n.pinned && 'ring-1 ring-primary/30'
              )}
            >
              <div className="flex items-center gap-2">
                {n.pinned && <Pin className="w-3 h-3 text-primary fill-primary shrink-0" />}
                <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border', TYPE_COLOR[n.type] || TYPE_COLOR.aviso)}>
                  {TYPE_ICON[n.type]}
                </div>
                <span className="font-medium text-foreground text-sm truncate">{n.title}</span>
              </div>

              {n.image_url && (
                <img src={n.image_url} alt={n.title} className="w-full max-h-32 object-cover rounded-lg" />
              )}

              {n.content && (
                <p className="text-xs text-muted-foreground line-clamp-2">{n.content}</p>
              )}

              {n.video_url && embedUrl && (
                <div className="rounded-lg overflow-hidden aspect-video bg-black">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={n.title}
                  />
                </div>
              )}
              {n.video_url && !embedUrl && (
                <a href={n.video_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <Youtube className="w-3.5 h-3.5" /> Assistir vídeo
                </a>
              )}

              {n.link_url && (
                <a href={n.link_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                  <ExternalLink className="w-3.5 h-3.5" />
                  {n.link_label || n.link_url}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
