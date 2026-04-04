import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Bell, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Notice {
  id: string;
  title: string;
  content: string | null;
  read_by_patient: boolean;
  created_at: string;
}

interface PortalNoticesManagerProps {
  patientId: string;
  patientName: string;
  portalAccountId: string;
}

export function PortalNoticesManager({ patientId, patientName, portalAccountId }: PortalNoticesManagerProps) {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const loadNotices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('portal_notices')
      .select('*')
      .eq('patient_id', patientId)
      .eq('portal_account_id', portalAccountId)
      .order('created_at', { ascending: false });
    setNotices((data || []) as Notice[]);
    setLoading(false);
  };

  useEffect(() => { loadNotices(); }, [patientId, portalAccountId]);

  const handleCreate = async () => {
    if (!title.trim() || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('portal_notices').insert({
        patient_id: patientId,
        therapist_user_id: user.id,
        title: title.trim(),
        content: content.trim() || null,
        read_by_patient: false,
      });
      if (error) throw error;
      toast.success('Aviso publicado!');
      setTitle(''); setContent(''); setShowForm(false);
      await loadNotices();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar aviso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('portal_notices').delete().eq('id', id);
    await loadNotices();
    toast.success('Aviso removido');
  };

  if (loading) return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          Avisos para {patientName}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)} className="gap-1.5 text-xs h-8">
          <Plus className="w-3 h-3" />
          Novo aviso
        </Button>
      </div>

      {showForm && (
        <div className="bg-muted/30 rounded-xl border border-border p-4 space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Lembrete de sessão" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Conteúdo (opcional)</Label>
            <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Detalhes do aviso..." className="mt-1 resize-none" rows={3} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleCreate} disabled={!title.trim() || saving} className="gap-1.5 text-xs">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Publicar aviso
            </Button>
          </div>
        </div>
      )}

      {notices.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum aviso publicado.</p>
      ) : (
        <div className="space-y-2">
          {notices.map(notice => (
            <div key={notice.id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-foreground truncate">{notice.title}</p>
                    {notice.read_by_patient && (
                      <span className="text-[10px] text-success flex items-center gap-0.5 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> Lido
                      </span>
                    )}
                  </div>
                  {notice.content && <p className="text-xs text-muted-foreground line-clamp-2">{notice.content}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(notice.created_at), "d 'de' MMM", { locale: ptBR })}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(notice.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
