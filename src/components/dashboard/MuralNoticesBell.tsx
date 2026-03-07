import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Pin, Bell, Video, BookOpen, Link, ExternalLink, Youtube } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  created_at: string;
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

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return null;
}

export function MuralNoticesBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, markAllAsRead } = useUnreadNotices();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => { if (data) setNotices(data as Notice[]); });
  }, [user]);

  const handleOpen = async (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      // Mark all as read immediately (zera o badge na hora)
      if (notices.length > 0) {
        markAllAsRead(notices.map(n => n.id));
      } else {
        // Fetch notices first then mark
        const { data } = await supabase
          .from('notices')
          .select('id')
          .order('created_at', { ascending: false });
        if (data && data.length > 0) {
          markAllAsRead(data.map(n => n.id));
        }
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl hover:bg-accent transition-colors">
          <Megaphone className={cn('w-5 h-5 transition-colors', unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground')} />
          {unreadCount > 0 && (
            <>
              {/* Ping pulse ring */}
              <span className="absolute top-1 right-1 w-2.5 h-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
              </span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 shadow-xl" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Mural de Avisos</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-primary"
            onClick={() => { setOpen(false); navigate('/mural'); }}
          >
            Ver todos
          </Button>
        </div>

        {/* Notices list */}
        <div className="max-h-96 overflow-y-auto divide-y divide-border">
          {notices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Megaphone className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">Nenhum aviso ainda</p>
            </div>
          ) : (
            notices.map(n => {
              const embedUrl = n.video_url ? getVideoEmbedUrl(n.video_url) : null;
              return (
                <div key={n.id} className="px-4 py-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    {n.pinned && <Pin className="w-3 h-3 text-primary fill-primary shrink-0" />}
                    <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border shrink-0', TYPE_COLOR[n.type] || TYPE_COLOR.aviso)}>
                      {TYPE_ICON[n.type]}
                    </div>
                    <span className="font-medium text-foreground text-sm truncate flex-1">{n.title}</span>
                  </div>

                  {n.content && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{n.content}</p>
                  )}

                  {n.image_url && (
                    <img src={n.image_url} alt={n.title} className="w-full max-h-24 object-cover rounded-lg mb-1" />
                  )}

                  {n.video_url && embedUrl && (
                    <div className="rounded-lg overflow-hidden aspect-video bg-black mb-1">
                      <iframe src={embedUrl} className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen title={n.title} />
                    </div>
                  )}
                  {n.video_url && !embedUrl && (
                    <a href={n.video_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline mb-1">
                      <Youtube className="w-3 h-3" /> Assistir vídeo
                    </a>
                  )}
                  {n.link_url && (
                    <a href={n.link_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" />
                      {n.link_label || n.link_url}
                    </a>
                  )}

                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {format(new Date(n.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
