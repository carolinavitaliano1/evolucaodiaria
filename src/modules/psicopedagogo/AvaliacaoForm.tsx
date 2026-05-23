import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DOMINIOS, TESTES_SUGERIDOS, type Avaliacao, type AvaliacaoTipo } from './types';

interface Props {
  patientId: string;
  existing?: Avaliacao | null;
  onSaved: () => void;
  onCancel: () => void;
}

export function AvaliacaoForm({ patientId, existing, onSaved, onCancel }: Props) {
  const [tipo, setTipo] = useState<AvaliacaoTipo>(existing?.tipo || 'inicial');
  const [data, setData] = useState(existing?.data_avaliacao || new Date().toISOString().slice(0, 10));
  const [scores, setScores] = useState({
    leitura: existing?.leitura ?? 5,
    escrita: existing?.escrita ?? 5,
    matematica: existing?.matematica ?? 5,
    atencao: existing?.atencao ?? 5,
    memoria: existing?.memoria ?? 5,
    linguagem: existing?.linguagem ?? 5,
  });
  const [testes, setTestes] = useState<string[]>(existing?.testes_aplicados || []);
  const [obs, setObs] = useState(existing?.observacoes || '');
  const [saving, setSaving] = useState(false);

  function toggleTeste(t: string) {
    setTestes((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));
  }

  async function save() {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const payload = {
        patient_id: patientId,
        therapist_id: uid,
        data_avaliacao: data,
        tipo,
        ...scores,
        testes_aplicados: testes,
        observacoes: obs || null,
      };
      const { error } = existing
        ? await supabase.from('psico_avaliacoes').update(payload).eq('id', existing.id)
        : await supabase.from('psico_avaliacoes').insert(payload);
      if (error) throw error;
      toast.success(existing ? 'Avaliação atualizada' : 'Avaliação salva');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-1">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as AvaliacaoTipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inicial">Inicial</SelectItem>
              <SelectItem value="reavaliacao">Reavaliação</SelectItem>
              <SelectItem value="alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Data</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-semibold">Domínios (0–10)</Label>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          {DOMINIOS.map((d) => (
            <div key={d.key} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-foreground">{d.label}</span>
                <span className="text-primary font-bold tabular-nums">{scores[d.key]}</span>
              </div>
              <Slider
                value={[scores[d.key] as number]}
                onValueChange={([v]) => setScores((s) => ({ ...s, [d.key]: v }))}
                min={0}
                max={10}
                step={1}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold">Testes aplicados</Label>
        <div className="flex flex-wrap gap-1.5">
          {TESTES_SUGERIDOS.map((t) => (
            <Badge
              key={t}
              variant={testes.includes(t) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleTeste(t)}
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea rows={4} value={obs} onChange={(e) => setObs(e.target.value)}
          placeholder="Hipótese diagnóstica, observações qualitativas, recomendações..." />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}><X className="w-4 h-4 mr-1.5" /> Cancelar</Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar avaliação
        </Button>
      </div>
    </div>
  );
}