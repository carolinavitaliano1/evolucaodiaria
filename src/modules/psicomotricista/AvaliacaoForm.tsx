import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Save, X, Upload, Plus, Trash2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  INSTRUMENTOS_PADRAO,
  CATEGORIAS_TIPO,
  METRICAS_PADRAO_SUGERIDAS,
  type Avaliacao,
  type AvaliacaoTipoCustom,
} from './types';

interface Props {
  patientId: string;
  existing?: Avaliacao | null;
  onSaved: () => void;
  onCancel: () => void;
}

const METRICAS_INICIAIS = ['Memória', 'Atenção', 'Linguagem', 'Raciocínio'];

export function AvaliacaoForm({ patientId, existing, onSaved, onCancel }: Props) {
  // --- Dados principais ---
  const [titulo, setTitulo] = useState(existing?.titulo || '');
  const [instrumento, setInstrumento] = useState(existing?.instrumento || '');
  const [data, setData] = useState(existing?.data_avaliacao || new Date().toISOString().slice(0, 10));
  const [obs, setObs] = useState(existing?.observacoes || '');
  const [status, setStatus] = useState<'pendente' | 'concluida'>(existing?.status || 'concluida');

  // --- Arquivo ---
  const [arquivoUrl, setArquivoUrl] = useState<string | null>(existing?.arquivo_url || null);
  const [arquivoNome, setArquivoNome] = useState<string | null>(existing?.arquivo_nome || null);
  const [uploading, setUploading] = useState(false);

  // --- Métricas dinâmicas ---
  const initialMetricas: Record<string, number> = useMemo(() => {
    if (existing?.metricas && Object.keys(existing.metricas).length > 0) return { ...existing.metricas };
    // Compat com avaliações antigas (campos fixos)
    if (existing) {
      const compat: Record<string, number> = {};
      if (existing.memoria != null) compat['Memória'] = existing.memoria;
      if (existing.atencao != null) compat['Atenção'] = existing.atencao;
      if (existing.linguagem != null) compat['Linguagem'] = existing.linguagem;
      if (existing.leitura != null) compat['Leitura'] = existing.leitura;
      if (existing.escrita != null) compat['Escrita'] = existing.escrita;
      if (existing.matematica != null) compat['Matemática'] = existing.matematica;
      if (Object.keys(compat).length > 0) return compat;
    }
    return Object.fromEntries(METRICAS_INICIAIS.map((m) => [m, 0]));
  }, [existing]);

  const [metricas, setMetricas] = useState<Record<string, number>>(initialMetricas);
  const [novaMetrica, setNovaMetrica] = useState('');

  // --- Tipos custom ---
  const [tiposCustom, setTiposCustom] = useState<AvaliacaoTipoCustom[]>([]);
  const [tipoTab, setTipoTab] = useState<'existentes' | 'novo'>('existentes');

  // Form de novo tipo
  const [novoNome, setNovoNome] = useState('');
  const [novaDesc, setNovaDesc] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<string>('');
  const [novasMetricas, setNovasMetricas] = useState<string[]>([]);
  const [savingTipo, setSavingTipo] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from('psicom_avaliacao_tipos')
        .select('*')
        .eq('therapist_id', uid)
        .order('nome');
      setTiposCustom((data || []) as AvaliacaoTipoCustom[]);
    })();
  }, []);

  // --- Métricas helpers ---
  function setMetricaValor(nome: string, valor: number) {
    setMetricas((m) => ({ ...m, [nome]: valor }));
  }
  function adicionarMetrica(nome: string) {
    const n = nome.trim();
    if (!n) return;
    if (metricas[n] !== undefined) {
      toast.info('Métrica já adicionada');
      return;
    }
    setMetricas((m) => ({ ...m, [n]: 0 }));
    setNovaMetrica('');
  }
  function removerMetrica(nome: string) {
    setMetricas((m) => {
      const c = { ...m };
      delete c[nome];
      return c;
    });
  }
  function limparMetricas() {
    setMetricas({});
  }

  const sugeridasDisponiveis = METRICAS_PADRAO_SUGERIDAS.filter((s) => metricas[s] === undefined);

  // --- Upload ---
  async function handleFile(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const ext = file.name.split('.').pop();
      const path = `${uid}/psico/${patientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('attachments').upload(path, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
      setArquivoUrl(pub.publicUrl);
      setArquivoNome(file.name);
      toast.success('Arquivo anexado');
    } catch (e: any) {
      toast.error(e?.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  // --- Novo tipo ---
  function toggleNovaMetrica(m: string) {
    setNovasMetricas((arr) => (arr.includes(m) ? arr.filter((x) => x !== m) : [...arr, m]));
  }
  async function salvarTipo() {
    if (!novoNome.trim()) {
      toast.error('Informe o nome do tipo');
      return;
    }
    setSavingTipo(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('psicom_avaliacao_tipos')
        .insert({
          therapist_id: uid,
          nome: novoNome.trim(),
          descricao: novaDesc.trim() || null,
          categoria: novaCategoria || null,
          metricas_padrao: novasMetricas,
        })
        .select('*')
        .single();
      if (error) throw error;
      const novo = data as AvaliacaoTipoCustom;
      setTiposCustom((arr) => [...arr, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
      setInstrumento(novo.nome);
      // pré-popular métricas com as do tipo
      if (novo.metricas_padrao?.length) {
        const m: Record<string, number> = {};
        for (const k of novo.metricas_padrao) m[k] = 0;
        setMetricas(m);
      }
      toast.success('Tipo cadastrado');
      setNovoNome('');
      setNovaDesc('');
      setNovaCategoria('');
      setNovasMetricas([]);
      setTipoTab('existentes');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar tipo');
    } finally {
      setSavingTipo(false);
    }
  }

  function aplicarTipoSelecionado(valor: string) {
    setInstrumento(valor);
    const tipo = tiposCustom.find((t) => t.nome === valor);
    if (tipo?.metricas_padrao?.length) {
      const m: Record<string, number> = { ...metricas };
      for (const k of tipo.metricas_padrao) if (m[k] === undefined) m[k] = 0;
      setMetricas(m);
    }
  }

  // --- Salvar avaliação ---
  async function save() {
    if (!titulo.trim()) {
      toast.error('Informe o título da avaliação');
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');
      const payload: any = {
        patient_id: patientId,
        therapist_id: uid,
        data_avaliacao: data,
        tipo: existing?.tipo || 'inicial',
        status,
        titulo: titulo.trim(),
        instrumento: instrumento || null,
        observacoes: obs || null,
        arquivo_url: arquivoUrl,
        arquivo_nome: arquivoNome,
        metricas,
        // espelha métricas conhecidas nos campos legados para compat com radar antigo
        memoria: metricas['Memória'] ?? null,
        atencao: metricas['Atenção'] ?? null,
        linguagem: metricas['Linguagem'] ?? null,
        leitura: metricas['Leitura'] ?? null,
        escrita: metricas['Escrita'] ?? null,
        matematica: metricas['Matemática'] ?? null,
      };
      const { error } = existing
        ? await supabase.from('psicom_avaliacoes').update(payload).eq('id', existing.id)
        : await supabase.from('psicom_avaliacoes').insert(payload);
      if (error) throw error;
      toast.success(existing ? 'Avaliação atualizada' : 'Avaliação salva');
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const todosInstrumentos = [
    ...INSTRUMENTOS_PADRAO,
    ...tiposCustom.map((t) => t.nome).filter((n) => !INSTRUMENTOS_PADRAO.includes(n)),
  ];

  return (
    <div className="space-y-5 p-1">
      {/* Título */}
      <div className="space-y-1.5">
        <Label>Título da Avaliação</Label>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Avaliação Cognitiva - Novembro 2024"
        />
      </div>

      {/* Tipo de Avaliação */}
      <div className="space-y-2">
        <Label>Tipo de Avaliação</Label>
        <Tabs value={tipoTab} onValueChange={(v) => setTipoTab(v as 'existentes' | 'novo')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existentes">Tipos Existentes</TabsTrigger>
            <TabsTrigger value="novo">Cadastrar Novo</TabsTrigger>
          </TabsList>
          <TabsContent value="existentes" className="pt-2">
            <Select value={instrumento} onValueChange={aplicarTipoSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {todosInstrumentos.map((nome) => (
                  <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </TabsContent>
          <TabsContent value="novo" className="pt-3 space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Tipo</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Ex: NEUPSILIN" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Textarea rows={2} value={novaDesc} onChange={(e) => setNovaDesc(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={novaCategoria} onValueChange={setNovaCategoria}>
                <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_TIPO.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Métricas Padrão</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {METRICAS_PADRAO_SUGERIDAS.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={novasMetricas.includes(m)}
                      onCheckedChange={() => toggleNovaMetrica(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" onClick={salvarTipo} disabled={savingTipo} className="w-full">
              {savingTipo ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Salvar Tipo
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* Data + Status */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Data da Avaliação</Label>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as 'pendente' | 'concluida')}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="concluida">Concluída</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <Label>Observações</Label>
        <Textarea
          rows={3}
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          placeholder="Observações importantes..."
        />
      </div>

      {/* Anexar Arquivo */}
      <div className="space-y-1.5">
        <Label>Anexar Arquivo</Label>
        {arquivoUrl ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <a href={arquivoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary truncate">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{arquivoNome || 'Arquivo anexado'}</span>
            </a>
            <Button size="sm" variant="ghost" onClick={() => { setArquivoUrl(null); setArquivoNome(null); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <label
            htmlFor="psico-aval-file"
            className="flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 cursor-pointer hover:bg-muted/40 transition"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
            <span className="text-sm font-medium">Clique para fazer upload</span>
            <span className="text-xs text-muted-foreground">ou arraste e solte o arquivo aqui</span>
            <input
              id="psico-aval-file"
              type="file"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        )}
      </div>

      {/* Resultados Padronizados */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Resultados Padronizados</Label>
          {Object.keys(metricas).length > 0 && (
            <Button size="sm" variant="ghost" onClick={limparMetricas} className="h-7 text-xs">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          {Object.keys(metricas).length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">Nenhuma métrica. Adicione abaixo.</p>
          )}
          {Object.entries(metricas).map(([nome, valor]) => (
            <div key={nome} className="grid grid-cols-[1fr_100px_auto] items-center gap-2">
              <span className="text-sm font-medium">{nome}</span>
              <Input
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setMetricaValor(nome, Number(e.target.value) || 0)}
                className="h-8 text-sm"
              />
              <Button size="sm" variant="ghost" onClick={() => removerMetrica(nome)} className="h-8 w-8 p-0">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}

          {/* Adicionar nova */}
          <div className="flex gap-2 pt-1">
            <Input
              value={novaMetrica}
              onChange={(e) => setNovaMetrica(e.target.value)}
              placeholder="Nova métrica..."
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  adicionarMetrica(novaMetrica);
                }
              }}
            />
            <Button size="sm" variant="outline" onClick={() => adicionarMetrica(novaMetrica)} className="h-8">
              <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Sugestões rápidas */}
          {sugeridasDisponiveis.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {sugeridasDisponiveis.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => adicionarMetrica(s)}
                  className="text-xs px-2 py-1 rounded-md border border-border hover:bg-accent hover:text-accent-foreground transition"
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="w-4 h-4 mr-1.5" /> Cancelar
        </Button>
        <Button onClick={save} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Avaliação
        </Button>
      </div>
    </div>
  );
}