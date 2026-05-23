import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles, Save, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Relatorio, RelatorioTipo } from './types';

const TIPOS: { value: RelatorioTipo; label: string }[] = [
  { value: 'escola', label: 'Para a Escola' },
  { value: 'familia', label: 'Para a Família' },
  { value: 'encaminhamento', label: 'Encaminhamento' },
  { value: 'alta', label: 'Alta' },
];

interface Props {
  patientId: string;
}

export function RelatorioPanel({ patientId }: Props) {
  const [tipo, setTipo] = useState<RelatorioTipo>('escola');
  const [conteudo, setConteudo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Relatorio[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from('psicom_relatorios')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar relatórios');
    else setItems((data || []) as Relatorio[]);
  }

  useEffect(() => { load(); }, [patientId]);

  async function generate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('psico-generate-report', {
        body: { patient_id: patientId, tipo },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setConteudo((data as any).conteudo || '');
      toast.success('Relatório gerado pela IA. Revise e salve.');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar relatório');
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    if (!conteudo.trim()) { toast.error('Conteúdo vazio'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { error } = await supabase.from('psicom_relatorios').insert({
        patient_id: patientId,
        therapist_id: uid,
        tipo,
        conteudo: conteudo.trim(),
        titulo: TIPOS.find((t) => t.value === tipo)?.label || null,
      });
      if (error) throw error;
      toast.success('Relatório salvo');
      setConteudo('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este relatório?')) return;
    const { error } = await supabase.from('psicom_relatorios').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Excluído'); load(); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid sm:grid-cols-[200px_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as RelatorioTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            A IA usa avaliações, PDIs e últimas evoluções deste paciente para gerar um rascunho.
          </div>
          <Button onClick={generate} disabled={generating} className="gap-1.5">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Gerar com IA
          </Button>
        </div>

        <Textarea
          rows={14}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="O texto gerado pela IA aparecerá aqui — edite livremente antes de salvar."
          className="font-mono text-sm"
        />

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving || !conteudo.trim()} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar relatório
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Histórico</h4>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum relatório salvo ainda.</p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-medium">{r.titulo || TIPOS.find((t) => t.value === r.tipo)?.label}</span>
                  <span className="text-xs text-muted-foreground">
                    · {format(new Date(r.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => remove(r.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{r.conteudo}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
