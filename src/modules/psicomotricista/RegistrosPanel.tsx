import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, Trash2, FileIcon, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { REGISTRO_TIPOS_PADRAO, type Registro } from './types';

interface Props {
  patientId: string;
}

const STORAGE_KEY = 'psico_registro_tipos_custom';

export function RegistrosPanel({ patientId }: Props) {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [customTipos, setCustomTipos] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const allTipos = [...REGISTRO_TIPOS_PADRAO, ...customTipos];

  const [tipo, setTipo] = useState('PEI');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('psicom_registros').select('*').eq('patient_id', patientId)
      .order('data_registro', { ascending: false });
    if (error) toast.error('Erro ao carregar registros');
    setRegistros((data || []) as Registro[]);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  function addCustomTipo() {
    const v = prompt('Nome do novo tipo de registro:')?.trim();
    if (!v) return;
    if (allTipos.includes(v)) { toast.info('Esse tipo já existe'); setTipo(v); return; }
    const next = [...customTipos, v];
    setCustomTipos(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setTipo(v);
  }

  async function save() {
    if (!tipo) { toast.error('Selecione um tipo'); return; }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('Não autenticado');

      let arquivo_url: string | null = null;
      let arquivo_nome: string | null = null;
      if (file) {
        const path = `${uid}/psico-registros/${patientId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
        arquivo_url = pub.publicUrl;
        arquivo_nome = file.name;
      }

      const { error } = await supabase.from('psicom_registros').insert({
        patient_id: patientId,
        therapist_id: uid,
        tipo,
        codigo: codigo || null,
        data_registro: data,
        descricao: descricao || null,
        arquivo_url,
        arquivo_nome,
      });
      if (error) throw error;
      toast.success('Registro salvo');
      setCodigo(''); setDescricao(''); setFile(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove(r: Registro) {
    if (!confirm('Excluir este registro?')) return;
    if (r.arquivo_url) {
      const idx = r.arquivo_url.indexOf('/attachments/');
      if (idx >= 0) {
        const path = r.arquivo_url.substring(idx + '/attachments/'.length);
        await supabase.storage.from('attachments').remove([path]);
      }
    }
    const { error } = await supabase.from('psicom_registros').delete().eq('id', r.id);
    if (error) toast.error('Erro ao excluir'); else { toast.success('Excluído'); load(); }
  }

  const filtered = filterTipo === 'TODOS' ? registros : registros.filter((r) => r.tipo === filterTipo);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Adicionar novo registro</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <div className="flex gap-1.5">
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allTipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={addCustomTipo} title="Cadastrar novo tipo">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código (opcional)</Label>
            <Input placeholder="Ex: PEI-01" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Anexar arquivo</Label>
            <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Descrição</Label>
          <Textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes deste registro..." />
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar registro
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Histórico ({filtered.length})</h3>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os tipos</SelectItem>
            {allTipos.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum registro {filterTipo !== 'TODOS' ? `do tipo "${filterTipo}"` : 'ainda'}.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-3 flex justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">{r.tipo}</span>
                  {r.codigo && <span className="text-[10px] font-mono text-muted-foreground">{r.codigo}</span>}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.data_registro + 'T12:00:00'), "d 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                </div>
                {r.descricao && <p className="text-xs text-foreground/80 whitespace-pre-wrap">{r.descricao}</p>}
                {r.arquivo_url && (
                  <a href={r.arquivo_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <FileIcon className="w-3 h-3" /> {r.arquivo_nome || 'Anexo'}
                  </a>
                )}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" onClick={() => remove(r)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}