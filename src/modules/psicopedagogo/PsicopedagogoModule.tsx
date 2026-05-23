import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Activity, Target, NotebookPen, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AvaliacaoCard } from './AvaliacaoCard';
import { AvaliacaoForm } from './AvaliacaoForm';
import { PDICard } from './PDICard';
import { PDIForm } from './PDIForm';
import { EvolucaoForm } from './EvolucaoForm';
import { RelatorioPanel } from './RelatorioPanel';
import type { Avaliacao, PDI, PsicoEvolucao } from './types';

interface Props {
  patientId: string;
}

const DESEMPENHO_LABEL: Record<string, string> = {
  otimo: 'Ótimo', bom: 'Bom', regular: 'Regular', dificuldade: 'Com dificuldade',
};

export function PsicopedagogoModule({ patientId }: Props) {
  const [tab, setTab] = useState<'avaliacoes' | 'pdi' | 'evolucoes' | 'relatorios'>('avaliacoes');
  const [avals, setAvals] = useState<Avaliacao[]>([]);
  const [pdis, setPdis] = useState<PDI[]>([]);
  const [evos, setEvos] = useState<PsicoEvolucao[]>([]);

  const [avalDialog, setAvalDialog] = useState(false);
  const [editAval, setEditAval] = useState<Avaliacao | null>(null);
  const [pdiDialog, setPdiDialog] = useState(false);
  const [editPdi, setEditPdi] = useState<PDI | null>(null);
  const [evoDialog, setEvoDialog] = useState(false);

  const load = useCallback(async () => {
    const [a, p, e] = await Promise.all([
      supabase.from('psico_avaliacoes').select('*').eq('patient_id', patientId)
        .order('data_avaliacao', { ascending: false }),
      supabase.from('psico_pdi').select('*').eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      supabase.from('psico_evolucoes').select('*').eq('patient_id', patientId)
        .order('data_sessao', { ascending: false }),
    ]);
    if (a.error || p.error || e.error) toast.error('Erro ao carregar dados');
    setAvals((a.data || []) as Avaliacao[]);
    setPdis((p.data || []) as PDI[]);
    setEvos((e.data || []) as PsicoEvolucao[]);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  async function deleteAval(id: string) {
    if (!confirm('Excluir esta avaliação?')) return;
    const { error } = await supabase.from('psico_avaliacoes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluída'); load(); }
  }
  async function deletePdi(id: string) {
    if (!confirm('Excluir este PDI?')) return;
    const { error } = await supabase.from('psico_pdi').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); load(); }
  }
  async function deleteEvo(id: string) {
    if (!confirm('Excluir esta evolução?')) return;
    const { error } = await supabase.from('psico_evolucoes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluída'); load(); }
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1">
          <TabsTrigger value="avaliacoes" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Avaliações</TabsTrigger>
          <TabsTrigger value="pdi" className="gap-1.5"><Target className="w-3.5 h-3.5" /> PDI</TabsTrigger>
          <TabsTrigger value="evolucoes" className="gap-1.5"><NotebookPen className="w-3.5 h-3.5" /> Evoluções</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Relatórios IA</TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacoes" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {avals.length} avaliação{avals.length === 1 ? '' : 'ões'} registrada{avals.length === 1 ? '' : 's'}.
            </p>
            <Button size="sm" onClick={() => { setEditAval(null); setAvalDialog(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nova avaliação
            </Button>
          </div>
          {avals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma avaliação ainda. Comece com a avaliação inicial.
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {avals.map((a) => (
                <AvaliacaoCard
                  key={a.id}
                  avaliacao={a}
                  onEdit={() => { setEditAval(a); setAvalDialog(true); }}
                  onDelete={() => deleteAval(a.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pdi" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {pdis.length} plano{pdis.length === 1 ? '' : 's'} de desenvolvimento.
            </p>
            <Button size="sm" onClick={() => { setEditPdi(null); setPdiDialog(true); }} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Novo PDI
            </Button>
          </div>
          {pdis.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum PDI ainda. Crie metas para esta intervenção.
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {pdis.map((p) => (
                <PDICard
                  key={p.id}
                  pdi={p}
                  onEdit={() => { setEditPdi(p); setPdiDialog(true); }}
                  onDelete={() => deletePdi(p.id)}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="evolucoes" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              {evos.length} sessão{evos.length === 1 ? '' : 'ões'} registrada{evos.length === 1 ? '' : 's'}.
            </p>
            <Button size="sm" onClick={() => setEvoDialog(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Nova evolução
            </Button>
          </div>
          {evos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhuma evolução de sessão ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {evos.map((e) => (
                <div key={e.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-sm font-medium text-foreground">
                      {format(new Date(e.data_sessao + 'T12:00:00'), "d 'de' MMM yyyy", { locale: ptBR })}
                      {e.duracao_min ? <span className="text-xs text-muted-foreground"> · {e.duracao_min} min</span> : null}
                    </div>
                    <div className="flex gap-2 text-[10px]">
                      {e.desempenho && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{DESEMPENHO_LABEL[e.desempenho]}</span>}
                      {e.humor && <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{e.humor}</span>}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteEvo(e.id)}>×</Button>
                    </div>
                  </div>
                  {e.atividades && e.atividades.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {e.atividades.map((at, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{at}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap">{e.descricao}</p>
                  {e.tarefas_casa && (
                    <p className="text-xs text-muted-foreground border-t pt-1.5">
                      <span className="font-medium">Tarefa de casa:</span> {e.tarefas_casa}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="relatorios">
          <RelatorioPanel patientId={patientId} />
        </TabsContent>
      </Tabs>

      <Dialog open={avalDialog} onOpenChange={setAvalDialog}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editAval ? 'Editar avaliação' : 'Nova avaliação'}</DialogTitle>
          </DialogHeader>
          <AvaliacaoForm
            patientId={patientId}
            existing={editAval}
            onSaved={() => { setAvalDialog(false); load(); }}
            onCancel={() => setAvalDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={pdiDialog} onOpenChange={setPdiDialog}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editPdi ? 'Editar PDI' : 'Novo PDI'}</DialogTitle>
          </DialogHeader>
          <PDIForm
            patientId={patientId}
            existing={editPdi}
            onSaved={() => { setPdiDialog(false); load(); }}
            onCancel={() => setPdiDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={evoDialog} onOpenChange={setEvoDialog}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova evolução</DialogTitle>
          </DialogHeader>
          <EvolucaoForm
            patientId={patientId}
            pdis={pdis}
            onSaved={() => { setEvoDialog(false); load(); }}
            onCancel={() => setEvoDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
