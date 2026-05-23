import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ScanLine, Sparkles, Upload, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Kind = 'psico' | 'psicom';

interface Metrica { nome: string; valor: number }
interface Extraido {
  titulo: string;
  instrumento?: string;
  data_avaliacao?: string;
  testes_aplicados?: string[];
  metricas: Metrica[];
  observacoes?: string;
  resumo_clinico: string;
  relatorio: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  kind: Kind;
  onSaved: () => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = r.result as string;
      resolve(s.split(',')[1] || '');
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

const DOMAIN_KEYS_PSICO = ['leitura', 'escrita', 'matematica', 'atencao', 'memoria', 'linguagem'] as const;
const DOMAIN_KEYS_PSICOM = ['equilibrio', 'coord_global', 'coord_fina', 'esquema_corporal', 'lateralidade', 'org_espacial'] as const;

function normalizarChave(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function mapMetricasParaColunas(kind: Kind, metricas: Metrica[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const alvo = kind === 'psico' ? DOMAIN_KEYS_PSICO : DOMAIN_KEYS_PSICOM;
  const aliases: Record<string, string> = kind === 'psico'
    ? { leitura: 'leitura', escrita: 'escrita', matematica: 'matematica', matematicas: 'matematica',
        atencao: 'atencao', concentracao: 'atencao', memoria: 'memoria',
        linguagem: 'linguagem', linguagem_oral: 'linguagem' }
    : { equilibrio: 'equilibrio', equilibracao: 'equilibrio',
        coord_global: 'coord_global', coordenacao_global: 'coord_global', coordenacao_motora_global: 'coord_global', motricidade_global: 'coord_global',
        coord_fina: 'coord_fina', coordenacao_fina: 'coord_fina', motricidade_fina: 'coord_fina',
        esquema_corporal: 'esquema_corporal', noticao_corporal: 'esquema_corporal',
        lateralidade: 'lateralidade',
        org_espacial: 'org_espacial', organizacao_espacial: 'org_espacial', estruturacao_espacial: 'org_espacial', espaco_temporal: 'org_espacial', estruturacao_espaco_temporal: 'org_espacial' };

  for (const k of alvo) out[k] = null;
  for (const m of metricas) {
    const key = aliases[normalizarChave(m.nome)];
    if (key && out[key] == null) out[key] = Math.round(m.valor);
  }
  return out;
}

export function DigitalizarAvaliacaoDialog({ open, onOpenChange, patientId, kind, onSaved }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extraido, setExtraido] = useState<Extraido | null>(null);

  function reset() {
    setFile(null); setExtraido(null); setAnalyzing(false); setSaving(false);
  }

  async function analisar() {
    if (!file) { toast.error('Selecione um arquivo'); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error('Arquivo muito grande (máx 15 MB)'); return; }
    setAnalyzing(true);
    try {
      const b64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke('digitize-assessment', {
        body: { fileBase64: b64, mimeType: file.type || 'application/pdf', moduleKind: kind },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const d = (data as any).data as Extraido;
      setExtraido({
        ...d,
        metricas: Array.isArray(d.metricas) ? d.metricas : [],
        testes_aplicados: d.testes_aplicados || [],
        data_avaliacao: d.data_avaliacao || new Date().toISOString().slice(0, 10),
      });
      toast.success('Avaliação digitalizada');
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao digitalizar');
    } finally {
      setAnalyzing(false);
    }
  }

  async function salvar() {
    if (!extraido || !file) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error('Não autenticado');

      // Upload do arquivo original
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${uid}/${kind}/${patientId}/${Date.now()}.${ext}`;
      const up = await supabase.storage.from('attachments').upload(path, file);
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);

      const metricasMap: Record<string, number> = {};
      for (const m of extraido.metricas) metricasMap[m.nome] = Math.round(m.valor);
      const colunas = mapMetricasParaColunas(kind, extraido.metricas);

      const observacoes = [
        extraido.observacoes?.trim(),
        '',
        '## Resumo clínico (IA)',
        extraido.resumo_clinico?.trim(),
        '',
        '## Relatório',
        extraido.relatorio?.trim(),
      ].filter(Boolean).join('\n\n');

      const table = kind === 'psico' ? 'psico_avaliacoes' : 'psicom_avaliacoes';
      const payload: any = {
        patient_id: patientId,
        therapist_id: uid,
        data_avaliacao: extraido.data_avaliacao || new Date().toISOString().slice(0, 10),
        tipo: 'inicial',
        status: 'concluida',
        titulo: extraido.titulo || 'Avaliação digitalizada',
        instrumento: extraido.instrumento || null,
        testes_aplicados: extraido.testes_aplicados?.length ? extraido.testes_aplicados : null,
        observacoes,
        arquivo_url: pub.publicUrl,
        arquivo_nome: file.name,
        metricas: metricasMap,
        ...colunas,
      };
      const { error } = await (supabase as any).from(table).insert(payload);
      if (error) throw error;
      toast.success('Avaliação salva');
      onSaved();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function updMetrica(i: number, patch: Partial<Metrica>) {
    if (!extraido) return;
    const arr = [...extraido.metricas];
    arr[i] = { ...arr[i], ...patch };
    setExtraido({ ...extraido, metricas: arr });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary" /> Digitalizar avaliação existente
          </DialogTitle>
          <DialogDescription>
            Envie um PDF ou foto de uma avaliação já realizada. A IA lê, extrai os resultados e monta um relatório com resumo clínico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 space-y-2">
            <Label className="text-xs">Arquivo (PDF, JPG ou PNG — máx 15 MB)</Label>
            <Input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setExtraido(null); }}
              disabled={analyzing || saving}
            />
            {file && (
              <p className="text-[11px] text-muted-foreground truncate">{file.name} — {(file.size / 1024).toFixed(0)} KB</p>
            )}
            <Button onClick={analisar} disabled={!file || analyzing || saving} size="sm" className="gap-1.5 w-full sm:w-auto">
              {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {analyzing ? 'Analisando com IA...' : 'Ler e estruturar com IA'}
            </Button>
          </div>

          {extraido && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-card">
              <div className="flex items-center gap-2 text-xs font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" /> Resultado extraído (revise antes de salvar)
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Título</Label>
                  <Input value={extraido.titulo} onChange={(e) => setExtraido({ ...extraido, titulo: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Instrumento</Label>
                  <Input value={extraido.instrumento || ''} onChange={(e) => setExtraido({ ...extraido, instrumento: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={extraido.data_avaliacao || ''} onChange={(e) => setExtraido({ ...extraido, data_avaliacao: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Testes aplicados</Label>
                  <Input
                    value={(extraido.testes_aplicados || []).join(', ')}
                    onChange={(e) => setExtraido({ ...extraido, testes_aplicados: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Métricas detectadas (0-100)</Label>
                <div className="space-y-1.5">
                  {extraido.metricas.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nenhuma métrica numérica foi identificada.</p>
                  )}
                  {extraido.metricas.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="flex-1 h-8 text-xs" value={m.nome} onChange={(e) => updMetrica(i, { nome: e.target.value })} />
                      <Input className="w-20 h-8 text-xs" type="number" min={0} max={100} value={m.valor}
                             onChange={(e) => updMetrica(i, { valor: Number(e.target.value) || 0 })} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        const arr = extraido.metricas.filter((_, x) => x !== i);
                        setExtraido({ ...extraido, metricas: arr });
                      }}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                          onClick={() => setExtraido({ ...extraido, metricas: [...extraido.metricas, { nome: '', valor: 0 }] })}>
                    + Métrica
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Resumo clínico (IA)</Label>
                <Textarea rows={4} value={extraido.resumo_clinico} onChange={(e) => setExtraido({ ...extraido, resumo_clinico: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Relatório completo</Label>
                <Textarea rows={8} value={extraido.relatorio} onChange={(e) => setExtraido({ ...extraido, relatorio: e.target.value })} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Observações adicionais</Label>
                <Textarea rows={2} value={extraido.observacoes || ''} onChange={(e) => setExtraido({ ...extraido, observacoes: e.target.value })} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
            <Button size="sm" disabled={!extraido || saving} onClick={salvar} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar avaliação
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}