import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BookHeart, EyeOff, MessageCircle, Loader2, Save } from 'lucide-react';

interface DiaryEntry {
  id: string;
  created_at: string;
  shared_with_therapist: boolean;
  mood: string | null;
  content: string | null;
  therapist_comment: string | null;
  therapist_commented_at: string | null;
}

export function PatientDiaryTab({ patientId, userId }: { patientId: string; userId: string }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_patient_diary_for_therapist', { _patient_id: patientId });
    if (error) {
      toast({ title: 'Erro ao carregar diário', description: error.message, variant: 'destructive' });
    } else {
      setEntries((data as DiaryEntry[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  const saveComment = async (id: string) => {
    const text = drafts[id]?.trim();
    if (!text) return;
    setSaving(id);
    const { error } = await supabase
      .from('patient_diary_entries')
      .update({
        therapist_comment: text,
        therapist_commented_at: new Date().toISOString(),
        therapist_commented_by: userId,
      })
      .eq('id', id);
    setSaving(null);
    if (error) {
      toast({ title: 'Erro ao comentar', description: error.message, variant: 'destructive' });
      return;
    }
    setDrafts(d => ({ ...d, [id]: '' }));
    toast({ title: 'Comentário enviado' });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-xl p-5 shadow-sm border border-border">
        <div className="flex items-center gap-2 mb-2">
          <BookHeart className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Diário do Paciente</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Anotações feitas pelo paciente no portal. Você só vê o conteúdo quando ele opta por compartilhar — caso contrário, aparece apenas a data e hora do registro.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : entries.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma anotação registrada pelo paciente ainda.
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <Card key={e.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {e.shared_with_therapist && e.mood && <span className="text-xl">{e.mood}</span>}
                  <span className="text-xs text-muted-foreground font-medium">
                    {format(new Date(e.created_at), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                {!e.shared_with_therapist && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    <EyeOff className="w-3 h-3" /> Privado
                  </span>
                )}
              </div>

              {e.shared_with_therapist ? (
                <>
                  {e.content && (
                    <p className="text-sm whitespace-pre-wrap text-foreground bg-muted/30 p-3 rounded-lg">
                      {e.content}
                    </p>
                  )}

                  {e.therapist_comment && (
                    <div className="p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
                      <div className="flex items-center gap-1.5 mb-1">
                        <MessageCircle className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-semibold text-primary">
                          Seu comentário {e.therapist_commented_at && `• ${format(new Date(e.therapist_commented_at), "dd/MM HH:mm", { locale: ptBR })}`}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{e.therapist_comment}</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Textarea
                      value={drafts[e.id] ?? ''}
                      onChange={(ev) => setDrafts(d => ({ ...d, [e.id]: ev.target.value }))}
                      placeholder={e.therapist_comment ? 'Atualizar comentário...' : 'Escrever um comentário...'}
                      rows={2}
                      className="text-sm resize-none"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveComment(e.id)}
                        disabled={!drafts[e.id]?.trim() || saving === e.id}
                      >
                        {saving === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Salvar</>}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  O paciente fez uma anotação mas optou por mantê-la privada.
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}