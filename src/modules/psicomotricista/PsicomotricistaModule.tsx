import { useCallback, useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Activity, Target, FileText, FolderOpen, Calendar, Radar, ScanLine, ClipboardList, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AvaliacaoCard } from './AvaliacaoCard';
import { AvaliacaoForm } from './AvaliacaoForm';
import { PDICard } from './PDICard';
import { PDIForm } from './PDIForm';
import { RelatorioPanel } from './RelatorioPanel';
import { RegistrosPanel } from './RegistrosPanel';
import { ReunioesPanel } from './ReunioesPanel';
import { StatsCards } from './StatsCards';
import { AvaliacaoDocumentosPanel } from '@/modules/shared/AvaliacaoDocumentosPanel';
import { OrientacoesPanel } from '@/modules/shared/OrientacoesPanel';
import { AnamnesePanel } from './AnamnesePanel';
import { PerfilMotorPanel } from './PerfilMotorPanel';
import { DigitalizarAvaliacaoDialog } from '@/modules/shared/DigitalizarAvaliacaoDialog';
import type { Avaliacao, PDI } from './types';

interface Props {
  patientId: string;
}

export function PsicomotricistaModule({ patientId }: Props) {
  const [tab, setTab] = useState<'avaliacoes' | 'anamnese' | 'perfil' | 'registros' | 'pdi' | 'orientacoes' | 'reunioes' | 'relatorios'>('avaliacoes');
  const [avals, setAvals] = useState<Avaliacao[]>([]);
  const [pdis, setPdis] = useState<PDI[]>([]);
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');

  const [avalDialog, setAvalDialog] = useState(false);
  const [editAval, setEditAval] = useState<Avaliacao | null>(null);
  const [pdiDialog, setPdiDialog] = useState(false);
  const [editPdi, setEditPdi] = useState<PDI | null>(null);
  const [digitDialog, setDigitDialog] = useState(false);

  const load = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from('psicom_avaliacoes').select('*').eq('patient_id', patientId)
        .order('data_avaliacao', { ascending: false }),
      supabase.from('psicom_pdi').select('*').eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
    ]);
    if (a.error || p.error) toast.error('Erro ao carregar dados');
    setAvals((a.data || []) as Avaliacao[]);
    setPdis((p.data || []) as PDI[]);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  async function deleteAval(id: string) {
    if (!confirm('Excluir esta avaliação?')) return;
    const { error } = await supabase.from('psicom_avaliacoes').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluída'); load(); }
  }
  async function deletePdi(id: string) {
    if (!confirm('Excluir este PDI?')) return;
    const { error } = await supabase.from('psicom_pdi').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); load(); }
  }

  const filteredAvals = filterTipo === 'TODOS' ? avals : avals.filter((a) => a.tipo === filterTipo);

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-8 h-auto p-1 gap-1">
          <TabsTrigger value="avaliacoes" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> Avaliações</TabsTrigger>
          <TabsTrigger value="anamnese" className="gap-1.5"><ClipboardList className="w-3.5 h-3.5" /> Anamnese</TabsTrigger>
          <TabsTrigger value="perfil" className="gap-1.5"><Radar className="w-3.5 h-3.5" /> Perfil Motor</TabsTrigger>
          <TabsTrigger value="registros" className="gap-1.5"><FolderOpen className="w-3.5 h-3.5" /> Registros</TabsTrigger>
          <TabsTrigger value="pdi" className="gap-1.5"><Target className="w-3.5 h-3.5" /> PDI</TabsTrigger>
          <TabsTrigger value="orientacoes" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Orientações</TabsTrigger>
          <TabsTrigger value="reunioes" className="gap-1.5"><Calendar className="w-3.5 h-3.5" /> Reuniões</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Relatórios IA</TabsTrigger>
        </TabsList>

        <TabsContent value="avaliacoes" className="space-y-4">
          <StatsCards avaliacoes={avals} />
          <AvaliacaoDocumentosPanel patientId={patientId} kind="psicom" />
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Registros recentes</h3>
                <p className="text-[11px] text-muted-foreground">Clique para expandir e ver o radar e detalhes.</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterTipo} onValueChange={setFilterTipo}>
                  <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos os tipos</SelectItem>
                    <SelectItem value="inicial">Inicial</SelectItem>
                    <SelectItem value="reavaliacao">Reavaliação</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => { setEditAval(null); setAvalDialog(true); }} className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Nova avaliação
                </Button>
                <Button size="sm" variant="outline" onClick={() => setDigitDialog(true)} className="gap-1.5">
                  <ScanLine className="w-3.5 h-3.5" /> Digitalizar
                </Button>
              </div>
            </div>
            {filteredAvals.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                {avals.length === 0 ? 'Nenhuma avaliação ainda. Comece com a avaliação inicial.' : `Nenhuma avaliação do tipo selecionado.`}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredAvals.map((a) => (
                  <div key={a.id} className="p-2">
                    <AvaliacaoCard
                      avaliacao={a}
                      onEdit={() => { setEditAval(a); setAvalDialog(true); }}
                      onDelete={() => deleteAval(a.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="registros">
          <RegistrosPanel patientId={patientId} />
        </TabsContent>

        <TabsContent value="anamnese">
          <AnamnesePanel patientId={patientId} />
        </TabsContent>

        <TabsContent value="perfil">
          <PerfilMotorPanel patientId={patientId} avaliacoes={avals} />
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

        <TabsContent value="relatorios">
          <RelatorioPanel patientId={patientId} />
        </TabsContent>

        <TabsContent value="orientacoes">
          <OrientacoesPanel patientId={patientId} kind="psicom" />
        </TabsContent>

        <TabsContent value="reunioes">
          <ReunioesPanel patientId={patientId} />
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

      <DigitalizarAvaliacaoDialog
        open={digitDialog}
        onOpenChange={setDigitDialog}
        patientId={patientId}
        kind="psicom"
        onSaved={load}
      />

    </div>
  );
}
