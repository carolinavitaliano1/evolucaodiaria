import { useEffect, useState } from 'react';
import { PortalLayout } from '@/components/portal/PortalLayout';
import { usePortal } from '@/contexts/PortalContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookHeart, Trash2, MessageCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOODS = [
  { v: '😄', l: 'Ótimo' },
  { v: '🙂', l: 'Bom' },
  { v: '😐', l: 'Neutro' },
  { v: '😕', l: 'Triste' },
  { v: '😠', l: 'Bravo' },
  { v: '😰', l: 'Ansioso' },
  { v: '😴', l: 'Cansado' },
];

interface DiaryEntry {
  id: string;
  mood: string | null;
  content: string | null;
  shared_with_therapist: boolean;
  therapist_comment: string | null;
  therapist_commented_at: string | null;
  created_at: string;
}

export default function PortalDiary() {
  const { portalAccount } = usePortal();
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [mood, setMood] = useState<string>('');
  const [content, setContent] = useState('');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!portalAccount) return;
    const { data } = await supabase
      .from('patient_diary_entries')
      .select('*')
      .eq('patient_id', portalAccount.patient_id)
      .order('created_at', { ascending: false });
    setEntries((data as DiaryEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [portalAccount]);

  const save = async () => {
    if (!portalAccount) return;
    if (!mood && !content.trim()) {
      toast({ title: 'Escreva algo ou escolha um humor', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('patient_diary_entries').insert({
      patient_id: portalAccount.patient_id,
      portal_account_id: portalAccount.id,
      mood: mood || null,
      content: content.trim() || null,
      shared_with_therapist: shared,
    });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setMood(''); setContent(''); setShared(false);
    toast({ title: 'Anotação salva ✨' });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Excluir esta anotação?')) return;
    await supabase.from('patient_diary_entries').delete().eq('id', id);
    load();
  };

  const toggleShare = async (e: DiaryEntry) => {
    await supabase
      .from('patient_diary_entries')
      .update({ shared_with_therapist: !e.shared_with_therapist })
      .eq('id', e.id);
    load();
  };

  return (
    <PortalLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BookHeart className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Meu Diário</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Registre como você está se sentindo. Você decide se quer compartilhar com seu terapeuta.
        </p>

        {/* New entry */}
        <Card className="p-4 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Como você está hoje?</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {MOODS.map((m) => (
                <button
                  key={m.v}
                  type="button"
                  onClick={() => setMood(mood === m.v ? '' : m.v)}
                  className={cn(
                    'flex flex-col items-center justify-center w-14 h-14 rounded-xl border transition-all',
                    mood === m.v
                      ? 'border-primary bg-primary/10 scale-105'
                      : 'border-border hover:border-primary/40'
                  )}
                >
                  <span className="text-xl leading-none">{m.v}</span>
                  <span className="text-[9px] text-muted-foreground mt-0.5">{m.l}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Anotação</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escreva o que está sentindo, pensando, vivendo..."
              rows={5}
              className="mt-2 resize-none"
            />
          </div>

          <div className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
            <div className="flex items-start gap-2">
              {shared ? <Eye className="w-4 h-4 text-primary mt-0.5" /> : <EyeOff className="w-4 h-4 text-muted-foreground mt-0.5" />}
              <div>
                <Label htmlFor="share" className="text-sm font-medium cursor-pointer">
                  Compartilhar com o terapeuta
                </Label>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {shared
                    ? 'Seu terapeuta verá o conteúdo e poderá comentar.'
                    : 'Apenas você verá o conteúdo. O terapeuta verá só a data.'}
                </p>
              </div>
            </div>
            <Switch id="share" checked={shared} onCheckedChange={setShared} />
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar anotação'}
          </Button>
        </Card>

        {/* History */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Histórico</h2>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : entries.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma anotação ainda. Comece registrando como você está hoje.
            </Card>
          ) : (
            entries.map((e) => (
              <Card key={e.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {e.mood && <span className="text-xl">{e.mood}</span>}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd 'de' MMM • HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleShare(e)}
                      title={e.shared_with_therapist ? 'Tornar privado' : 'Compartilhar'}
                      className="p-1.5 rounded hover:bg-muted"
                    >
                      {e.shared_with_therapist
                        ? <Eye className="w-4 h-4 text-primary" />
                        : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    <button onClick={() => remove(e.id)} className="p-1.5 rounded hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  </div>
                </div>
                {e.content && (
                  <p className="text-sm whitespace-pre-wrap text-foreground">{e.content}</p>
                )}
                {e.therapist_comment && (
                  <div className="mt-2 p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MessageCircle className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-semibold text-primary">Comentário do terapeuta</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{e.therapist_comment}</p>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </PortalLayout>
  );
}