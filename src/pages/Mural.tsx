import { useState, useEffect, useRef } from 'react';
import { Plus, Pin, Pencil, Trash2, Video, BookOpen, Bell, Link, Loader2, Youtube, ExternalLink, ImageIcon, X, Upload, Share2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnreadNotices } from '@/hooks/useUnreadNotices';

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

const TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; colorClass: string }> = {
  aviso: { label: 'Aviso', icon: <Bell className="w-4 h-4" />, colorClass: 'bg-warning/15 border-warning/30 text-warning' },
  video: { label: 'Vídeo', icon: <Video className="w-4 h-4" />, colorClass: 'bg-destructive/10 border-destructive/20 text-destructive' },
  tutorial: { label: 'Tutorial', icon: <BookOpen className="w-4 h-4" />, colorClass: 'bg-primary/10 border-primary/20 text-primary' },
  link: { label: 'Link', icon: <Link className="w-4 h-4" />, colorClass: 'bg-accent/50 border-border text-foreground' },
};

const COLOR_OPTIONS = [
  { value: 'default', label: 'Padrão', bg: 'bg-card' },
  { value: 'blue', label: 'Azul', bg: 'bg-blue-500/10' },
  { value: 'green', label: 'Verde', bg: 'bg-green-500/10' },
  { value: 'yellow', label: 'Amarelo', bg: 'bg-yellow-500/10' },
  { value: 'red', label: 'Vermelho', bg: 'bg-red-500/10' },
  { value: 'purple', label: 'Roxo', bg: 'bg-purple-500/10' },
];

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
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
  return null;
}

const emptyForm = {
  title: '',
  content: '',
  type: 'aviso',
  video_url: '',
  link_url: '',
  link_label: '',
  pinned: false,
  color: 'default',
  image_url: '',
};

export default function Mural() {
  const { user } = useAuth();
  const isOwner = user?.email === 'carolinavitaliano1@gmail.com';
  const [notices, setNotices] = useState<Notice[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [form, setForm] = useState({ ...emptyForm });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { refetch: refetchUnread } = useUnreadNotices();

  const loadNotices = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false });
    if (data) setNotices(data as Notice[]);
    setLoading(false);
  };

  const loadReadIds = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notice_reads')
      .select('notice_id')
      .eq('user_id', user.id);
    if (data) setReadIds(new Set(data.map(r => r.notice_id)));
  };

  useEffect(() => {
    loadNotices();
    loadReadIds();
  }, [user]);

  // Mark all visible notices as read when the page loads
  useEffect(() => {
    if (!user || notices.length === 0) return;
    const unread = notices.filter(n => !readIds.has(n.id));
    if (unread.length === 0) return;
    const rows = unread.map(n => ({ user_id: user.id, notice_id: n.id }));
    supabase.from('notice_reads')
      .upsert(rows, { onConflict: 'user_id,notice_id' })
      .then(() => {
        setReadIds(prev => new Set([...prev, ...unread.map(n => n.id)]));
        refetchUnread();
      });
  }, [notices, user]);

  const openCreate = () => {
    setEditingNotice(null);
    setForm({ ...emptyForm });
    setImagePreview('');
    setDialogOpen(true);
  };

  const openEdit = (n: Notice) => {
    setEditingNotice(n);
    setForm({
      title: n.title,
      content: n.content || '',
      type: n.type,
      video_url: n.video_url || '',
      link_url: n.link_url || '',
      link_label: n.link_label || '',
      pinned: n.pinned,
      color: n.color,
      image_url: n.image_url || '',
    });
    setImagePreview(n.image_url || '');
    setDialogOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `notices/${user.id}/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(data.path);
      setForm(prev => ({ ...prev, image_url: urlData.publicUrl }));
      setImagePreview(urlData.publicUrl);
      toast.success('Imagem enviada!');
    } catch (e) {
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setForm(prev => ({ ...prev, image_url: '' }));
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    if (!form.title.trim() || !user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      content: form.content.trim() || null,
      type: form.type,
      video_url: form.video_url.trim() || null,
      link_url: form.link_url.trim() || null,
      link_label: form.link_label.trim() || null,
      pinned: form.pinned,
      color: form.color,
      image_url: form.image_url.trim() || null,
    };
    if (editingNotice) {
      const { error } = await supabase.from('notices').update(payload).eq('id', editingNotice.id);
      if (error) { toast.error('Erro ao atualizar aviso'); }
      else { toast.success('Aviso atualizado!'); }
    } else {
      const { data, error } = await supabase.from('notices').insert(payload).select().single();
      if (error) { toast.error('Erro ao criar aviso'); }
      else {
        toast.success('Aviso criado!');
        // Mark the new notice as unread so badge appears
        refetchUnread();
        // Send email notification to all clients
        supabase.functions.invoke('notify-mural', {
          body: {
            noticeTitle: payload.title,
            noticeContent: payload.content || '',
            noticeType: payload.type,
          },
        }).then(({ error: notifyError }) => {
          if (notifyError) {
            console.error('Erro ao enviar e-mails do mural:', notifyError);
          } else {
            toast.success('E-mails enviados aos clientes!', { duration: 3000 });
          }
        });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    loadNotices();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('notices').delete().eq('id', deleteId);
    toast.success('Aviso excluído');
    setDeleteId(null);
    loadNotices();
    refetchUnread();
  };

  const togglePin = async (n: Notice) => {
    await supabase.from('notices').update({ pinned: !n.pinned }).eq('id', n.id);
    loadNotices();
  };

  const handleShare = (n: Notice) => {
    const url = `${window.location.origin}/mural?notice=${n.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(n.id);
      toast.success('Link copiado! Só quem tem conta no sistema consegue ver.');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const filtered = filterType === 'all' ? notices : notices.filter(n => n.type === filterType);
  const pinned = filtered.filter(n => n.pinned);
  const unpinned = filtered.filter(n => !n.pinned);

  const renderNoticeCard = (n: Notice) => {
    const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.aviso;
    const embedUrl = n.video_url ? getVideoEmbedUrl(n.video_url) : null;
    const isUnread = !readIds.has(n.id);

    return (
      <div
        key={n.id}
        className={cn(
          'group rounded-2xl border p-4 lg:p-5 flex flex-col gap-3 transition-all',
          getCardBg(n.color),
          n.pinned && 'ring-2 ring-primary/30',
          isUnread && 'ring-2 ring-primary/50 shadow-sm'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            {n.pinned && <Pin className="w-3.5 h-3.5 text-primary shrink-0" />}
            <div className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border', cfg.colorClass)}>
              {cfg.icon}
              {cfg.label}
            </div>
            {isUnread && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                Novo
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleShare(n)} title="Copiar link">
              {copiedId === n.id
                ? <Check className="w-3.5 h-3.5 text-success" />
                : <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => togglePin(n)} title={n.pinned ? 'Desafixar' : 'Fixar'}>
              <Pin className={cn('w-3.5 h-3.5', n.pinned ? 'text-primary fill-primary' : 'text-muted-foreground')} />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(n)}>
              <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteId(n.id)}>
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-base leading-snug">{n.title}</h3>

        {/* Image */}
        {n.image_url && (
          <div
            className="rounded-xl overflow-hidden cursor-pointer"
            onClick={() => setExpandedImage(n.image_url!)}
          >
            <img
              src={n.image_url}
              alt={n.title}
              className="w-full max-h-56 object-cover hover:opacity-90 transition-opacity"
            />
          </div>
        )}

        {/* Content */}
        {n.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{n.content}</p>
        )}

        {/* Video embed */}
        {n.video_url && embedUrl && (
          <div className="rounded-xl overflow-hidden aspect-video bg-black">
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
            className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Youtube className="w-4 h-4" />
            Assistir vídeo
          </a>
        )}

        {/* External link */}
        {n.link_url && (
          <a href={n.link_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-primary hover:underline font-medium">
            <ExternalLink className="w-4 h-4" />
            {n.link_label || n.link_url}
          </a>
        )}

        {/* Footer: date + share */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="text-xs text-muted-foreground/60">
            {format(new Date(n.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
          </p>
          <button
            onClick={() => handleShare(n)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {copiedId === n.id
              ? <><Check className="w-3 h-3 text-success" /> <span className="text-success">Copiado!</span></>
              : <><Share2 className="w-3 h-3" /> Compartilhar</>
            }
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Mural de Avisos</h1>
            <p className="text-muted-foreground text-sm mt-1">Avisos, vídeos e tutoriais para consulta rápida</p>
          </div>
          <Button className="gradient-primary gap-2" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Aviso</span>
          </Button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[{ value: 'all', label: 'Todos' }, ...Object.entries(TYPE_CONFIG).map(([value, cfg]) => ({ value, label: cfg.label }))]
            .map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterType(value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                  filterType === value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary border-border text-foreground hover:border-primary/50'
                )}
              >
                {label}
              </button>
            ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-muted-foreground text-lg font-medium">Nenhum aviso ainda</p>
          <p className="text-muted-foreground text-sm mt-1">Crie seu primeiro aviso, vídeo ou tutorial</p>
          <Button className="gradient-primary gap-2 mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Criar primeiro aviso
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pin className="w-4 h-4 text-primary fill-primary" />
                <span className="text-sm font-semibold text-foreground">Fixados</span>
                <Badge variant="secondary" className="text-xs">{pinned.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pinned.map(renderNoticeCard)}
              </div>
            </div>
          )}
          {unpinned.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-foreground">Outros</span>
                  <Badge variant="secondary" className="text-xs">{unpinned.length}</Badge>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {unpinned.map(renderNoticeCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image Lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setExpandedImage(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={expandedImage}
            alt="Imagem ampliada"
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setImagePreview(''); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingNotice ? 'Editar Aviso' : 'Novo Aviso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aviso">🔔 Aviso</SelectItem>
                  <SelectItem value="video">🎬 Vídeo</SelectItem>
                  <SelectItem value="tutorial">📖 Tutorial</SelectItem>
                  <SelectItem value="link">🔗 Link</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Título *</Label>
              <Input
                className="mt-1"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Novo protocolo de atendimento"
              />
            </div>

            <div>
              <Label>Descrição / Conteúdo</Label>
              <Textarea
                className="mt-1 min-h-[100px]"
                value={form.content}
                onChange={e => setForm({ ...form, content: e.target.value })}
                placeholder="Descreva o aviso, tutorial ou observações..."
              />
            </div>

            {/* Image upload */}
            <div>
              <Label className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> Imagem
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
              {imagePreview ? (
                <div className="mt-2 relative">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-40 object-cover rounded-xl border border-border" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="mt-2 w-full border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 transition-colors"
                >
                  {uploadingImage ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-6 h-6" />
                      <span className="text-sm">Clique para enviar imagem</span>
                      <span className="text-xs">JPG, PNG, WebP</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {(form.type === 'video' || form.type === 'tutorial') && (
              <div>
                <Label>URL do Vídeo</Label>
                <Input
                  className="mt-1"
                  value={form.video_url}
                  onChange={e => setForm({ ...form, video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... ou Vimeo"
                />
                <p className="text-xs text-muted-foreground mt-1">Suporta YouTube, Vimeo e Google Drive</p>
              </div>
            )}

            {(form.type === 'link' || form.type === 'tutorial') && (
              <div className="space-y-3">
                <div>
                  <Label>URL do Link</Label>
                  <Input
                    className="mt-1"
                    value={form.link_url}
                    onChange={e => setForm({ ...form, link_url: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <Label>Texto do Link</Label>
                  <Input
                    className="mt-1"
                    value={form.link_label}
                    onChange={e => setForm({ ...form, link_label: e.target.value })}
                    placeholder="Ex: Clique para acessar"
                  />
                </div>
              </div>
            )}

            <div>
              <Label>Cor do Card</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.value })}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      c.bg,
                      form.color === c.value ? 'border-primary scale-110' : 'border-border hover:border-primary/50'
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label>Fixar no topo</Label>
                <p className="text-xs text-muted-foreground">Aparece sempre em destaque</p>
              </div>
              <Switch checked={form.pinned} onCheckedChange={v => setForm({ ...form, pinned: v })} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button className="flex-1 gradient-primary" onClick={handleSave} disabled={saving || !form.title.trim() || uploadingImage}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingNotice ? 'Salvar' : 'Criar'}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setDialogOpen(false); setImagePreview(''); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aviso?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
