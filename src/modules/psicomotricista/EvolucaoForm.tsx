import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Desempenho, Humor, PDI } from './types';

interface Props {
  patientId: string;
  pdis: PDI[];
  onSaved: () => void;
  onCancel: () => void;
}

export function EvolucaoForm({ patientId, pdis, onSaved, onCancel }: Props) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [duracao, setDuracao] = useState<number>(50);
  const [pdiId, setPdiId] = useState<string>('none');
  const [atividadesStr, setAtividadesStr] = useState('');
  const [desempenho, setDesempenho] = useState<Desempenho>('bom');
  const [humor, setHumor] = useState<Humor>('tranquilo');
  const [descricao, setDescricao] = useState('');
  const [tarefas, setTarefas] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!descricao.trim()) { toast.error('Descreva a sessão'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const atividades = atividadesStr.split(',').map((s) => s.trim()).filter(Boolean);
      const { error } = await supabase.from('psicom_evolucoes').insert({
        patient_id: patientId,
        therapist_id: uid,
        data_sessao: data,
        duracao_min: duracao || null,
        pdi_id: pdiId === 'none' ? null : pdiId,
        atividades: atividades.length ? atividades : null,
        desempenho,
        humor,
        descricao: descricao.trim(),
        tarefas_casa: tarefas || null,
      });
      if (error) throw error;
      toast.success('Evolução registrada');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-1">
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Duração (min)</Label>
          <Input type="number" min={5} max={240} step={5} value={duracao} onChange={(e) => setDuracao(parseInt(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>PDI vinculado</Label>
          <Select value={pdiId} onValueChange={setPdiId}>
            <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {pdis.map((p) => <SelectItem key={p.id} value={p.id}>{p.titulo}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Desempenho</Label>
          <Select value={desempenho} onValueChange={(v) => setDesempenho(v as Desempenho)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="otimo">Ótimo</SelectItem>
              <SelectItem value="bom">Bom</SelectItem>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="dificuldade">Com dificuldade</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Humor</Label>
          <Select value={humor} onValueChange={(v) => setHumor(v as Humor)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="animado">Animado</SelectItem>
              <SelectItem value="tranquilo">Tranquilo</SelectItem>
              <SelectItem value="agitado">Agitado</SelectItem>
              <SelectItem value="ansioso">Ansioso</SelectItem>
              <SelectItem value="resistente">Resistente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Atividades (separadas por vírgula)</Label>
        <Input value={atividadesStr} onChange={(e) => setAtividadesStr(e.target.value)}
          placeholder="Ex: jogo silábico, ditado, leitura compartilhada" />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição da sessão</Label>
        <Textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="Comportamento, progressos, dificuldades observadas..." />
      </div>

      <div className="space-y-1.5">
        <Label>Tarefas para casa</Label>
        <Textarea rows={2} value={tarefas} onChange={(e) => setTarefas(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}><X className="w-4 h-4 mr-1.5" /> Cancelar</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar evolução
        </Button>
      </div>
    </div>
  );
}