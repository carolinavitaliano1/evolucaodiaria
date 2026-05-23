import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X, Plus, Trash2, Video, Sparkles, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { PDI, PdiObjetivo, PdiStatus } from './types';
import { DOMINIOS } from './types';
import { PDI_TEMPLATES_SERIE } from './presets';

interface Props {
  patientId: string;
  existing?: PDI | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function PDIForm({ patientId, existing, onSaved, onCancel }: Props) {
  const [titulo, setTitulo] = useState(existing?.titulo || '');
  const [inicio, setInicio] = useState(existing?.periodo_inicio || new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState(existing?.periodo_fim || '');
  const [status, setStatus] = useState<PdiStatus>(existing?.status || 'ativo');
  const [observacoes, setObservacoes] = useState(existing?.observacoes || '');
  const [objetivos, setObjetivos] = useState<PdiObjetivo[]>(existing?.objetivos || [
    { area: 'leitura', meta: '', prazo: '', atingida: false },
  ]);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<string>('');

  function addObjetivo() {
    setObjetivos((arr) => [...arr, { area: 'leitura', meta: '', prazo: '', atingida: false }]);
  }
  function removeObjetivo(i: number) {
    setObjetivos((arr) => arr.filter((_, idx) => idx !== i));
  }
  function updateObjetivo(i: number, patch: Partial<PdiObjetivo>) {
    setObjetivos((arr) => arr.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  function aplicarTemplate(faixa: string) {
    setTemplate(faixa);
    const t = PDI_TEMPLATES_SERIE.find((x) => x.faixa === faixa);
    if (!t) return;
    setObjetivos((arr) => {
      const novos: PdiObjetivo[] = t.objetivos.map((o) => ({
        area: o.area,
        meta: o.meta,
        prazo: '',
        atingida: false,
        material_adaptado: o.material_adaptado,
        idade_alvo: t.faixa,
      }));
      const preenchidos = arr.filter((o) => o.meta.trim().length > 0);
      return [...preenchidos, ...novos];
    });
    toast.success(`Template "${t.faixa}" aplicado`);
  }

  async function save() {
    if (!titulo.trim()) { toast.error('Informe um título'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const payload = {
        patient_id: patientId,
        therapist_id: uid,
        titulo: titulo.trim(),
        periodo_inicio: inicio,
        periodo_fim: fim || null,
        status,
        objetivos: objetivos.filter((o) => o.meta.trim().length > 0) as any,
        observacoes: observacoes || null,
      };
      const { error } = existing
        ? await supabase.from('psico_pdi').update(payload).eq('id', existing.id)
        : await supabase.from('psico_pdi').insert(payload);
      if (error) throw error;
      toast.success(existing ? 'PDI atualizado' : 'PDI criado');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar PDI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-1">
      <div className="space-y-1.5">
        <Label>Título do PDI</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Plano 1º trimestre 2026" />
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Início</Label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Fim previsto</Label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as PdiStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="pausado">Pausado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="text-sm font-semibold">Objetivos</Label>
          <div className="flex items-center gap-2">
            <Select value={template} onValueChange={aplicarTemplate}>
              <SelectTrigger className="h-7 text-xs w-[230px]">
                <Sparkles className="w-3.5 h-3.5 mr-1 text-primary" />
                <SelectValue placeholder="Template por série escolar" />
              </SelectTrigger>
              <SelectContent>
                {PDI_TEMPLATES_SERIE.map((t) => (
                  <SelectItem key={t.faixa} value={t.faixa}>{t.faixa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={addObjetivo} className="gap-1.5 h-7">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </Button>
          </div>
        </div>
        {objetivos.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhum objetivo. Clique em "Adicionar".</p>
        )}
        {objetivos.map((o, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-border p-2.5 bg-muted/20">
            <div className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-3">
                <Select value={o.area} onValueChange={(v) => updateObjetivo(i, { area: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOMINIOS.map((d) => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6">
                <Input className="h-8 text-xs" placeholder="Meta..."
                  value={o.meta} onChange={(e) => updateObjetivo(i, { meta: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Input className="h-8 text-xs" type="date"
                  value={o.prazo || ''} onChange={(e) => updateObjetivo(i, { prazo: e.target.value })} />
              </div>
              <div className="col-span-1 flex justify-end">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => removeObjetivo(i)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                className="h-7 text-xs"
                placeholder="Materiais adaptados / atividades lúdicas sugeridas"
                value={o.material_adaptado || ''}
                onChange={(e) => updateObjetivo(i, { material_adaptado: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <Input
                className="h-7 text-xs"
                placeholder="URL de vídeo/atividade de referência (opcional)"
                value={o.video_url || ''}
                onChange={(e) => updateObjetivo(i, { video_url: e.target.value })}
              />
              {o.video_url && (
                <a href={o.video_url} target="_blank" rel="noreferrer" className="text-[11px] text-primary underline shrink-0">
                  abrir
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}><X className="w-4 h-4 mr-1.5" /> Cancelar</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar PDI
        </Button>
      </div>
    </div>
  );
}