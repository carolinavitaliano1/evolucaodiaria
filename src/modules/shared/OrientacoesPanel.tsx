import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Sparkles, Loader2, Save, FileText, Trash2, Download, Home, School } from 'lucide-react';
import { exportOrientacoesDocx } from '@/utils/orientacoesDocxExport';

type Audience = 'familiar' | 'escolar';
type Kind = 'psico' | 'psicom';

interface Orientacao {
  id: string;
  audience: Audience;
  titulo: string;
  content: string;
  created_at: string;
}

interface Props { patientId: string; kind: Kind; }

export function OrientacoesPanel({ patientId, kind }: Props) {
  const [tab, setTab] = useState<Audience>('familiar');
  const [items, setItems] = useState<Orientacao[]>([]);
  const [titulo, setTitulo] = useState('Orientações');
  const [foco, setFoco] = useState('');
  const [content, setContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [patientName, setPatientName] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('module_orientacoes')
      .select('*')
      .eq('patient_id', patientId)
      .eq('kind', kind)
      .order('created_at', { ascending: false });
    setItems((data || []) as Orientacao[]);
  }, [patientId, kind]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('patients').select('name').eq('id', patientId).maybeSingle();
      setPatientName((data as any)?.name || 'Paciente');
    })();
  }, [patientId]);

  function resetForm() {
    setTitulo(tab === 'familiar' ? 'Orientações para a família' : 'Orientações para a escola');
    setFoco('');
    setContent('');
    setEditingId(null);
  }

  useEffect(() => { resetForm(); }, [tab]);

  async function gerarComIA() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-orientacoes', {
        body: { patientId, kind, audience: tab, foco },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const texto = (data as any)?.content?.trim();
      if (!texto) throw new Error('IA não retornou conteúdo');
      setContent(texto);
      toast.success('Orientações geradas com base no prontuário');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar com IA');
    } finally {
      setGenerating(false);
    }
  }

  async function salvar() {
    if (!content.trim()) { toast.error('Conteúdo vazio'); return; }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Sessão expirada'); setLoading(false); return; }
    const payload = {
      patient_id: patientId, user_id: user.id, kind, audience: tab,
      titulo: titulo || 'Orientações', content,
    };
    const q = editingId
      ? supabase.from('module_orientacoes').update(payload).eq('id', editingId)
      : supabase.from('module_orientacoes').insert(payload);
    const { error } = await q;
    if (error) toast.error('Erro ao salvar');
    else { toast.success('Salvo'); resetForm(); load(); }
    setLoading(false);
  }

  async function excluir(id: string) {
    if (!confirm('Excluir estas orientações?')) return;
    const { error } = await supabase.from('module_orientacoes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Excluído'); if (editingId === id) resetForm(); load(); }
  }

  function editar(o: Orientacao) {
    setTab(o.audience);
    setEditingId(o.id);
    setTitulo(o.titulo);
    setContent(o.content);
    setFoco('');
  }

  async function baixarDocx(o: { titulo: string; content: string; audience: Audience }) {
    try {
      await exportOrientacoesDocx({
        titulo: o.titulo, paciente: patientName, audience: o.audience, content: o.content,
      });
    } catch (e: any) {
      toast.error('Falha ao gerar Word');
    }
  }

  const itemsAtuais = items.filter((i) => i.audience === tab);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Audience)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="familiar" className="gap-1.5"><Home className="w-3.5 h-3.5" /> Para a família</TabsTrigger>
          <TabsTrigger value="escolar" className="gap-1.5"><School className="w-3.5 h-3.5" /> Para a escola</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-primary" />
                {editingId ? 'Editar orientação' : 'Nova orientação'}
              </h4>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={resetForm} className="h-7 text-xs">Cancelar edição</Button>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input className="h-8 text-xs" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Foco (opcional, guia para a IA)</Label>
                <Input className="h-8 text-xs" value={foco} onChange={(e) => setFoco(e.target.value)}
                  placeholder={tab === 'familiar' ? 'Ex.: rotina de estudos, regulação emocional' : 'Ex.: adaptações em sala, atenção'} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={gerarComIA} disabled={generating} className="gap-1.5 h-8">
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {generating ? 'Analisando prontuário...' : 'Gerar com IA'}
              </Button>
              <Button size="sm" variant="outline" onClick={salvar} disabled={loading || !content.trim()} className="gap-1.5 h-8">
                <Save className="w-3.5 h-3.5" /> {editingId ? 'Atualizar' : 'Salvar'}
              </Button>
              {content.trim() && (
                <Button size="sm" variant="outline" onClick={() => baixarDocx({ titulo, content, audience: tab })} className="gap-1.5 h-8">
                  <Download className="w-3.5 h-3.5" /> Baixar Word
                </Button>
              )}
            </div>

            <Textarea rows={18} value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="Texto das orientações... Use o botão 'Gerar com IA' para preencher automaticamente a partir do prontuário." />
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold">Orientações salvas</h4>
              <p className="text-[11px] text-muted-foreground">{itemsAtuais.length} registro(s)</p>
            </div>
            {itemsAtuais.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma orientação salva ainda.</div>
            ) : (
              <div className="divide-y divide-border">
                {itemsAtuais.map((o) => (
                  <div key={o.id} className="p-3 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground">{o.titulo}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(o.created_at).toLocaleString('pt-BR')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{o.content}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => baixarDocx(o)} className="h-7 px-2 gap-1 text-xs">
                        <Download className="w-3.5 h-3.5" /> Word
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => editar(o)} className="h-7 px-2 text-xs">Editar</Button>
                      <Button size="sm" variant="ghost" onClick={() => excluir(o.id)} className="h-7 px-2 text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}